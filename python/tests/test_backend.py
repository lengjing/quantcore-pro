"""
Tests for QuantCore Pro Python Backend

Covers:
  - Strategy file management (CRUD)
  - BaoStock route parameter validation
  - Strategy execution endpoint
  - Health check
"""

import json
import os
import shutil
import tempfile

import pytest

# Set a temp workspace before importing the app
_TEST_WORKSPACE = tempfile.mkdtemp(prefix="qcp_test_")
os.environ["QUANTCORE_STRATEGY_DIR"] = _TEST_WORKSPACE

import sys
sys.path.insert(0, os.path.join(os.path.dirname(__file__), ".."))

from main import app  # noqa: E402


@pytest.fixture
def client():
    """Flask test client."""
    app.config["TESTING"] = True
    with app.test_client() as c:
        yield c


@pytest.fixture(autouse=True)
def clean_workspace():
    """Ensure workspace is clean before each test."""
    for item in os.listdir(_TEST_WORKSPACE):
        path = os.path.join(_TEST_WORKSPACE, item)
        if os.path.isdir(path):
            shutil.rmtree(path)
        else:
            os.remove(path)
    yield
    for item in os.listdir(_TEST_WORKSPACE):
        path = os.path.join(_TEST_WORKSPACE, item)
        if os.path.isdir(path):
            shutil.rmtree(path)
        else:
            os.remove(path)


# ═══════════════════════════════════════════════════════════════════════════════
# Health check
# ═══════════════════════════════════════════════════════════════════════════════


class TestHealthCheck:
    def test_health_endpoint(self, client):
        resp = client.get("/health")
        assert resp.status_code == 200
        data = resp.get_json()
        assert data["status"] == "healthy"


# ═══════════════════════════════════════════════════════════════════════════════
# Strategy file management
# ═══════════════════════════════════════════════════════════════════════════════


class TestStrategyFiles:
    def test_list_files_creates_defaults(self, client):
        """Empty workspace should get default template files."""
        resp = client.get("/api/strategy/files")
        assert resp.status_code == 200
        data = resp.get_json()
        assert "entries" in data
        assert "workspace" in data
        names = [e["name"] for e in data["entries"]]
        assert "main.py" in names
        assert "config.json" in names
        assert "examples" in names

    def test_create_file(self, client):
        resp = client.post(
            "/api/strategy/file",
            data=json.dumps({"path": "test.py", "content": "print('hello')"}),
            content_type="application/json",
        )
        assert resp.status_code == 200
        data = resp.get_json()
        assert data["success"] is True
        assert data["path"] == "test.py"

    def test_create_directory(self, client):
        resp = client.post(
            "/api/strategy/file",
            data=json.dumps({"path": "utils", "type": "directory"}),
            content_type="application/json",
        )
        assert resp.status_code == 200
        data = resp.get_json()
        assert data["success"] is True
        assert data["type"] == "directory"

    def test_create_nested_file(self, client):
        resp = client.post(
            "/api/strategy/file",
            data=json.dumps({"path": "strategies/ma_cross.py", "content": "# MA cross"}),
            content_type="application/json",
        )
        assert resp.status_code == 200
        assert resp.get_json()["success"] is True

    def test_create_duplicate_fails(self, client):
        client.post(
            "/api/strategy/file",
            data=json.dumps({"path": "dup.py", "content": "a"}),
            content_type="application/json",
        )
        resp = client.post(
            "/api/strategy/file",
            data=json.dumps({"path": "dup.py", "content": "b"}),
            content_type="application/json",
        )
        assert resp.status_code == 409

    def test_read_file(self, client):
        client.post(
            "/api/strategy/file",
            data=json.dumps({"path": "read_me.py", "content": "x = 42"}),
            content_type="application/json",
        )
        resp = client.get("/api/strategy/file?path=read_me.py")
        assert resp.status_code == 200
        data = resp.get_json()
        assert data["content"] == "x = 42"

    def test_read_nonexistent_file(self, client):
        resp = client.get("/api/strategy/file?path=nope.py")
        assert resp.status_code == 404

    def test_update_file(self, client):
        client.post(
            "/api/strategy/file",
            data=json.dumps({"path": "upd.py", "content": "old"}),
            content_type="application/json",
        )
        resp = client.put(
            "/api/strategy/file",
            data=json.dumps({"path": "upd.py", "content": "new content"}),
            content_type="application/json",
        )
        assert resp.status_code == 200
        assert resp.get_json()["success"] is True

        resp2 = client.get("/api/strategy/file?path=upd.py")
        assert resp2.get_json()["content"] == "new content"

    def test_update_nonexistent_fails(self, client):
        resp = client.put(
            "/api/strategy/file",
            data=json.dumps({"path": "ghost.py", "content": "x"}),
            content_type="application/json",
        )
        assert resp.status_code == 404

    def test_delete_file(self, client):
        client.post(
            "/api/strategy/file",
            data=json.dumps({"path": "del_me.py", "content": "bye"}),
            content_type="application/json",
        )
        resp = client.delete("/api/strategy/file?path=del_me.py")
        assert resp.status_code == 200
        assert resp.get_json()["success"] is True

        resp2 = client.get("/api/strategy/file?path=del_me.py")
        assert resp2.status_code == 404

    def test_delete_directory(self, client):
        client.post(
            "/api/strategy/file",
            data=json.dumps({"path": "mydir/inner.py", "content": "x"}),
            content_type="application/json",
        )
        resp = client.delete("/api/strategy/file?path=mydir")
        assert resp.status_code == 200

    def test_delete_nonexistent_fails(self, client):
        resp = client.delete("/api/strategy/file?path=nope.py")
        assert resp.status_code == 404

    def test_rename_file(self, client):
        client.post(
            "/api/strategy/file",
            data=json.dumps({"path": "old_name.py", "content": "code"}),
            content_type="application/json",
        )
        resp = client.post(
            "/api/strategy/rename",
            data=json.dumps({"oldPath": "old_name.py", "newPath": "new_name.py"}),
            content_type="application/json",
        )
        assert resp.status_code == 200
        assert resp.get_json()["success"] is True

        assert client.get("/api/strategy/file?path=old_name.py").status_code == 404
        resp2 = client.get("/api/strategy/file?path=new_name.py")
        assert resp2.status_code == 200
        assert resp2.get_json()["content"] == "code"

    def test_rename_to_existing_fails(self, client):
        client.post(
            "/api/strategy/file",
            data=json.dumps({"path": "a.py", "content": "a"}),
            content_type="application/json",
        )
        client.post(
            "/api/strategy/file",
            data=json.dumps({"path": "b.py", "content": "b"}),
            content_type="application/json",
        )
        resp = client.post(
            "/api/strategy/rename",
            data=json.dumps({"oldPath": "a.py", "newPath": "b.py"}),
            content_type="application/json",
        )
        assert resp.status_code == 409

    def test_path_traversal_rejected(self, client):
        resp = client.get("/api/strategy/file?path=../../etc/passwd")
        assert resp.status_code == 403

    def test_create_path_traversal_rejected(self, client):
        resp = client.post(
            "/api/strategy/file",
            data=json.dumps({"path": "../escape.py", "content": "bad"}),
            content_type="application/json",
        )
        assert resp.status_code == 403

    def test_missing_path_param(self, client):
        resp = client.get("/api/strategy/file")
        assert resp.status_code == 400

    def test_list_files_includes_created(self, client):
        client.post(
            "/api/strategy/file",
            data=json.dumps({"path": "alpha.py", "content": "1"}),
            content_type="application/json",
        )
        client.post(
            "/api/strategy/file",
            data=json.dumps({"path": "subdir/beta.py", "content": "2"}),
            content_type="application/json",
        )
        resp = client.get("/api/strategy/files")
        data = resp.get_json()
        paths = [e["path"] for e in data["entries"]]
        assert "alpha.py" in paths
        assert "subdir" in paths
        assert "subdir/beta.py" in paths


# ═══════════════════════════════════════════════════════════════════════════════
# Strategy execution
# ═══════════════════════════════════════════════════════════════════════════════


class TestStrategyExecution:
    def test_execute_inline_code(self, client):
        resp = client.post(
            "/api/strategy/execute",
            data=json.dumps({"code": "x = 1 + 2\nprint(x)"}),
            content_type="application/json",
        )
        assert resp.status_code == 200
        data = resp.get_json()
        assert data["success"] is True
        assert "3" in data["stdout"]

    def test_execute_file(self, client):
        client.post(
            "/api/strategy/file",
            data=json.dumps({"path": "run_me.py", "content": "result = 42\nprint(f'Result: {result}')"}),
            content_type="application/json",
        )
        resp = client.post(
            "/api/strategy/execute",
            data=json.dumps({"path": "run_me.py"}),
            content_type="application/json",
        )
        assert resp.status_code == 200
        data = resp.get_json()
        assert data["success"] is True
        assert "Result: 42" in data["stdout"]

    def test_execute_returns_variables(self, client):
        resp = client.post(
            "/api/strategy/execute",
            data=json.dumps({"code": "my_var = 'hello'\nmy_num = 123"}),
            content_type="application/json",
        )
        data = resp.get_json()
        var_names = [v["name"] for v in data["variables"]]
        assert "my_var" in var_names
        assert "my_num" in var_names

    def test_execute_error_captured(self, client):
        resp = client.post(
            "/api/strategy/execute",
            data=json.dumps({"code": "1 / 0"}),
            content_type="application/json",
        )
        data = resp.get_json()
        assert data["success"] is False
        assert "ZeroDivisionError" in data["stderr"]

    def test_execute_syntax_error(self, client):
        resp = client.post(
            "/api/strategy/execute",
            data=json.dumps({"code": "def f(:\n  pass"}),
            content_type="application/json",
        )
        data = resp.get_json()
        assert data["success"] is False
        assert "SyntaxError" in data["stderr"]

    def test_execute_nonexistent_file(self, client):
        resp = client.post(
            "/api/strategy/execute",
            data=json.dumps({"path": "nope.py"}),
            content_type="application/json",
        )
        assert resp.status_code == 404

    def test_execute_no_code_no_path(self, client):
        resp = client.post(
            "/api/strategy/execute",
            data=json.dumps({}),
            content_type="application/json",
        )
        assert resp.status_code == 400


# ═══════════════════════════════════════════════════════════════════════════════
# BaoStock route parameter validation
# ═══════════════════════════════════════════════════════════════════════════════


class TestBaoStockValidation:
    """Test parameter validation — does NOT require live BaoStock connection."""

    def test_snapshot_no_symbols(self, client):
        resp = client.get("/api/baostock/snapshot")
        assert resp.status_code == 400

    def test_snapshot_empty_symbols(self, client):
        resp = client.get("/api/baostock/snapshot?symbols=")
        assert resp.status_code == 400

    def test_klines_daily_no_symbol(self, client):
        resp = client.get("/api/baostock/klines/daily")
        assert resp.status_code == 400

    def test_klines_minute_no_symbol(self, client):
        resp = client.get("/api/baostock/klines/minute")
        assert resp.status_code == 400

    def test_profit_no_symbol(self, client):
        resp = client.get("/api/baostock/profit")
        assert resp.status_code == 400

    def test_operation_no_symbol(self, client):
        resp = client.get("/api/baostock/operation")
        assert resp.status_code == 400

    def test_growth_no_symbol(self, client):
        resp = client.get("/api/baostock/growth")
        assert resp.status_code == 400

    def test_balance_no_symbol(self, client):
        resp = client.get("/api/baostock/balance")
        assert resp.status_code == 400

    def test_cash_flow_no_symbol(self, client):
        resp = client.get("/api/baostock/cash_flow")
        assert resp.status_code == 400

    def test_dupont_no_symbol(self, client):
        resp = client.get("/api/baostock/dupont")
        assert resp.status_code == 400


# ═══════════════════════════════════════════════════════════════════════════════
# Agent routes validation
# ═══════════════════════════════════════════════════════════════════════════════


class TestAgentValidation:
    def test_trade_no_body(self, client):
        resp = client.post(
            "/api/agent/trade",
            data=json.dumps({}),
            content_type="application/json",
        )
        assert resp.status_code == 400

    def test_trade_invalid_side(self, client):
        resp = client.post(
            "/api/agent/trade",
            data=json.dumps({"symbol": "sh600519", "side": "HOLD", "quantity": 1}),
            content_type="application/json",
        )
        assert resp.status_code == 400

    def test_trade_invalid_quantity(self, client):
        resp = client.post(
            "/api/agent/trade",
            data=json.dumps({"symbol": "sh600519", "side": "BUY", "quantity": -1}),
            content_type="application/json",
        )
        assert resp.status_code == 400

    def test_watchlist_get(self, client):
        resp = client.get("/api/agent/watchlist")
        assert resp.status_code == 200
        assert "watchlist" in resp.get_json()

    def test_portfolio_get(self, client):
        resp = client.get("/api/agent/portfolio")
        assert resp.status_code == 200
        assert "positions" in resp.get_json()


# ═══════════════════════════════════════════════════════════════════════════════
# Board routes validation
# ═══════════════════════════════════════════════════════════════════════════════


class TestBoardValidation:
    def test_board_stocks_no_industry(self, client):
        resp = client.get("/api/boards/stocks")
        assert resp.status_code == 400

    def test_stock_performance_no_symbols(self, client):
        resp = client.get("/api/boards/stock-performance")
        assert resp.status_code == 400
