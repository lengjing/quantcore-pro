"""BaoStock REST routes for QuantCore Pro."""

from __future__ import annotations

import datetime as dt
from typing import Any

import baostock as bs
from flask import Blueprint, jsonify, request

baostock_bp = Blueprint("baostock", __name__, url_prefix="/api/baostock")

_PERIOD_MAP = {
    "daily": "d",
    "weekly": "w",
    "monthly": "m",
}

_ADJUST_MAP = {
    "qfq": "2",
    "hfq": "1",
    "": "3",
}


def _parse_symbol(symbol: str) -> tuple[str, str]:
    symbol = symbol.strip().lower()
    if symbol.startswith("sh"):
        return f"sh.{symbol[2:]}", symbol
    if symbol.startswith("sz"):
        return f"sz.{symbol[2:]}", symbol
    raise ValueError(f"Invalid symbol: {symbol}")


def _with_login(fn):
    def wrapper(*args, **kwargs):
        lg = bs.login()
        if lg.error_code != "0":
            return jsonify({"error": lg.error_msg}), 500
        try:
            return fn(*args, **kwargs)
        finally:
            bs.logout()

    wrapper.__name__ = fn.__name__
    return wrapper


def _safe_float(value: Any, default: float = 0.0) -> float:
    try:
        if value is None or value == "":
            return default
        return float(value)
    except (TypeError, ValueError):
        return default


@baostock_bp.get("/snapshot")
@_with_login
def snapshot():
    symbols_param = request.args.get("symbols", "")
    symbols = [s.strip() for s in symbols_param.split(",") if s.strip()]
    if not symbols:
        return jsonify({"snapshots": []})

    today = dt.date.today().strftime("%Y-%m-%d")
    snapshots = []

    for symbol in symbols:
        try:
            bs_code, ui_symbol = _parse_symbol(symbol)
        except ValueError:
            continue

        rs = bs.query_history_k_data_plus(
            bs_code,
            "date,code,open,high,low,close,preclose,volume,amount",
            start_date=today,
            end_date=today,
            frequency="d",
            adjustflag="3",
        )
        if rs.error_code != "0":
            continue

        row = None
        while rs.next():
            row = rs.get_row_data()
            break

        if not row:
            rs = bs.query_history_k_data_plus(
                bs_code,
                "date,code,open,high,low,close,preclose,volume,amount",
                start_date=(dt.date.today() - dt.timedelta(days=10)).strftime("%Y-%m-%d"),
                end_date=today,
                frequency="d",
                adjustflag="3",
            )
            if rs.error_code != "0":
                continue
            last = None
            while rs.next():
                last = rs.get_row_data()
            row = last

        if not row:
            continue

        open_p = _safe_float(row[2])
        high = _safe_float(row[3])
        low = _safe_float(row[4])
        close = _safe_float(row[5])
        prev_close = _safe_float(row[6], close)
        volume = _safe_float(row[7]) / 100  # shares -> lots
        amount = _safe_float(row[8])
        change = close - prev_close if prev_close else 0.0
        change_pct = (change / prev_close * 100) if prev_close else 0.0

        name_rs = bs.query_stock_basic(code=bs_code)
        name = ui_symbol
        if name_rs.error_code == "0" and name_rs.next():
            name = name_rs.get_row_data()[1] or ui_symbol

        snapshots.append(
            {
                "symbol": ui_symbol,
                "name": name,
                "price": close,
                "open": open_p,
                "prevClose": prev_close,
                "high": high,
                "low": low,
                "volume": volume,
                "amount": amount,
                "change": change,
                "changePercent": change_pct,
                "timestamp": int(dt.datetime.now().timestamp() * 1000),
            }
        )

    return jsonify({"snapshots": snapshots})


@baostock_bp.get("/klines/daily")
@_with_login
def daily_klines():
    symbol = request.args.get("symbol", "")
    period = request.args.get("period", "daily")
    start = request.args.get("start", "")
    end = request.args.get("end", "")
    adjust = request.args.get("adjust", "qfq")

    try:
        bs_code, _ = _parse_symbol(symbol)
    except ValueError as exc:
        return jsonify({"error": str(exc)}), 400

    freq = _PERIOD_MAP.get(period, "d")
    adjustflag = _ADJUST_MAP.get(adjust, "2")

    rs = bs.query_history_k_data_plus(
        bs_code,
        "date,open,high,low,close,volume",
        start_date=start,
        end_date=end,
        frequency=freq,
        adjustflag=adjustflag,
    )
    if rs.error_code != "0":
        return jsonify({"error": rs.error_msg}), 500

    klines = []
    while rs.next():
        row = rs.get_row_data()
        klines.append(
            {
                "time": row[0],
                "open": _safe_float(row[1]),
                "high": _safe_float(row[2]),
                "low": _safe_float(row[3]),
                "close": _safe_float(row[4]),
                "volume": _safe_float(row[5]) / 100,
            }
        )

    return jsonify({"klines": klines})


@baostock_bp.get("/klines/minute")
@_with_login
def minute_klines():
    symbol = request.args.get("symbol", "")
    period = request.args.get("period", "5")

    try:
        bs_code, _ = _parse_symbol(symbol)
    except ValueError as exc:
        return jsonify({"error": str(exc)}), 400

    end_dt = dt.datetime.now()
    start_dt = end_dt - dt.timedelta(days=5)

    rs = bs.query_history_k_data_plus(
        bs_code,
        "date,time,open,high,low,close,volume",
        start_date=start_dt.strftime("%Y-%m-%d"),
        end_date=end_dt.strftime("%Y-%m-%d"),
        frequency=period,
        adjustflag="3",
    )
    if rs.error_code != "0":
        return jsonify({"error": rs.error_msg}), 500

    klines = []
    while rs.next():
        row = rs.get_row_data()
        time_str = f"{row[0]} {row[1][:2]}:{row[1][2:4]}:{row[1][4:6]}"
        klines.append(
            {
                "time": time_str,
                "open": _safe_float(row[2]),
                "high": _safe_float(row[3]),
                "low": _safe_float(row[4]),
                "close": _safe_float(row[5]),
                "volume": _safe_float(row[6]) / 100,
            }
        )

    return jsonify({"klines": klines})
