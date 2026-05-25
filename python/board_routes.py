"""
Sector Board Routes for QuantCore Pro

Provides REST endpoints for A-share sector/concept board data via BaoStock.
These endpoints complement the frontend EastMoney board service by offering
server-side board data for scenarios where BaoStock is the preferred source.

Endpoints:
  GET /api/boards/industry   — Industry classification boards (行业板块)
  GET /api/boards/concept    — Concept/theme boards list (概念板块)
  GET /api/boards/stocks     — Stocks belonging to a specific board
"""

from __future__ import annotations

import logging
import time
from datetime import datetime, timedelta

from flask import Blueprint, jsonify, request

logger = logging.getLogger(__name__)

# ---------------------------------------------------------------------------
# BaoStock client (optional)
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


def _to_short_code(bs_code: str) -> str:
    """Convert 'sh.600519' → 'sh600519' (frontend format)."""
    return bs_code.replace(".", "").lower()


# ---------------------------------------------------------------------------
# Blueprint
# ---------------------------------------------------------------------------

board_bp = Blueprint("boards", __name__, url_prefix="/api/boards")


@board_bp.route("/industry", methods=["GET"])
def industry_boards():
    """
    Fetch industry classification boards from BaoStock.

    Returns a list of industries with their codes and names.
    """
    if not _ensure_login():
        return jsonify({"error": "BaoStock unavailable", "boards": []}), 503

    try:
        rs = bs.query_stock_industry()
        boards_map: dict[str, dict] = {}

        while rs.error_code == "0" and rs.next():
            row = rs.get_row_data()
            if len(row) < 4:
                continue
            # row: [updateDate, code, code_name, industry, industryClassification]
            industry = row[3] if len(row) > 3 else ""
            if not industry:
                continue
            if industry not in boards_map:
                boards_map[industry] = {
                    "name": industry,
                    "stockCount": 0,
                    "stocks": [],
                }
            boards_map[industry]["stockCount"] += 1
            if len(boards_map[industry]["stocks"]) < 5:
                boards_map[industry]["stocks"].append({
                    "symbol": _to_short_code(row[1]),
                    "name": row[2],
                })

        boards = sorted(boards_map.values(), key=lambda b: b["stockCount"], reverse=True)
        return jsonify({"boards": boards})
    except Exception:
        logger.exception("BaoStock industry boards error")
        return jsonify({"error": "Internal error", "boards": []}), 500


@board_bp.route("/stocks", methods=["GET"])
def board_stocks():
    """
    Fetch stocks belonging to a specific industry board from BaoStock.

    Query params:
      industry — Industry name (e.g. "银行")
      date     — Optional date in YYYY-MM-DD format (default: today)
    """
    industry = request.args.get("industry", "").strip()
    if not industry:
        return jsonify({"error": "industry parameter required"}), 400

    if not _ensure_login():
        return jsonify({"error": "BaoStock unavailable", "stocks": []}), 503

    try:
        rs = bs.query_stock_industry()
        stocks = []

        while rs.error_code == "0" and rs.next():
            row = rs.get_row_data()
            if len(row) < 4:
                continue
            if row[3] == industry:
                stocks.append({
                    "symbol": _to_short_code(row[1]),
                    "name": row[2],
                })

        return jsonify({"stocks": stocks, "industry": industry})
    except Exception:
        logger.exception("BaoStock board stocks error for %s", industry)
        return jsonify({"error": "Internal error", "stocks": []}), 500


@board_bp.route("/stock-performance", methods=["GET"])
def stock_performance():
    """
    Fetch recent performance data for a list of stocks.
    Useful for computing sector/board aggregate performance.

    Query params:
      symbols — Comma-separated symbols, e.g. "sh600519,sz000858"
      days    — Number of days to look back (default: 5)
    """
    symbols_raw = request.args.get("symbols", "").strip()
    if not symbols_raw:
        return jsonify({"error": "symbols parameter required"}), 400

    symbols = [s.strip() for s in symbols_raw.split(",") if s.strip()]
    days = int(request.args.get("days", "5"))

    if not _ensure_login():
        return jsonify({"error": "BaoStock unavailable", "performance": []}), 503

    end_date = datetime.now().strftime("%Y-%m-%d")
    start_date = (datetime.now() - timedelta(days=days + 5)).strftime("%Y-%m-%d")

    performance = []
    for raw_sym in symbols:
        bs_code = raw_sym.strip().lower()
        if "." not in bs_code:
            bs_code = bs_code[:2] + "." + bs_code[2:]
        short = _to_short_code(bs_code)

        try:
            rs = bs.query_history_k_data_plus(
                bs_code,
                "date,code,close,pctChg",
                start_date=start_date,
                end_date=end_date,
                frequency="d",
                adjustflag="2",
            )
            rows = []
            while rs.error_code == "0" and rs.next():
                rows.append(rs.get_row_data())

            if not rows:
                continue

            # Latest row
            latest = rows[-1]
            price = float(latest[2]) if latest[2] else 0.0
            pct = float(latest[3]) if latest[3] else 0.0

            performance.append({
                "symbol": short,
                "price": price,
                "changePercent": pct,
                "days": len(rows),
            })
        except Exception:
            logger.exception("BaoStock performance error for %s", raw_sym)

    return jsonify({"performance": performance})
