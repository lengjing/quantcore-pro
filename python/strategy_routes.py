"""Strategy file workspace routes for QuantCore Pro."""

from __future__ import annotations

import io
import os
import time
import traceback
from contextlib import redirect_stderr, redirect_stdout
from pathlib import Path

from flask import Blueprint, jsonify, request

strategy_bp = Blueprint("strategy", __name__, url_prefix="/api/strategy")

_WORKSPACE = Path(os.environ.get("STRATEGY_WORKSPACE", Path(__file__).resolve().parent / "workspace"))
_WORKSPACE.mkdir(parents=True, exist_ok=True)


def _safe_path(rel_path: str) -> Path:
    rel_path = rel_path.replace("\\", "/").lstrip("/")
    target = (_WORKSPACE / rel_path).resolve()
    if not str(target).startswith(str(_WORKSPACE.resolve())):
        raise ValueError("Invalid path")
    return target


def _build_tree(directory: Path, base: Path) -> list[dict]:
    entries: list[dict] = []
    for child in sorted(directory.iterdir(), key=lambda p: (p.is_file(), p.name.lower())):
        rel = str(child.relative_to(base)).replace("\\", "/")
        if child.is_dir():
            entries.append(
                {
                    "name": child.name,
                    "path": rel,
                    "type": "directory",
                    "children": _build_tree(child, base),
                }
            )
        else:
            entries.append(
                {
                    "name": child.name,
                    "path": rel,
                    "type": "file",
                    "size": child.stat().st_size,
                }
            )
    return entries


@strategy_bp.get("/files")
def list_files():
    return jsonify({"entries": _build_tree(_WORKSPACE, _WORKSPACE), "workspace": str(_WORKSPACE)})


@strategy_bp.get("/file")
def read_file():
    rel_path = request.args.get("path", "")
    if not rel_path:
        return jsonify({"error": "path required"}), 400
    try:
        target = _safe_path(rel_path)
    except ValueError as exc:
        return jsonify({"error": str(exc)}), 400
    if not target.is_file():
        return jsonify({"error": "file not found"}), 404
    content = target.read_text(encoding="utf-8")
    return jsonify({"content": content, "path": rel_path, "size": target.stat().st_size})


@strategy_bp.post("/file")
def create_file():
    data = request.get_json(silent=True) or {}
    rel_path = data.get("path", "")
    content = data.get("content", "")
    entry_type = data.get("type", "file")
    if not rel_path:
        return jsonify({"error": "path required"}), 400
    try:
        target = _safe_path(rel_path)
    except ValueError as exc:
        return jsonify({"error": str(exc)}), 400

    if entry_type == "directory":
        target.mkdir(parents=True, exist_ok=True)
    else:
        target.parent.mkdir(parents=True, exist_ok=True)
        target.write_text(content, encoding="utf-8")

    return jsonify({"success": True, "path": rel_path})


@strategy_bp.put("/file")
def update_file():
    data = request.get_json(silent=True) or {}
    rel_path = data.get("path", "")
    content = data.get("content", "")
    if not rel_path:
        return jsonify({"error": "path required"}), 400
    try:
        target = _safe_path(rel_path)
    except ValueError as exc:
        return jsonify({"error": str(exc)}), 400
    if not target.is_file():
        return jsonify({"error": "file not found"}), 404
    target.write_text(content, encoding="utf-8")
    return jsonify({"success": True})


@strategy_bp.delete("/file")
def delete_file():
    rel_path = request.args.get("path", "")
    if not rel_path:
        return jsonify({"error": "path required"}), 400
    try:
        target = _safe_path(rel_path)
    except ValueError as exc:
        return jsonify({"error": str(exc)}), 400
    if not target.exists():
        return jsonify({"error": "not found"}), 404
    if target.is_dir():
        import shutil

        shutil.rmtree(target)
    else:
        target.unlink()
    return jsonify({"success": True})


@strategy_bp.post("/rename")
def rename_file():
    data = request.get_json(silent=True) or {}
    old_path = data.get("oldPath", "")
    new_path = data.get("newPath", "")
    if not old_path or not new_path:
        return jsonify({"error": "oldPath and newPath required"}), 400
    try:
        source = _safe_path(old_path)
        dest = _safe_path(new_path)
    except ValueError as exc:
        return jsonify({"error": str(exc)}), 400
    if not source.exists():
        return jsonify({"error": "source not found"}), 404
    dest.parent.mkdir(parents=True, exist_ok=True)
    source.rename(dest)
    return jsonify({"success": True})


@strategy_bp.post("/execute")
def execute_strategy():
    data = request.get_json(silent=True) or {}
    code = data.get("code")
    rel_path = data.get("path")

    if rel_path and not code:
        try:
            code = _safe_path(rel_path).read_text(encoding="utf-8")
        except (ValueError, OSError) as exc:
            return jsonify({"success": False, "stdout": "", "stderr": str(exc), "variables": []})

    if not code:
        return jsonify({"error": "code or path required"}), 400

    stdout_buf = io.StringIO()
    stderr_buf = io.StringIO()
    local_vars: dict = {}
    started = time.time()

    try:
        with redirect_stdout(stdout_buf), redirect_stderr(stderr_buf):
            exec(code, {"__name__": "__main__"}, local_vars)
        success = True
    except Exception:
        success = False
        stderr_buf.write(traceback.format_exc())

    variables = []
    for name, value in local_vars.items():
        if name.startswith("_"):
            continue
        variables.append({"name": name, "type": type(value).__name__, "value": repr(value)[:200]})

    return jsonify(
        {
            "success": success,
            "stdout": stdout_buf.getvalue(),
            "stderr": stderr_buf.getvalue(),
            "variables": variables,
            "duration": round(time.time() - started, 3),
        }
    )
