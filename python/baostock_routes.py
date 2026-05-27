"""
BaoStock Routes for QuantCore Pro

Provides REST endpoints for A-share market data via BaoStock.
These endpoints are consumed by the TypeScript BaoStockAdapter (browser cannot
call baostock directly — it requires this Python proxy).

Endpoints — Market Data:
  GET /api/baostock/snapshot           — Latest available snapshot(s) for one or more symbols
  GET /api/baostock/klines/daily       — Daily / weekly / monthly OHLCV klines
  GET /api/baostock/klines/minute      — Minute-level OHLCV klines (5 / 15 / 30 / 60 min)

Endpoints — Fundamental Data:
  GET /api/baostock/profit             — 季频盈利能力 (query_profit_data)
  GET /api/baostock/operation          — 季频营运能力 (query_operation_data)
  GET /api/baostock/growth             — 季频成长能力 (query_growth_data)
  GET /api/baostock/balance            — 季频偿债能力 (query_balance_data)
  GET /api/baostock/cash_flow          — 季频现金流量 (query_cash_flow_data)
  GET /api/baostock/dupont             — 杜邦指数 (query_dupont_data)

Endpoints — Reference Data:
  GET /api/baostock/stock_basic        — 证券基本资料 (query_stock_basic)
  GET /api/baostock/trade_dates        — 交易日历 (query_trade_dates)
  GET /api/baostock/all_stocks         — 证券代码列表 (query_all_stock)
  GET /api/baostock/index/sz50         — 上证50成分股 (query_sz50_stocks)
  GET /api/baostock/index/hs300        — 沪深300成分股 (query_hs300_stocks)
  GET /api/baostock/index/zz500        — 中证500成分股 (query_zz500_stocks)
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


def _collect_rows(rs) -> list[list[str]]:
    """Drain a BaoStock result set into a list of row lists."""
    rows: list[list[str]] = []
    while rs.error_code == "0" and rs.next():
        rows.append(rs.get_row_data())
    return rows


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


# ═══════════════════════════════════════════════════════════════════════════════
# Fundamental data endpoints
# ═══════════════════════════════════════════════════════════════════════════════


@baostock_bp.route("/profit", methods=["GET"])
def profit_data():
    """
    季频盈利能力 — query_profit_data

    Query params:
      symbol — e.g. "sh600519"
      year   — e.g. "2024"
      quarter — "1" | "2" | "3" | "4"
    """
    symbol = request.args.get("symbol", "").strip()
    year = request.args.get("year", "").strip()
    quarter = request.args.get("quarter", "").strip()
    if not symbol:
        return jsonify({"error": "symbol parameter required"}), 400

    if not _ensure_login():
        return jsonify({"error": "BaoStock unavailable"}), 503

    bs_code = _to_bs_code(symbol)
    try:
        rs = bs.query_profit_data(code=bs_code, year=int(year) if year else None, quarter=int(quarter) if quarter else None)
        fields = rs.fields if hasattr(rs, "fields") else []
        rows = _collect_rows(rs)
        data = [dict(zip(fields, row)) for row in rows] if fields else rows
        return jsonify({"data": data, "fields": fields})
    except Exception:
        logger.exception("BaoStock profit_data error for %s", symbol)
        return jsonify({"error": "Internal error"}), 500


@baostock_bp.route("/operation", methods=["GET"])
def operation_data():
    """
    季频营运能力 — query_operation_data

    Query params:
      symbol — e.g. "sh600519"
      year   — e.g. "2024"
      quarter — "1" | "2" | "3" | "4"
    """
    symbol = request.args.get("symbol", "").strip()
    year = request.args.get("year", "").strip()
    quarter = request.args.get("quarter", "").strip()
    if not symbol:
        return jsonify({"error": "symbol parameter required"}), 400

    if not _ensure_login():
        return jsonify({"error": "BaoStock unavailable"}), 503

    bs_code = _to_bs_code(symbol)
    try:
        rs = bs.query_operation_data(code=bs_code, year=int(year) if year else None, quarter=int(quarter) if quarter else None)
        fields = rs.fields if hasattr(rs, "fields") else []
        rows = _collect_rows(rs)
        data = [dict(zip(fields, row)) for row in rows] if fields else rows
        return jsonify({"data": data, "fields": fields})
    except Exception:
        logger.exception("BaoStock operation_data error for %s", symbol)
        return jsonify({"error": "Internal error"}), 500


@baostock_bp.route("/growth", methods=["GET"])
def growth_data():
    """
    季频成长能力 — query_growth_data

    Query params:
      symbol — e.g. "sh600519"
      year   — e.g. "2024"
      quarter — "1" | "2" | "3" | "4"
    """
    symbol = request.args.get("symbol", "").strip()
    year = request.args.get("year", "").strip()
    quarter = request.args.get("quarter", "").strip()
    if not symbol:
        return jsonify({"error": "symbol parameter required"}), 400

    if not _ensure_login():
        return jsonify({"error": "BaoStock unavailable"}), 503

    bs_code = _to_bs_code(symbol)
    try:
        rs = bs.query_growth_data(code=bs_code, year=int(year) if year else None, quarter=int(quarter) if quarter else None)
        fields = rs.fields if hasattr(rs, "fields") else []
        rows = _collect_rows(rs)
        data = [dict(zip(fields, row)) for row in rows] if fields else rows
        return jsonify({"data": data, "fields": fields})
    except Exception:
        logger.exception("BaoStock growth_data error for %s", symbol)
        return jsonify({"error": "Internal error"}), 500


@baostock_bp.route("/balance", methods=["GET"])
def balance_data():
    """
    季频偿债能力 — query_balance_data

    Query params:
      symbol — e.g. "sh600519"
      year   — e.g. "2024"
      quarter — "1" | "2" | "3" | "4"
    """
    symbol = request.args.get("symbol", "").strip()
    year = request.args.get("year", "").strip()
    quarter = request.args.get("quarter", "").strip()
    if not symbol:
        return jsonify({"error": "symbol parameter required"}), 400

    if not _ensure_login():
        return jsonify({"error": "BaoStock unavailable"}), 503

    bs_code = _to_bs_code(symbol)
    try:
        rs = bs.query_balance_data(code=bs_code, year=int(year) if year else None, quarter=int(quarter) if quarter else None)
        fields = rs.fields if hasattr(rs, "fields") else []
        rows = _collect_rows(rs)
        data = [dict(zip(fields, row)) for row in rows] if fields else rows
        return jsonify({"data": data, "fields": fields})
    except Exception:
        logger.exception("BaoStock balance_data error for %s", symbol)
        return jsonify({"error": "Internal error"}), 500


@baostock_bp.route("/cash_flow", methods=["GET"])
def cash_flow_data():
    """
    季频现金流量 — query_cash_flow_data

    Query params:
      symbol — e.g. "sh600519"
      year   — e.g. "2024"
      quarter — "1" | "2" | "3" | "4"
    """
    symbol = request.args.get("symbol", "").strip()
    year = request.args.get("year", "").strip()
    quarter = request.args.get("quarter", "").strip()
    if not symbol:
        return jsonify({"error": "symbol parameter required"}), 400

    if not _ensure_login():
        return jsonify({"error": "BaoStock unavailable"}), 503

    bs_code = _to_bs_code(symbol)
    try:
        rs = bs.query_cash_flow_data(code=bs_code, year=int(year) if year else None, quarter=int(quarter) if quarter else None)
        fields = rs.fields if hasattr(rs, "fields") else []
        rows = _collect_rows(rs)
        data = [dict(zip(fields, row)) for row in rows] if fields else rows
        return jsonify({"data": data, "fields": fields})
    except Exception:
        logger.exception("BaoStock cash_flow_data error for %s", symbol)
        return jsonify({"error": "Internal error"}), 500


@baostock_bp.route("/dupont", methods=["GET"])
def dupont_data():
    """
    杜邦指数 — query_dupont_data

    Query params:
      symbol — e.g. "sh600519"
      year   — e.g. "2024"
      quarter — "1" | "2" | "3" | "4"
    """
    symbol = request.args.get("symbol", "").strip()
    year = request.args.get("year", "").strip()
    quarter = request.args.get("quarter", "").strip()
    if not symbol:
        return jsonify({"error": "symbol parameter required"}), 400

    if not _ensure_login():
        return jsonify({"error": "BaoStock unavailable"}), 503

    bs_code = _to_bs_code(symbol)
    try:
        rs = bs.query_dupont_data(code=bs_code, year=int(year) if year else None, quarter=int(quarter) if quarter else None)
        fields = rs.fields if hasattr(rs, "fields") else []
        rows = _collect_rows(rs)
        data = [dict(zip(fields, row)) for row in rows] if fields else rows
        return jsonify({"data": data, "fields": fields})
    except Exception:
        logger.exception("BaoStock dupont_data error for %s", symbol)
        return jsonify({"error": "Internal error"}), 500


# ═══════════════════════════════════════════════════════════════════════════════
# Reference data endpoints
# ═══════════════════════════════════════════════════════════════════════════════


@baostock_bp.route("/stock_basic", methods=["GET"])
def stock_basic():
    """
    证券基本资料 — query_stock_basic

    Query params:
      symbol — e.g. "sh600519" (optional — returns all if omitted)
    """
    symbol = request.args.get("symbol", "").strip()

    if not _ensure_login():
        return jsonify({"error": "BaoStock unavailable"}), 503

    try:
        kwargs: dict = {}
        if symbol:
            kwargs["code"] = _to_bs_code(symbol)
        rs = bs.query_stock_basic(**kwargs)
        fields = rs.fields if hasattr(rs, "fields") else []
        rows = _collect_rows(rs)
        data = [dict(zip(fields, row)) for row in rows] if fields else rows
        return jsonify({"data": data, "fields": fields, "total": len(data)})
    except Exception:
        logger.exception("BaoStock stock_basic error")
        return jsonify({"error": "Internal error"}), 500


@baostock_bp.route("/trade_dates", methods=["GET"])
def trade_dates():
    """
    交易日历 — query_trade_dates

    Query params:
      start — start date YYYY-MM-DD (default: start of current year)
      end   — end date YYYY-MM-DD (default: today)
    """
    end_date = _fmt_date(request.args.get("end", "")) or datetime.now().strftime("%Y-%m-%d")
    start_date = _fmt_date(request.args.get("start", "")) or f"{datetime.now().year}-01-01"

    if not _ensure_login():
        return jsonify({"error": "BaoStock unavailable"}), 503

    try:
        rs = bs.query_trade_dates(start_date=start_date, end_date=end_date)
        fields = rs.fields if hasattr(rs, "fields") else []
        rows = _collect_rows(rs)

        # Return both full data and a simple list of trading dates
        trading_dates: list[str] = []
        all_dates: list[dict] = []
        for row in rows:
            entry = dict(zip(fields, row)) if fields else {"date": row[0], "is_trading_day": row[1]}
            all_dates.append(entry)
            # is_trading_day is "1" for trading days
            if len(row) >= 2 and row[1] == "1":
                trading_dates.append(row[0])

        return jsonify({
            "tradingDates": trading_dates,
            "allDates": all_dates,
            "total": len(trading_dates),
        })
    except Exception:
        logger.exception("BaoStock trade_dates error")
        return jsonify({"error": "Internal error"}), 500


@baostock_bp.route("/all_stocks", methods=["GET"])
def all_stocks():
    """
    证券代码列表 — query_all_stock

    Query params:
      date — date in YYYY-MM-DD format (default: today)
    """
    date = _fmt_date(request.args.get("date", "")) or datetime.now().strftime("%Y-%m-%d")

    if not _ensure_login():
        return jsonify({"error": "BaoStock unavailable"}), 503

    try:
        rs = bs.query_all_stock(day=date)
        fields = rs.fields if hasattr(rs, "fields") else []
        rows = _collect_rows(rs)
        stocks = []
        for row in rows:
            entry = dict(zip(fields, row)) if fields else {}
            # Normalize code field
            if "code" in entry:
                entry["symbol"] = _to_short_code(entry["code"])
            stocks.append(entry)

        return jsonify({"stocks": stocks, "total": len(stocks), "date": date})
    except Exception:
        logger.exception("BaoStock all_stocks error")
        return jsonify({"error": "Internal error"}), 500


@baostock_bp.route("/index/sz50", methods=["GET"])
def sz50_stocks():
    """
    上证50成分股 — query_sz50_stocks

    Query params:
      date — date in YYYY-MM-DD format (default: today)
    """
    date = _fmt_date(request.args.get("date", "")) or datetime.now().strftime("%Y-%m-%d")

    if not _ensure_login():
        return jsonify({"error": "BaoStock unavailable"}), 503

    try:
        rs = bs.query_sz50_stocks(date=date)
        fields = rs.fields if hasattr(rs, "fields") else []
        rows = _collect_rows(rs)
        stocks = []
        for row in rows:
            entry = dict(zip(fields, row)) if fields else {}
            if "code" in entry:
                entry["symbol"] = _to_short_code(entry["code"])
            stocks.append(entry)

        return jsonify({"stocks": stocks, "total": len(stocks), "index": "sz50", "date": date})
    except Exception:
        logger.exception("BaoStock sz50 error")
        return jsonify({"error": "Internal error"}), 500


@baostock_bp.route("/index/hs300", methods=["GET"])
def hs300_stocks():
    """
    沪深300成分股 — query_hs300_stocks

    Query params:
      date — date in YYYY-MM-DD format (default: today)
    """
    date = _fmt_date(request.args.get("date", "")) or datetime.now().strftime("%Y-%m-%d")

    if not _ensure_login():
        return jsonify({"error": "BaoStock unavailable"}), 503

    try:
        rs = bs.query_hs300_stocks(date=date)
        fields = rs.fields if hasattr(rs, "fields") else []
        rows = _collect_rows(rs)
        stocks = []
        for row in rows:
            entry = dict(zip(fields, row)) if fields else {}
            if "code" in entry:
                entry["symbol"] = _to_short_code(entry["code"])
            stocks.append(entry)

        return jsonify({"stocks": stocks, "total": len(stocks), "index": "hs300", "date": date})
    except Exception:
        logger.exception("BaoStock hs300 error")
        return jsonify({"error": "Internal error"}), 500


@baostock_bp.route("/index/zz500", methods=["GET"])
def zz500_stocks():
    """
    中证500成分股 — query_zz500_stocks

    Query params:
      date — date in YYYY-MM-DD format (default: today)
    """
    date = _fmt_date(request.args.get("date", "")) or datetime.now().strftime("%Y-%m-%d")

    if not _ensure_login():
        return jsonify({"error": "BaoStock unavailable"}), 503

    try:
        rs = bs.query_zz500_stocks(date=date)
        fields = rs.fields if hasattr(rs, "fields") else []
        rows = _collect_rows(rs)
        stocks = []
        for row in rows:
            entry = dict(zip(fields, row)) if fields else {}
            if "code" in entry:
                entry["symbol"] = _to_short_code(entry["code"])
            stocks.append(entry)

        return jsonify({"stocks": stocks, "total": len(stocks), "index": "zz500", "date": date})
    except Exception:
        logger.exception("BaoStock zz500 error")
        return jsonify({"error": "Internal error"}), 500
