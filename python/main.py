"""
QuantCore Pro — Trading Python backend (Flask + Socket.IO).

Runs on port 5000. Started automatically by Electron with embedded Python.
"""

from __future__ import annotations

import os

from flask import Flask, jsonify
from flask_cors import CORS
from flask_socketio import SocketIO

from baostock_routes import baostock_bp
from strategy_routes import strategy_bp
from tdx_routes import tdx_bp

app = Flask(__name__)
CORS(app)
socketio = SocketIO(app, cors_allowed_origins="*", async_mode="threading")

app.register_blueprint(baostock_bp)
app.register_blueprint(strategy_bp)
app.register_blueprint(tdx_bp)


@app.get("/health")
def health():
    return jsonify({"status": "ok", "service": "quantcore-trading-backend"})


@socketio.on("connect")
def on_connect():
    pass


@socketio.on("disconnect")
def on_disconnect():
    pass


@socketio.on("subscribe")
def on_subscribe(data):
    # Quote streaming stub — clients may subscribe to symbol lists.
    pass


@socketio.on("unsubscribe")
def on_unsubscribe(data):
    pass


if __name__ == "__main__":
    port = int(os.environ.get("TRADING_BACKEND_PORT", "5000"))
    host = os.environ.get("TRADING_BACKEND_HOST", "127.0.0.1")
    socketio.run(app, host=host, port=port, debug=False, use_reloader=False, allow_unsafe_werkzeug=True)
