"""
Strategy File Management Routes for QuantCore Pro

Provides REST endpoints for VS Code-like strategy file management on the local
filesystem. Strategy files are stored under a configurable workspace directory.

Endpoints:
  GET    /api/strategy/files           — List all files/folders in workspace (tree)
  GET    /api/strategy/file            — Read a single file
  POST   /api/strategy/file            — Create a new file or folder
  PUT    /api/strategy/file            — Update (save) a file
  DELETE /api/strategy/file            — Delete a file or folder
  POST   /api/strategy/rename          — Rename / move a file or folder
  POST   /api/strategy/execute         — Execute a Python strategy file
"""

from __future__ import annotations

import io
import logging
import os
import shutil
import sys
import traceback
from contextlib import redirect_stdout, redirect_stderr
from pathlib import Path

from flask import Blueprint, jsonify, request

logger = logging.getLogger(__name__)

# ---------------------------------------------------------------------------
# Workspace configuration
# ---------------------------------------------------------------------------

_DEFAULT_WORKSPACE = os.path.join(os.path.expanduser("~"), "quantcore-strategies")


def _workspace_dir() -> str:
    """Return the resolved workspace directory, creating it if needed."""
    ws = os.environ.get("QUANTCORE_STRATEGY_DIR", _DEFAULT_WORKSPACE)
    os.makedirs(ws, exist_ok=True)
    return os.path.realpath(ws)


def _safe_path(relative: str) -> str | None:
    """
    Resolve a relative path inside the workspace, rejecting path traversal.
    Returns the absolute path or None if the path escapes the workspace.
    """
    ws = _workspace_dir()
    resolved = os.path.realpath(os.path.join(ws, relative))
    if not resolved.startswith(ws):
        return None
    return resolved


# ---------------------------------------------------------------------------
# Default template files
# ---------------------------------------------------------------------------

_DEFAULT_MAIN_PY = '''"""
QuantCore Pro — Strategy Template
==================================
This is a starter template for writing quantitative strategies.

Available modules (pre-imported via the execution environment):
  - baostock as bs   : A-share market data
  - pandas as pd     : Data manipulation
  - numpy as np      : Numerical computing

Usage:
  1. Edit this file in the Strategy IDE
  2. Click "RUN" to execute
  3. View output in the console below
"""

import baostock as bs
import pandas as pd

# Login to BaoStock
lg = bs.login()
print(f"BaoStock login: code={lg.error_code}, msg={lg.error_msg}")

# Fetch daily klines for 贵州茅台
symbol = "sh.600519"
rs = bs.query_history_k_data_plus(
    symbol,
    "date,open,high,low,close,volume",
    start_date="2024-01-01",
    end_date="2024-12-31",
    frequency="d",
    adjustflag="2",  # 前复权
)

data = []
while rs.error_code == "0" and rs.next():
    data.append(rs.get_row_data())

df = pd.DataFrame(data, columns=["date", "open", "high", "low", "close", "volume"])
df[["open", "high", "low", "close", "volume"]] = df[["open", "high", "low", "close", "volume"]].apply(pd.to_numeric)

print(f"\\nLoaded {len(df)} bars for {symbol}")
print(f"Date range: {df['date'].iloc[0]} — {df['date'].iloc[-1]}")
print(f"Close range: {df['close'].min():.2f} — {df['close'].max():.2f}")
print(f"\\nLast 5 bars:")
print(df.tail().to_string(index=False))

# Simple MA crossover signal
df["ma5"] = df["close"].rolling(5).mean()
df["ma20"] = df["close"].rolling(20).mean()
df["signal"] = 0
df.loc[df["ma5"] > df["ma20"], "signal"] = 1
df.loc[df["ma5"] < df["ma20"], "signal"] = -1

buy_signals = (df["signal"].diff() == 2).sum()
sell_signals = (df["signal"].diff() == -2).sum()
print(f"\\nMA5/MA20 Crossover signals: BUY={buy_signals}, SELL={sell_signals}")

bs.logout()
print("\\nDone.")
'''

_DEFAULT_CONFIG_JSON = '''{
  "strategy": {
    "name": "MA Crossover",
    "version": "1.0.0",
    "author": "QuantCore User",
    "description": "Simple dual moving average crossover strategy"
  },
  "parameters": {
    "fast_period": 5,
    "slow_period": 20,
    "symbol": "sh.600519",
    "start_date": "2024-01-01",
    "end_date": "2024-12-31"
  },
  "risk": {
    "max_position_pct": 0.3,
    "stop_loss_pct": 0.05,
    "take_profit_pct": 0.15
  }
}
'''


def _ensure_defaults() -> None:
    """Create default template files if workspace is empty."""
    ws = _workspace_dir()
    if os.listdir(ws):
        return
    # Create default files
    with open(os.path.join(ws, "main.py"), "w", encoding="utf-8") as f:
        f.write(_DEFAULT_MAIN_PY)
    with open(os.path.join(ws, "config.json"), "w", encoding="utf-8") as f:
        f.write(_DEFAULT_CONFIG_JSON)
    # Create examples subfolder
    examples = os.path.join(ws, "examples")
    os.makedirs(examples, exist_ok=True)


# ---------------------------------------------------------------------------
# Blueprint
# ---------------------------------------------------------------------------

strategy_bp = Blueprint("strategy", __name__, url_prefix="/api/strategy")


@strategy_bp.route("/files", methods=["GET"])
def list_files():
    """
    List all files and folders in the workspace as a tree structure.

    Returns a flat list of entries with path, type, and metadata.
    """
    _ensure_defaults()
    ws = _workspace_dir()
    entries: list[dict] = []

    for root, dirs, files in os.walk(ws):
        # Skip hidden directories
        dirs[:] = [d for d in dirs if not d.startswith(".")]
        rel_root = os.path.relpath(root, ws)
        if rel_root == ".":
            rel_root = ""

        # Add directories
        for d in sorted(dirs):
            rel_path = os.path.join(rel_root, d) if rel_root else d
            entries.append({
                "path": rel_path.replace(os.sep, "/"),
                "type": "directory",
                "name": d,
            })

        # Add files
        for fname in sorted(files):
            if fname.startswith("."):
                continue
            rel_path = os.path.join(rel_root, fname) if rel_root else fname
            full_path = os.path.join(root, fname)
            try:
                size = os.path.getsize(full_path)
                mtime = os.path.getmtime(full_path)
            except OSError:
                size = 0
                mtime = 0
            entries.append({
                "path": rel_path.replace(os.sep, "/"),
                "type": "file",
                "name": fname,
                "size": size,
                "modified": mtime,
            })

    return jsonify({"workspace": ws, "entries": entries})


@strategy_bp.route("/file", methods=["GET"])
def read_file():
    """
    Read a single file from the workspace.

    Query params:
      path — relative path within workspace (e.g. "main.py" or "utils/helpers.py")
    """
    rel_path = request.args.get("path", "").strip()
    if not rel_path:
        return jsonify({"error": "path parameter required"}), 400

    abs_path = _safe_path(rel_path)
    if abs_path is None:
        return jsonify({"error": "Invalid path"}), 403

    if not os.path.isfile(abs_path):
        return jsonify({"error": f"File not found: {rel_path}"}), 404

    try:
        with open(abs_path, "r", encoding="utf-8") as f:
            content = f.read()
        return jsonify({
            "path": rel_path,
            "content": content,
            "size": len(content),
        })
    except Exception:
        logger.exception("Error reading file: %s", rel_path)
        return jsonify({"error": "Read error"}), 500


@strategy_bp.route("/file", methods=["POST"])
def create_file():
    """
    Create a new file or folder in the workspace.

    Body (JSON):
      path    — relative path (e.g. "strategies/my_strategy.py")
      type    — "file" | "directory" (default: "file")
      content — file content (optional, default: "")
    """
    body = request.get_json(silent=True) or {}
    rel_path = body.get("path", "").strip()
    entry_type = body.get("type", "file")
    content = body.get("content", "")

    if not rel_path:
        return jsonify({"error": "path is required"}), 400

    abs_path = _safe_path(rel_path)
    if abs_path is None:
        return jsonify({"error": "Invalid path"}), 403

    if os.path.exists(abs_path):
        return jsonify({"error": f"Already exists: {rel_path}"}), 409

    try:
        if entry_type == "directory":
            os.makedirs(abs_path, exist_ok=True)
        else:
            # Ensure parent directory exists
            os.makedirs(os.path.dirname(abs_path), exist_ok=True)
            with open(abs_path, "w", encoding="utf-8") as f:
                f.write(content)

        return jsonify({"success": True, "path": rel_path, "type": entry_type})
    except Exception:
        logger.exception("Error creating %s: %s", entry_type, rel_path)
        return jsonify({"error": "Create error"}), 500


@strategy_bp.route("/file", methods=["PUT"])
def update_file():
    """
    Update (save) a file in the workspace.

    Body (JSON):
      path    — relative path
      content — new file content
    """
    body = request.get_json(silent=True) or {}
    rel_path = body.get("path", "").strip()
    content = body.get("content", "")

    if not rel_path:
        return jsonify({"error": "path is required"}), 400

    abs_path = _safe_path(rel_path)
    if abs_path is None:
        return jsonify({"error": "Invalid path"}), 403

    if not os.path.isfile(abs_path):
        return jsonify({"error": f"File not found: {rel_path}"}), 404

    try:
        with open(abs_path, "w", encoding="utf-8") as f:
            f.write(content)
        return jsonify({"success": True, "path": rel_path, "size": len(content)})
    except Exception:
        logger.exception("Error saving file: %s", rel_path)
        return jsonify({"error": "Save error"}), 500


@strategy_bp.route("/file", methods=["DELETE"])
def delete_file():
    """
    Delete a file or folder from the workspace.

    Query params:
      path — relative path to delete
    """
    rel_path = request.args.get("path", "").strip()
    if not rel_path:
        return jsonify({"error": "path parameter required"}), 400

    abs_path = _safe_path(rel_path)
    if abs_path is None:
        return jsonify({"error": "Invalid path"}), 403

    ws = _workspace_dir()
    if abs_path == ws:
        return jsonify({"error": "Cannot delete workspace root"}), 403

    if not os.path.exists(abs_path):
        return jsonify({"error": f"Not found: {rel_path}"}), 404

    try:
        if os.path.isdir(abs_path):
            shutil.rmtree(abs_path)
        else:
            os.remove(abs_path)
        return jsonify({"success": True, "deleted": rel_path})
    except Exception:
        logger.exception("Error deleting: %s", rel_path)
        return jsonify({"error": "Delete error"}), 500


@strategy_bp.route("/rename", methods=["POST"])
def rename_file():
    """
    Rename or move a file/folder within the workspace.

    Body (JSON):
      oldPath — current relative path
      newPath — new relative path
    """
    body = request.get_json(silent=True) or {}
    old_rel = body.get("oldPath", "").strip()
    new_rel = body.get("newPath", "").strip()

    if not old_rel or not new_rel:
        return jsonify({"error": "oldPath and newPath are required"}), 400

    old_abs = _safe_path(old_rel)
    new_abs = _safe_path(new_rel)

    if old_abs is None or new_abs is None:
        return jsonify({"error": "Invalid path"}), 403

    if not os.path.exists(old_abs):
        return jsonify({"error": f"Not found: {old_rel}"}), 404

    if os.path.exists(new_abs):
        return jsonify({"error": f"Already exists: {new_rel}"}), 409

    try:
        os.makedirs(os.path.dirname(new_abs), exist_ok=True)
        os.rename(old_abs, new_abs)
        return jsonify({"success": True, "oldPath": old_rel, "newPath": new_rel})
    except Exception:
        logger.exception("Error renaming %s → %s", old_rel, new_rel)
        return jsonify({"error": "Rename error"}), 500


@strategy_bp.route("/execute", methods=["POST"])
def execute_strategy():
    """
    Execute a Python strategy file or inline code snippet.

    Body (JSON):
      path — relative path to the file to execute (optional if code is provided)
      code — inline Python code to execute (optional if path is provided)

    Returns:
      stdout  — captured standard output
      stderr  — captured standard error
      success — whether execution completed without errors
      variables — list of user-defined variables after execution
    """
    body = request.get_json(silent=True) or {}
    rel_path = body.get("path", "").strip()
    code = body.get("code", "").strip()

    # Determine the code to execute
    if rel_path:
        abs_path = _safe_path(rel_path)
        if abs_path is None:
            return jsonify({"error": "Invalid path"}), 403
        if not os.path.isfile(abs_path):
            return jsonify({"error": f"File not found: {rel_path}"}), 404
        try:
            with open(abs_path, "r", encoding="utf-8") as f:
                code = f.read()
        except Exception:
            return jsonify({"error": "Failed to read file"}), 500
    elif not code:
        return jsonify({"error": "path or code is required"}), 400

    # Execute in a sandboxed namespace.
    # SECURITY NOTE: exec() is used intentionally here — this is a local-only
    # desktop application where the user is running their own strategy code on
    # their own machine. The endpoint is NOT exposed to the internet.
    stdout_buf = io.StringIO()
    stderr_buf = io.StringIO()

    exec_globals: dict = {
        "__builtins__": __builtins__,
        "__name__": "__main__",
    }

    success = True
    with redirect_stdout(stdout_buf), redirect_stderr(stderr_buf):
        try:
            exec(code, exec_globals)  # noqa: S102
        except Exception:
            success = False
            traceback.print_exc(file=stderr_buf)

    # Collect user-defined variables (skip dunder and modules)
    MAX_VAR_REPR_LENGTH = 200
    variables: list[dict] = []
    for name, val in exec_globals.items():
        if name.startswith("_"):
            continue
        try:
            type_name = type(val).__name__
            # Skip modules and callables
            if type_name in ("module", "function", "type", "builtin_function_or_method"):
                continue
            val_repr = repr(val)
            if len(val_repr) > MAX_VAR_REPR_LENGTH:
                val_repr = val_repr[:MAX_VAR_REPR_LENGTH] + "..."
            variables.append({"name": name, "type": type_name, "value": val_repr})
        except Exception:
            pass

    return jsonify({
        "success": success,
        "stdout": stdout_buf.getvalue(),
        "stderr": stderr_buf.getvalue(),
        "variables": variables,
        "output": stdout_buf.getvalue() + (
            ("\n" + stderr_buf.getvalue()) if stderr_buf.getvalue() else ""
        ),
    })
