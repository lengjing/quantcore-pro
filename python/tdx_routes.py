"""Tongdaxin (通达信) data routes via pytdx."""

from __future__ import annotations

import datetime as dt
import threading
from typing import Any

from flask import Blueprint, jsonify, request
from pytdx.hq import TdxHq_API

tdx_bp = Blueprint("tdx", __name__, url_prefix="/api/tdx")

# Public Tongdaxin HQ servers (host, port)
_HQ_SERVERS: list[tuple[str, int]] = [
    ("119.147.212.81", 7709),
    ("114.80.63.12", 7709),
    ("218.75.126.9", 7709),
    ("124.74.236.94", 7709),
    ("115.238.56.198", 7709),
    ("218.80.248.229", 7709),
    ("124.70.75.113", 7709),
    ("124.70.57.20", 7709),
]

_DAILY_CATEGORY = {"daily": 9, "weekly": 5, "monthly": 6}
_MINUTE_CATEGORY = {"1": 8, "5": 0, "15": 1, "30": 2, "60": 3}

_CONNECT_TIMEOUT = 3

_api: TdxHq_API | None = None
_connected_host: str | None = None


def _parse_symbol(symbol: str) -> tuple[int, str, str]:
    symbol = symbol.strip().lower()
    if symbol.startswith("sh"):
        return 1, symbol[2:], symbol
    if symbol.startswith("sz"):
        return 0, symbol[2:], symbol
    raise ValueError(f"Invalid symbol: {symbol}")


def _get_api() -> TdxHq_API | None:
    global _api, _connected_host

    with _lock:
        if _api is not None:
            return _api

        api = TdxHq_API(multithread=True, heartbeat=True)
        for host, port in _HQ_SERVERS:
            try:
                if api.connect(host, port, time_out=_CONNECT_TIMEOUT):
                    _api = api
                    _connected_host = host
                    return _api
            except Exception:
                try:
                    api.disconnect()
                except Exception:
                    pass
                continue

        return None


def _reset_api() -> None:
    global _api, _connected_host
    with _lock:
        if _api is not None:
            try:
                _api.disconnect()
            except Exception:
                pass
        _api = None
        _connected_host = None


def _with_api(fn):
    def wrapper(*args, **kwargs):
        api = _get_api()
        if api is None:
            return jsonify({"error": "unable to connect to Tongdaxin HQ server"}), 503
        try:
            return fn(api, *args, **kwargs)
        except Exception as exc:
            _reset_api()
            return jsonify({"error": str(exc)}), 500

    wrapper.__name__ = fn.__name__
    return wrapper


def _safe_float(value: Any, default: float = 0.0) -> float:
    try:
        if value is None:
            return default
        return float(value)
    except (TypeError, ValueError):
        return default


@tdx_bp.get("/snapshot")
@_with_api
def snapshot(api: TdxHq_API):
    symbols_param = request.args.get("symbols", "")
    symbols = [s.strip() for s in symbols_param.split(",") if s.strip()]
    if not symbols:
        return jsonify({"snapshots": []})

    quotes = []
    batch: list[tuple[int, str]] = []
    symbol_map: dict[tuple[int, str], str] = {}

    for symbol in symbols:
        try:
            market, code, ui_symbol = _parse_symbol(symbol)
        except ValueError:
            continue
        key = (market, code)
        batch.append(key)
        symbol_map[key] = ui_symbol

    if not batch:
        return jsonify({"snapshots": []})

    raw = api.get_security_quotes(batch)
    if not raw:
        return jsonify({"snapshots": []})

    now_ms = int(dt.datetime.now().timestamp() * 1000)

    for item in raw:
        market = item.get("market")
        code = item.get("code")
        ui_symbol = symbol_map.get((market, code), f"{market}{code}")
        price = _safe_float(item.get("price"))
        prev_close = _safe_float(item.get("last_close"), price)
        change = price - prev_close if prev_close else 0.0
        change_pct = (change / prev_close * 100) if prev_close else 0.0
        vol = _safe_float(item.get("vol"))  # already in lots for stocks

        quotes.append(
            {
                "symbol": ui_symbol,
                "name": item.get("name") or ui_symbol,
                "price": price,
                "open": _safe_float(item.get("open")),
                "prevClose": prev_close,
                "high": _safe_float(item.get("high")),
                "low": _safe_float(item.get("low")),
                "volume": vol,
                "amount": _safe_float(item.get("amount")),
                "change": change,
                "changePercent": change_pct,
                "bid": _safe_float(item.get("bid1")),
                "bidSize": _safe_float(item.get("bid_vol1")),
                "ask": _safe_float(item.get("ask1")),
                "askSize": _safe_float(item.get("ask_vol1")),
                "timestamp": now_ms,
            }
        )

    return jsonify({"snapshots": quotes})


@tdx_bp.get("/klines/daily")
@_with_api
def daily_klines(api: TdxHq_API):
    symbol = request.args.get("symbol", "")
    period = request.args.get("period", "daily")
    start = request.args.get("start", "")
    end = request.args.get("end", "")

    try:
        market, code, _ = _parse_symbol(symbol)
    except ValueError as exc:
        return jsonify({"error": str(exc)}), 400

    category = _DAILY_CATEGORY.get(period, 9)
    bars = api.get_security_bars(category, market, code, 0, 800) or []

    klines = []
    for bar in bars:
        time_str = str(bar.get("datetime", ""))[:10]
        if start and time_str < start:
            continue
        if end and time_str > end:
            continue
        klines.append(
            {
                "time": time_str,
                "open": _safe_float(bar.get("open")),
                "high": _safe_float(bar.get("high")),
                "low": _safe_float(bar.get("low")),
                "close": _safe_float(bar.get("close")),
                "volume": _safe_float(bar.get("vol")),
            }
        )

    klines.sort(key=lambda k: k["time"])
    return jsonify({"klines": klines})


@tdx_bp.get("/klines/minute")
@_with_api
def minute_klines(api: TdxHq_API):
    symbol = request.args.get("symbol", "")
    period = request.args.get("period", "5")

    try:
        market, code, _ = _parse_symbol(symbol)
    except ValueError as exc:
        return jsonify({"error": str(exc)}), 400

    category = _MINUTE_CATEGORY.get(period, 0)
    bars = api.get_security_bars(category, market, code, 0, 800) or []

    klines = []
    for bar in bars:
        dt_val = bar.get("datetime")
        if isinstance(dt_val, dt.datetime):
            time_str = dt_val.strftime("%Y-%m-%d %H:%M:%S")
        else:
            time_str = str(dt_val)
        klines.append(
            {
                "time": time_str,
                "open": _safe_float(bar.get("open")),
                "high": _safe_float(bar.get("high")),
                "low": _safe_float(bar.get("low")),
                "close": _safe_float(bar.get("close")),
                "volume": _safe_float(bar.get("vol")),
            }
        )

    klines.sort(key=lambda k: k["time"])
    return jsonify({"klines": klines})
