"""
Agent Routes for QuantCore Pro

Provides REST endpoints consumed by the quantcore-pro MCP skill (mcp/quantcore/).
These routes expose system-level operations — watchlist management, paper trading,
backtesting, and stock queries — as a simple HTTP API so that Claude Code (via MCP)
can read and control the QuantCore Pro system without touching the browser.

In-memory state (watchlist + portfolio) can be pre-seeded from the React frontend
via the POST /api/agent/sync endpoint, which the app calls on startup.

Endpoints:
  GET    /api/agent/watchlist           — Get current watchlist
  POST   /api/agent/watchlist           — Add symbols to watchlist
  DELETE /api/agent/watchlist/<symbol>  — Remove a symbol from watchlist
  GET    /api/agent/portfolio           — Get current paper-trade positions
  POST   /api/agent/trade               — Execute a paper trade
  GET    /api/agent/stock/<symbol>      — Get latest data for a symbol (via BaoStock)
  POST   /api/agent/backtest            — Run a simple MA-crossover backtest
  POST   /api/agent/sync                — Sync state from frontend
"""

from __future__ import annotations

import logging
from datetime import datetime, timedelta
from typing import Any

from flask import Blueprint, jsonify, request

logger = logging.getLogger(__name__)

# ---------------------------------------------------------------------------
# BaoStock client (shared helper — optional)
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


def _to_bs_code(symbol: str) -> str:
    s = symbol.strip().lower()
    if "." in s:
        return s
    if s.startswith("sh") or s.startswith("sz"):
        return s[:2] + "." + s[2:]
    return s


def _latest_close(symbol: str) -> float | None:
    if not _ensure_login():
        return None
    bs_code = _to_bs_code(symbol)
    today = datetime.now().strftime("%Y-%m-%d")
    start = (datetime.now() - timedelta(days=7)).strftime("%Y-%m-%d")
    try:
        rs = bs.query_history_k_data_plus(
            bs_code, "close",
            start_date=start, end_date=today,
            frequency="d", adjustflag="3",
        )
        rows: list[list[str]] = []
        while rs.error_code == "0" and rs.next():
            rows.append(rs.get_row_data())
        if rows and rows[-1][0]:
            return float(rows[-1][0])
    except Exception:
        pass
    return None


# ---------------------------------------------------------------------------
# In-memory application state
# ---------------------------------------------------------------------------

_watchlist: list[str] = [
    "sh600519", "sz000858", "sh601318", "sz300750", "sh600036",
]
# symbol → {quantity: float, avg_price: float}
_portfolio: dict[str, dict[str, float]] = {}

# ---------------------------------------------------------------------------
# Blueprint
# ---------------------------------------------------------------------------

agent_bp = Blueprint("agent", __name__, url_prefix="/api/agent")


# ── Watchlist ────────────────────────────────────────────────────────────────

@agent_bp.route("/watchlist", methods=["GET"])
def get_watchlist():
    return jsonify({"watchlist": _watchlist})


@agent_bp.route("/watchlist", methods=["POST"])
def add_to_watchlist():
    body = request.get_json(silent=True) or {}
    symbols: list[str] = body.get("symbols", [])
    added: list[str] = []
    for sym in symbols:
        clean = sym.strip().lower()
        if clean and clean not in _watchlist:
            _watchlist.append(clean)
            added.append(clean)
    return jsonify({"added": added, "watchlist": _watchlist})


@agent_bp.route("/watchlist/<symbol>", methods=["DELETE"])
def remove_from_watchlist(symbol: str):
    clean = symbol.strip().lower()
    if clean in _watchlist:
        _watchlist.remove(clean)
    return jsonify({"removed": clean, "watchlist": _watchlist})


# ── Portfolio / Trading ───────────────────────────────────────────────────────

@agent_bp.route("/portfolio", methods=["GET"])
def get_portfolio():
    positions: list[dict[str, Any]] = []
    for sym, pos in _portfolio.items():
        current = _latest_close(sym) or pos["avg_price"]
        pnl = (current - pos["avg_price"]) * pos["quantity"]
        pnl_pct = (
            pnl / (pos["avg_price"] * pos["quantity"]) * 100
            if pos["avg_price"] > 0 and pos["quantity"] > 0
            else 0.0
        )
        positions.append(
            {
                "symbol": sym,
                "quantity": pos["quantity"],
                "avgPrice": pos["avg_price"],
                "currentPrice": current,
                "pnl": round(pnl, 2),
                "pnlPercent": round(pnl_pct, 2),
            }
        )
    return jsonify({"positions": positions})


@agent_bp.route("/trade", methods=["POST"])
def execute_trade():
    """
    Execute a paper trade and update the server-side portfolio.

    Body (JSON):
      symbol    — e.g. "sh600519"
      side      — "BUY" | "SELL"
      quantity  — number of lots (手)
      price     — limit price (optional; uses latest close if omitted)
    """
    body = request.get_json(silent=True) or {}
    symbol = body.get("symbol", "").strip().lower()
    side = body.get("side", "").upper()
    qty_raw = body.get("quantity", 0)
    price_raw = body.get("price")

    if not symbol or side not in ("BUY", "SELL"):
        return jsonify({"error": "symbol and side (BUY|SELL) are required"}), 400

    try:
        qty = float(qty_raw)
    except (TypeError, ValueError):
        return jsonify({"error": "quantity must be a number"}), 400
    if qty <= 0:
        return jsonify({"error": "quantity must be > 0"}), 400

    if price_raw is not None:
        try:
            price = float(price_raw)
        except (TypeError, ValueError):
            return jsonify({"error": "price must be a number"}), 400
    else:
        price = _latest_close(symbol)
        if price is None:
            return jsonify({"error": f"Could not fetch current price for {symbol}"}), 400

    if side == "BUY":
        if symbol in _portfolio:
            existing = _portfolio[symbol]
            total_cost = existing["quantity"] * existing["avg_price"] + qty * price
            new_qty = existing["quantity"] + qty
            _portfolio[symbol] = {"quantity": new_qty, "avg_price": total_cost / new_qty}
        else:
            _portfolio[symbol] = {"quantity": qty, "avg_price": price}
    else:  # SELL
        if symbol not in _portfolio:
            return jsonify({"error": f"No open position in {symbol}"}), 400
        new_qty = _portfolio[symbol]["quantity"] - qty
        if new_qty <= 1e-9:
            del _portfolio[symbol]
        else:
            _portfolio[symbol]["quantity"] = new_qty

    return jsonify(
        {
            "success": True,
            "trade": {"symbol": symbol, "side": side, "quantity": qty, "price": price},
            "portfolioSymbols": list(_portfolio.keys()),
        }
    )


# ── Stock query ──────────────────────────────────────────────────────────────

@agent_bp.route("/stock/<symbol>", methods=["GET"])
def query_stock(symbol: str):
    """Return the latest end-of-day data for a single symbol."""
    sym = symbol.strip().lower()
    if not _ensure_login():
        return jsonify({"error": "BaoStock unavailable"}), 503

    bs_code = _to_bs_code(sym)
    today = datetime.now().strftime("%Y-%m-%d")
    start = (datetime.now() - timedelta(days=7)).strftime("%Y-%m-%d")
    try:
        rs = bs.query_history_k_data_plus(
            bs_code,
            "date,open,high,low,close,volume,amount,pctChg",
            start_date=start, end_date=today,
            frequency="d", adjustflag="3",
        )
        rows: list[list[str]] = []
        while rs.error_code == "0" and rs.next():
            rows.append(rs.get_row_data())

        if not rows:
            return jsonify({"error": f"No data found for {sym}"}), 404

        date, open_, high, low, close, volume, amount, pct_chg = rows[-1]
        return jsonify(
            {
                "symbol": sym,
                "date": date,
                "open": float(open_) if open_ else None,
                "high": float(high) if high else None,
                "low": float(low) if low else None,
                "close": float(close) if close else None,
                "volume": float(volume) if volume else None,
                "amount": float(amount) if amount else None,
                "changePercent": float(pct_chg) if pct_chg else None,
            }
        )
    except Exception:
        logger.exception("agent query_stock error for %s", sym)
        return jsonify({"error": "Internal error"}), 500


# ── Backtest ─────────────────────────────────────────────────────────────────

@agent_bp.route("/backtest", methods=["POST"])
def run_backtest():
    """
    Run a simple dual-MA crossover backtest on a symbol using BaoStock data.

    Body (JSON):
      symbol       — e.g. "sh600519"                (default: "sh600519")
      start        — start date YYYY-MM-DD           (default: 1 year ago)
      end          — end date YYYY-MM-DD             (default: today)
      fast_period  — fast MA window                  (default: 5)
      slow_period  — slow MA window                  (default: 20)
    """
    body = request.get_json(silent=True) or {}
    symbol = body.get("symbol", "sh600519").strip().lower()
    start = body.get("start", (datetime.now() - timedelta(days=365)).strftime("%Y-%m-%d"))
    end = body.get("end", datetime.now().strftime("%Y-%m-%d"))
    fast = max(2, int(body.get("fast_period", 5)))
    slow = max(fast + 1, int(body.get("slow_period", 20)))

    if not _ensure_login():
        return jsonify({"error": "BaoStock unavailable"}), 503

    bs_code = _to_bs_code(symbol)
    try:
        rs = bs.query_history_k_data_plus(
            bs_code, "date,close",
            start_date=start, end_date=end,
            frequency="d", adjustflag="2",  # forward-adjusted for backtesting
        )
        rows: list[list[str]] = []
        while rs.error_code == "0" and rs.next():
            rows.append(rs.get_row_data())
    except Exception:
        logger.exception("backtest fetch error for %s", symbol)
        return jsonify({"error": "Internal error"}), 500

    if len(rows) < slow + 1:
        return jsonify({"error": f"Not enough data ({len(rows)} rows, need >{slow})"}), 400

    dates = [r[0] for r in rows]
    closes: list[float] = []
    for r in rows:
        try:
            closes.append(float(r[1]))
        except (ValueError, TypeError):
            closes.append(closes[-1] if closes else 0.0)

    trades: list[dict[str, Any]] = []
    position = 0.0
    entry_price = 0.0
    trade_returns: list[float] = []

    for i in range(slow, len(closes)):
        fast_ma = sum(closes[i - fast:i]) / fast
        slow_ma = sum(closes[i - slow:i]) / slow
        prev_fast = sum(closes[i - fast - 1:i - 1]) / fast
        prev_slow = sum(closes[i - slow - 1:i - 1]) / slow
        price = closes[i]

        if prev_fast <= prev_slow and fast_ma > slow_ma and position == 0:
            position = 1.0
            entry_price = price
            trades.append({"date": dates[i], "action": "BUY", "price": price})
        elif prev_fast >= prev_slow and fast_ma < slow_ma and position > 0:
            ret = (price - entry_price) / entry_price * 100
            trade_returns.append(ret)
            trades.append(
                {"date": dates[i], "action": "SELL", "price": price, "returnPct": round(ret, 2)}
            )
            position = 0.0

    return jsonify(
        {
            "symbol": symbol,
            "strategy": f"MA{fast}/MA{slow} crossover",
            "start": start,
            "end": end,
            "totalBars": len(closes),
            "totalTrades": len(trade_returns),
            "finalReturnPct": round(sum(trade_returns), 2),
            "winRate": round(
                sum(1 for r in trade_returns if r > 0) / len(trade_returns) * 100, 1
            ) if trade_returns else 0.0,
            "recentTrades": trades[-20:],
        }
    )


# ── State sync ───────────────────────────────────────────────────────────────

@agent_bp.route("/sync", methods=["POST"])
def sync_state():
    """
    Accept a state snapshot from the React frontend to seed server-side state.

    Body (JSON):
      watchlist  — list of stock symbol strings
      positions  — list of {symbol, quantity, avgPrice, currentPrice}
    """
    global _watchlist, _portfolio
    body = request.get_json(silent=True) or {}

    if "watchlist" in body:
        _watchlist = [s.strip().lower() for s in body["watchlist"] if s]

    if "positions" in body:
        _portfolio = {}
        for pos in body.get("positions", []):
            sym = pos.get("symbol", "").strip().lower()
            if sym:
                _portfolio[sym] = {
                    "quantity": float(pos.get("quantity", 0)),
                    "avg_price": float(pos.get("avgPrice", 0)),
                }

    return jsonify(
        {
            "status": "synced",
            "watchlistCount": len(_watchlist),
            "portfolioCount": len(_portfolio),
        }
    )
