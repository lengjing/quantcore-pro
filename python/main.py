"""
QuantCore Pro - Python Backend
Provides a Socket.IO server and health-check endpoint for the Electron main process.

A-share market data is now served directly from browser-compatible adapters
(Tencent Finance, East Money, Sina Finance) in the frontend.  This Python
server retains the Socket.IO infrastructure for future real-time streaming
extensions and acts as a health-check endpoint for the Electron main process.
"""

from flask import Flask, jsonify
from flask_cors import CORS
from flask_socketio import SocketIO, emit
import logging

from ai_routes import ai_bp

# Configure logging
logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

# Initialize Flask app
app = Flask(__name__)
app.config['SECRET_KEY'] = 'quantcore-secret-2024'
CORS(app)
socketio = SocketIO(app, cors_allowed_origins='*', async_mode='eventlet')

# Register blueprints
app.register_blueprint(ai_bp)

# ==================== WebSocket Events ====================

@socketio.on('connect')
def handle_connect():
    logger.info('Client connected')
    emit('connected', {'status': 'ok', 'message': 'Connected to QuantCore Python Backend'})


@socketio.on('disconnect')
def handle_disconnect():
    logger.info('Client disconnected')


# ==================== HTTP REST API ====================

@app.route('/health', methods=['GET'])
def health_check():
    """Health check endpoint — used by the Electron main process to detect server readiness."""
    return jsonify({'status': 'healthy', 'service': 'QuantCore Python Backend'})


# ==================== Main ====================

if __name__ == '__main__':
    logger.info('Starting QuantCore Python Backend...')
    logger.info('Server running on http://localhost:5000')
    socketio.run(app, host='0.0.0.0', port=5000, debug=False)
