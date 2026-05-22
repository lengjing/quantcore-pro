"""
AI Routes for QuantCore Pro
Provides a Claude-powered AI assistant with BaoStock skills.

Architecture:
  POST /api/ai/chat   — Agentic chat endpoint.  Runs a multi-turn Claude loop
                        until the model reaches end_turn.  Tool calls (search_stocks,
                        add_sector, add_to_watchlist, get_sectors) are executed
                        server-side; actions that mutate frontend state are returned
                        as structured `actions` for the React app to apply.

  GET  /api/ai/baostock/search   — Direct BaoStock keyword search (for debugging).
  GET  /api/ai/status            — Returns AI/BaoStock readiness flags.
"""

from __future__ import annotations

import json
import logging
import os
import time
from typing import Any

from flask import Blueprint, jsonify, request

logger = logging.getLogger(__name__)

# ---------------------------------------------------------------------------
# Anthropic client (optional — gracefully absent when key not set)
# ---------------------------------------------------------------------------
try:
    import anthropic as _anthropic

    _api_key = os.environ.get("ANTHROPIC_API_KEY", "")
    _claude: "_anthropic.Anthropic | None" = (
        _anthropic.Anthropic(api_key=_api_key) if _api_key else None
    )
except ImportError:
    _anthropic = None  # type: ignore[assignment]
    _claude = None

# ---------------------------------------------------------------------------
# BaoStock client (optional — gracefully absent when package not installed)
# ---------------------------------------------------------------------------
try:
    import baostock as bs  # type: ignore[import-untyped]

    _BS_AVAILABLE = True
except ImportError:
    bs = None  # type: ignore[assignment]
    _BS_AVAILABLE = False

# Simple in-memory cache for the full stock list (refreshed every 4 hours).
_stock_cache: list[dict[str, str]] = []
_stock_cache_ts: float = 0.0
_BS_LOGGED_IN = False

CACHE_TTL = 4 * 60 * 60  # seconds


def _ensure_bs_login() -> bool:
    global _BS_LOGGED_IN
    if not _BS_AVAILABLE:
        return False
    if not _BS_LOGGED_IN:
        lg = bs.login()
        _BS_LOGGED_IN = lg.error_code == "0"
        if not _BS_LOGGED_IN:
            logger.warning("BaoStock login failed: %s %s", lg.error_code, lg.error_msg)
    return _BS_LOGGED_IN


def _load_stock_list() -> list[dict[str, str]]:
    """Fetch the full A-share stock list from BaoStock and cache it."""
    global _stock_cache, _stock_cache_ts
    now = time.time()
    if _stock_cache and now - _stock_cache_ts < CACHE_TTL:
        return _stock_cache

    if not _ensure_bs_login():
        return []

    rs = bs.query_stock_basic()
    rows: list[dict[str, str]] = []
    while rs.error_code == "0" and rs.next():
        row = rs.get_row_data()
        # row fields: code, tradeStatus, secName, ipoDate, outDate, type, status
        if len(row) < 7:
            continue
        code, _, sec_name, _, _, sec_type, status = row[:7]
        # Only keep listed (status==1) equity (type==1) and index (type==2) stocks
        if status == "1" and sec_type in ("1", "2"):
            rows.append(
                {
                    "code": code,  # "sh.600519"
                    "code_short": code.replace(".", ""),  # "sh600519"
                    "name": sec_name,
                }
            )
    _stock_cache = rows
    _stock_cache_ts = now
    logger.info("BaoStock stock list loaded: %d symbols", len(rows))
    return rows


# ---------------------------------------------------------------------------
# Tool implementations
# ---------------------------------------------------------------------------

def _tool_search_stocks(keyword: str) -> dict[str, Any]:
    """Search listed A-share stocks by name or code keyword."""
    if not _BS_AVAILABLE:
        return {"error": "BaoStock not installed", "stocks": []}
    stocks = _load_stock_list()
    if not stocks:
        return {"error": "BaoStock data unavailable", "stocks": []}

    kw = keyword.strip().upper()
    if not kw:
        return {"error": "Empty keyword", "stocks": []}

    matched = [
        s for s in stocks
        if kw in s["name"].upper()
        or kw in s["code"].upper()
        or kw in s["code_short"].upper()
    ]
    # Return at most 60 results so the Claude context stays manageable.
    return {"stocks": matched[:60], "total": len(matched)}


def _tool_get_sectors(context: dict[str, Any]) -> dict[str, Any]:
    custom = context.get("customSectors", [])
    return {
        "customSectors": [
            {"id": s.get("id"), "name": s.get("name"), "symbols": s.get("symbols", [])}
            for s in custom
        ]
    }


# ---------------------------------------------------------------------------
# Claude tool schemas
# ---------------------------------------------------------------------------

TOOLS: list[dict[str, Any]] = [
    {
        "name": "search_stocks",
        "description": (
            "通过关键词在A股全量股票列表中搜索上市公司。"
            "关键词会同时匹配股票名称和代码。"
            "例如搜索'MLCC'可找到片式多层陶瓷电容相关股票，"
            "搜索'射频'可找到射频芯片类股票。"
            "建议每次搜索单一关键词，可多次调用覆盖不同词组。"
        ),
        "input_schema": {
            "type": "object",
            "properties": {
                "keyword": {
                    "type": "string",
                    "description": "搜索关键词，如 'MLCC'、'射频'、'半导体'",
                }
            },
            "required": ["keyword"],
        },
    },
    {
        "name": "add_sector",
        "description": (
            "在 QuantCore Pro 系统中创建一个自定义板块并保存到系统。"
            "调用后，板块会立即出现在行情页面的「板块」标签中，无需用户手动操作。"
        ),
        "input_schema": {
            "type": "object",
            "properties": {
                "name": {
                    "type": "string",
                    "description": "板块中文名称，如「MLCC概念」",
                },
                "nameEn": {
                    "type": "string",
                    "description": "板块英文名称，如「MLCC」",
                },
                "description": {
                    "type": "string",
                    "description": "板块说明（可选）",
                },
                "symbols": {
                    "type": "array",
                    "items": {"type": "string"},
                    "description": (
                        "股票代码列表，使用无点格式：sh600519 或 sz000858。"
                        "请将 BaoStock 返回的 code_short 字段直接使用。"
                    ),
                },
            },
            "required": ["name", "nameEn", "symbols"],
        },
    },
    {
        "name": "get_sectors",
        "description": "获取系统中现有的全部自定义板块列表。",
        "input_schema": {"type": "object", "properties": {}},
    },
    {
        "name": "add_to_watchlist",
        "description": "将指定股票批量加入用户的自选股列表。",
        "input_schema": {
            "type": "object",
            "properties": {
                "symbols": {
                    "type": "array",
                    "items": {"type": "string"},
                    "description": "要加入自选股的代码列表，格式 sh600519 / sz000858",
                }
            },
            "required": ["symbols"],
        },
    },
]

SYSTEM_PROMPT = """\
你是 QuantCore Pro 的专业量化交易 AI 助手，专注于 A 股市场。

你的能力：
1. 使用 search_stocks 在 A 股全量数据库中搜索概念/行业相关股票
2. 使用 add_sector 将搜索结果直接创建为系统板块（无需用户手动确认）
3. 使用 get_sectors 查看已有板块
4. 使用 add_to_watchlist 将股票加入自选股

工作流程示例（用户要求创建「MLCC板块」）：
1. 调用 search_stocks("MLCC") 搜索相关股票
2. 也可以尝试搜索同义词，如 search_stocks("多层陶瓷") 补充结果
3. 综合搜索结果，筛选真正与 MLCC 相关的公司（查看名称确认）
4. 调用 add_sector 创建板块，symbols 使用 code_short 格式
5. 向用户报告创建结果，包括入选股票列表

重要提示：
- add_sector 操作会直接保存到系统，立即生效
- symbols 必须使用 code_short 格式（如 sh600519），不要带点
- 请用中文回复用户
"""

# ---------------------------------------------------------------------------
# Blueprint
# ---------------------------------------------------------------------------

ai_bp = Blueprint("ai", __name__, url_prefix="/api/ai")


@ai_bp.route("/status", methods=["GET"])
def status():
    """Return AI / BaoStock readiness flags."""
    return jsonify(
        {
            "claude": _claude is not None,
            "baostock": _BS_AVAILABLE,
            "baostock_logged_in": _BS_LOGGED_IN,
        }
    )


@ai_bp.route("/baostock/search", methods=["GET"])
def baostock_search():
    """Direct BaoStock search for debugging / testing."""
    keyword = request.args.get("keyword", "").strip()
    if not keyword:
        return jsonify({"error": "keyword parameter required"}), 400
    return jsonify(_tool_search_stocks(keyword))


@ai_bp.route("/chat", methods=["POST"])
def chat():
    """
    Agentic chat endpoint.

    Request body (JSON):
      messages  — list of {role: "user"|"assistant", content: str}
      context   — {customSectors: [...], stockWatchlist: [...]}

    Response body (JSON):
      message   — Claude's final text reply
      actions   — list of frontend mutations to apply
      toolUse   — list of tool-call summaries for the UI
    """
    if _claude is None:
        return (
            jsonify(
                {
                    "error": "ANTHROPIC_API_KEY not configured",
                    "message": (
                        "AI 功能需要配置 ANTHROPIC_API_KEY 环境变量。\n"
                        "请在启动 Python 后端前设置：\n"
                        "  export ANTHROPIC_API_KEY=your_key"
                    ),
                    "actions": [],
                    "toolUse": [],
                }
            ),
            503,
        )

    body = request.get_json(silent=True) or {}
    raw_messages: list[dict[str, Any]] = body.get("messages", [])
    context: dict[str, Any] = body.get("context", {})

    if not raw_messages:
        return jsonify({"error": "messages array is required"}), 400

    # Build system prompt with current app context
    system = SYSTEM_PROMPT
    if context.get("customSectors"):
        sector_summary = json.dumps(
            [{"name": s.get("name"), "id": s.get("id")} for s in context["customSectors"]],
            ensure_ascii=False,
        )
        system += f"\n\n当前已有自定义板块：{sector_summary}"
    if context.get("stockWatchlist"):
        watchlist = context["stockWatchlist"][:30]
        system += f"\n\n当前自选股列表：{', '.join(watchlist)}"

    # Agentic loop ----------------------------------------------------------------
    messages: list[dict[str, Any]] = list(raw_messages)
    actions: list[dict[str, Any]] = []
    tool_use_log: list[dict[str, Any]] = []
    MAX_ITERATIONS = 12

    for _ in range(MAX_ITERATIONS):
        try:
            response = _claude.messages.create(
                model="claude-opus-4-5",
                max_tokens=4096,
                system=system,
                messages=messages,
                tools=TOOLS,  # type: ignore[arg-type]
            )
        except Exception as exc:
            logger.exception("Claude API error")
            return (
                jsonify(
                    {
                        "error": str(exc),
                        "message": f"AI 请求失败：{exc}",
                        "actions": actions,
                        "toolUse": tool_use_log,
                    }
                ),
                500,
            )

        # ── End turn: return final response ────────────────────────────────────
        if response.stop_reason == "end_turn":
            text = ""
            for block in response.content:
                if hasattr(block, "text"):
                    text = block.text
                    break
            return jsonify(
                {"message": text, "actions": actions, "toolUse": tool_use_log}
            )

        # ── Tool use: process each tool call ───────────────────────────────────
        if response.stop_reason == "tool_use":
            tool_results: list[dict[str, Any]] = []

            for block in response.content:
                if not hasattr(block, "type") or block.type != "tool_use":
                    continue

                tool_name: str = block.name
                tool_input: dict[str, Any] = block.input  # type: ignore[assignment]
                tool_id: str = block.id

                if tool_name == "search_stocks":
                    result = _tool_search_stocks(tool_input.get("keyword", ""))
                    tool_use_log.append(
                        {
                            "tool": "search_stocks",
                            "input": tool_input,
                            "output": result,
                        }
                    )
                    raw_result = json.dumps(result, ensure_ascii=False)

                elif tool_name == "add_sector":
                    action = {
                        "type": "ADD_SECTOR",
                        "payload": {
                            "name": tool_input.get("name", ""),
                            "nameEn": tool_input.get("nameEn", ""),
                            "description": tool_input.get("description", ""),
                            "symbols": tool_input.get("symbols", []),
                        },
                    }
                    actions.append(action)
                    tool_use_log.append(
                        {
                            "tool": "add_sector",
                            "input": tool_input,
                            "output": {"success": True},
                        }
                    )
                    raw_result = json.dumps(
                        {
                            "success": True,
                            "message": f"板块「{tool_input.get('name')}」已创建，共{len(tool_input.get('symbols', []))}只股票",
                        },
                        ensure_ascii=False,
                    )

                elif tool_name == "get_sectors":
                    result = _tool_get_sectors(context)
                    tool_use_log.append(
                        {"tool": "get_sectors", "input": {}, "output": result}
                    )
                    raw_result = json.dumps(result, ensure_ascii=False)

                elif tool_name == "add_to_watchlist":
                    symbols: list[str] = tool_input.get("symbols", [])
                    action = {
                        "type": "ADD_TO_WATCHLIST",
                        "payload": {"symbols": symbols},
                    }
                    actions.append(action)
                    tool_use_log.append(
                        {
                            "tool": "add_to_watchlist",
                            "input": tool_input,
                            "output": {"success": True},
                        }
                    )
                    raw_result = json.dumps(
                        {
                            "success": True,
                            "message": f"已将 {len(symbols)} 只股票加入自选股",
                        },
                        ensure_ascii=False,
                    )

                else:
                    raw_result = json.dumps(
                        {"error": f"Unknown tool: {tool_name}"}
                    )

                tool_results.append(
                    {
                        "type": "tool_result",
                        "tool_use_id": tool_id,
                        "content": raw_result,
                    }
                )

            # Append assistant turn + tool results to messages for next iteration
            # Convert SDK content blocks to serialisable dicts
            assistant_content: list[dict[str, Any]] = []
            for block in response.content:
                if hasattr(block, "type"):
                    if block.type == "text":
                        assistant_content.append(
                            {"type": "text", "text": block.text}
                        )
                    elif block.type == "tool_use":
                        assistant_content.append(
                            {
                                "type": "tool_use",
                                "id": block.id,
                                "name": block.name,
                                "input": block.input,
                            }
                        )

            messages.append({"role": "assistant", "content": assistant_content})
            messages.append({"role": "user", "content": tool_results})

        else:
            # Unexpected stop reason; exit loop
            break

    return jsonify(
        {
            "message": "处理超时，请重试。",
            "actions": actions,
            "toolUse": tool_use_log,
        }
    )
