"""
BaoStock Routes for QuantCore Pro

Provides REST endpoints for A-share market data via BaoStock.
These endpoints are consumed by the TypeScript BaoStockAdapter (browser cannot
call baostock directly — it requires this Python proxy).

Endpoints:
  GET /api/baostock/snapshot      — Latest available snapshot(s) for one or more symbols
  GET /api/baostock/klines/daily  — Daily / weekly / monthly OHLCV klines
  GET /api/baostock/klines/minute — Minute-level OHLCV klines (5 / 15 / 30 / 60 min)
"""

from __future__ import annotations

import logging
import time
from datetime import datetime, timedelta

from flask import Blueprint, jsonify, request

logger = logging.getLogger(__name__)

# ---------------------------------------------------------------------------
# BaoStock client (optional — degrades gracefully when not installed)
# ---------------------------------------------------------------------------

try:
    import baostock as bs  # type: ignore[import-untyped]

    _BS_AVAILABLE = True
except ImportError:
    bs = None  # type: ignore[assignment]
    _BS_AVAILABLE = False

_BS_LOGGED_IN = False


def _ensure_login() -> bool:
    global _BS_LOGGED_IN
    if not _BS_AVAILABLE:
        return False
    if not _BS_LOGGED_IN:
        lg = bs.login()
        _BS_LOGGED_IN = lg.error_code == "0"
        if not _BS_LOGGED_IN:
            logger.warning("BaoStock login failed: %s %s", lg.error_code, lg.error_msg)
    return _BS_LOGGED_IN


# ---------------------------------------------------------------------------
# Symbol format helpers
# ---------------------------------------------------------------------------

def _to_bs_code(symbol: str) -> str:
    """Convert 'sh600519' → 'sh.600519' (BaoStock format)."""
    s = symbol.strip().lower()
    if "." in s:
        return s
    if s.startswith("sh") or s.startswith("sz"):
        return s[:2] + "." + s[2:]
    return s


def _to_short_code(bs_code: str) -> str:
    """Convert 'sh.600519' → 'sh600519' (frontend format)."""
    return bs_code.replace(".", "").lower()


def _fmt_date(raw: str) -> str:
    """Convert YYYYMMDD → YYYY-MM-DD; pass through if already in ISO format."""
    raw = raw.strip()
    if len(raw) == 8 and raw.isdigit():
        return f"{raw[:4]}-{raw[4:6]}-{raw[6:]}"
    return raw


# ---------------------------------------------------------------------------
# Blueprint
# ---------------------------------------------------------------------------

baostock_bp = Blueprint("baostock", __name__, url_prefix="/api/baostock")


@baostock_bp.route("/snapshot", methods=["GET"])
def snapshot():
    """
    Fetch the latest available end-of-day snapshot for one or more symbols.

    Note: BaoStock provides end-of-day data, not real-time intraday ticks.
    During a live trading session the returned price reflects the previous
    day's close until the current day's session has ended.

    Query params:
      symbols — comma-separated list, e.g. "sh600519,sz000858"
    """
    symbols_raw = request.args.get("symbols", "").strip()
    if not symbols_raw:
        return jsonify({"error": "symbols parameter required"}), 400

    symbols = [s.strip() for s in symbols_raw.split(",") if s.strip()]
    if not symbols:
        return jsonify({"error": "No valid symbols"}), 400

    if not _ensure_login():
        return jsonify({"error": "BaoStock unavailable", "snapshots": []}), 503

    today = datetime.now().strftime("%Y-%m-%d")
    lookback_start = (datetime.now() - timedelta(days=7)).strftime("%Y-%m-%d")

    snapshots = []
    for raw_sym in symbols:
        bs_code = _to_bs_code(raw_sym)
        short = _to_short_code(bs_code)
        try:
            rs = bs.query_history_k_data_plus(
                bs_code,
                "date,code,open,high,low,close,volume,amount,pctChg",
                start_date=lookback_start,
                end_date=today,
                frequency="d",
                adjustflag="3",  # unadjusted for snapshots
            )
            rows: list[list[str]] = []
            while rs.error_code == "0" and rs.next():
                rows.append(rs.get_row_data())

            if not rows:
                continue

            # Take the most recent row
            date, _code, open_, high, low, close, volume, amount, pct_chg = rows[-1]

            price = float(close) if close else 0.0
            if price <= 0:
                continue

            pct = float(pct_chg) if pct_chg else 0.0
            prev_close = price / (1 + pct / 100) if pct != 0 else price
            change = round(price - prev_close, 3)

            snapshots.append(
                {
                    "symbol": short,
                    "name": short,  # BaoStock has no name in kdata; use code as fallback
                    "price": price,
                    "open": float(open_) if open_ else price,
                    "prevClose": round(prev_close, 3),
                    "high": float(high) if high else price,
                    "low": float(low) if low else price,
                    "volume": float(volume) if volume else 0.0,
                    "amount": float(amount) if amount else 0.0,
                    "change": change,
                    "changePercent": pct,
                    "timestamp": int(time.time() * 1000),
                    "date": date,  # extra: date of the snapshot
                }
            )
        except Exception:
            logger.exception("BaoStock snapshot error for %s", raw_sym)

    return jsonify({"snapshots": snapshots})


@baostock_bp.route("/klines/daily", methods=["GET"])
def klines_daily():
    """
    Fetch daily / weekly / monthly OHLCV klines.

    Query params:
      symbol  — e.g. "sh600519"
      period  — "daily" | "weekly" | "monthly"   (default: "daily")
      start   — start date YYYYMMDD or YYYY-MM-DD (default: 1 year ago)
      end     — end   date YYYYMMDD or YYYY-MM-DD (default: today)
      adjust  — "qfq" (前复权) | "hfq" (后复权) | "" (unadjusted)  (default: "qfq")
    """
    symbol = request.args.get("symbol", "").strip()
    if not symbol:
        return jsonify({"error": "symbol parameter required"}), 400

    period = request.args.get("period", "daily")
    adjust = request.args.get("adjust", "qfq")

    end_date = _fmt_date(request.args.get("end", "")) or datetime.now().strftime("%Y-%m-%d")
    start_date = _fmt_date(request.args.get("start", "")) or (
        datetime.now() - timedelta(days=365)
    ).strftime("%Y-%m-%d")

    freq_map = {"daily": "d", "weekly": "w", "monthly": "m"}
    freq = freq_map.get(period, "d")

    # BaoStock adjustflag: "1" = 后复权, "2" = 前复权, "3" = 不复权
    adj_map = {"qfq": "2", "hfq": "1", "": "3"}
    adjustflag = adj_map.get(adjust, "2")

    if not _ensure_login():
        return jsonify({"error": "BaoStock unavailable", "klines": []}), 503

    bs_code = _to_bs_code(symbol)
    try:
        rs = bs.query_history_k_data_plus(
            bs_code,
            "date,open,high,low,close,volume",
            start_date=start_date,
            end_date=end_date,
            frequency=freq,
            adjustflag=adjustflag,
        )
        klines = []
        while rs.error_code == "0" and rs.next():
            row = rs.get_row_data()
            if len(row) < 6:
                continue
            date, open_, high, low, close, volume = row
            try:
                klines.append(
                    {
                        "time": date,
                        "open": float(open_),
                        "high": float(high),
                        "low": float(low),
                        "close": float(close),
                        "volume": float(volume),
                    }
                )
            except (ValueError, TypeError):
                continue

        return jsonify({"klines": klines})
    except Exception:
        logger.exception("BaoStock daily klines error for %s", symbol)
        return jsonify({"error": "Internal error", "klines": []}), 500


@baostock_bp.route("/klines/minute", methods=["GET"])
def klines_minute():
    """
    Fetch minute-level OHLCV klines.

    BaoStock supports 5 / 15 / 30 / 60 minute bars only (not 1-min).

    Query params:
      symbol  — e.g. "sh600519"
      period  — "5" | "15" | "30" | "60"  (minutes; default: "5")
    """
    symbol = request.args.get("symbol", "").strip()
    if not symbol:
        return jsonify({"error": "symbol parameter required"}), 400

    period = request.args.get("period", "5")
    if period not in {"5", "15", "30", "60"}:
        period = "5"

    # Query the last 7 calendar days to ensure we get enough intraday bars
    end_date = datetime.now().strftime("%Y-%m-%d")
    start_date = (datetime.now() - timedelta(days=7)).strftime("%Y-%m-%d")

    if not _ensure_login():
        return jsonify({"error": "BaoStock unavailable", "klines": []}), 503

    bs_code = _to_bs_code(symbol)
    try:
        rs = bs.query_history_k_data_plus(
            bs_code,
            "date,time,open,high,low,close,volume",
            start_date=start_date,
            end_date=end_date,
            frequency=period,
            adjustflag="3",
        )
        klines = []
        while rs.error_code == "0" and rs.next():
            row = rs.get_row_data()
            if len(row) < 7:
                continue
            date, time_raw, open_, high, low, close, volume = row
            # BaoStock time format: "093000000" → "09:30:00"
            t = time_raw.strip()
            if len(t) >= 6:
                time_str = f"{date} {t[:2]}:{t[2:4]}:{t[4:6]}"
            else:
                time_str = date
            try:
                klines.append(
                    {
                        "time": time_str,
                        "open": float(open_),
                        "high": float(high),
                        "low": float(low),
                        "close": float(close),
                        "volume": float(volume),
                    }
                )
            except (ValueError, TypeError):
                continue

        return jsonify({"klines": klines})
    except Exception:
        logger.exception("BaoStock minute klines error for %s", symbol)
        return jsonify({"error": "Internal error", "klines": []}), 500
