"""
QuantCore Pro - Python Backend with Akshare Integration
Provides real-time stock data via WebSocket and HTTP REST API
"""

from flask import Flask, request, jsonify
from flask_cors import CORS
from flask_socketio import SocketIO, emit, join_room, leave_room
import akshare as ak
import pandas as pd
import threading
import time
from datetime import datetime, timedelta
import logging

# Configure logging
logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

# Initialize Flask app
app = Flask(__name__)
app.config['SECRET_KEY'] = 'quantcore-secret-2024'
CORS(app)
socketio = SocketIO(app, cors_allowed_origins="*", async_mode='eventlet')

# Global state
subscribed_symbols = set()
update_thread = None
update_interval = 3  # seconds

def normalize_symbol(symbol: str) -> str:
    """Convert symbol format: sh600519 -> 600519"""
    if symbol.startswith('sh') or symbol.startswith('sz'):
        return symbol[2:]
    return symbol

def add_market_prefix(code: str) -> str:
    """Add market prefix: 600519 -> sh600519"""
    if code.startswith('6'):
        return f'sh{code}'
    elif code.startswith(('0', '3')):
        return f'sz{code}'
    return code

# ==================== WebSocket Events ====================

@socketio.on('connect')
def handle_connect():
    logger.info(f'Client connected: {request.sid}')
    emit('connected', {'status': 'ok', 'message': 'Connected to QuantCore Python Backend'})

@socketio.on('disconnect')
def handle_disconnect():
    logger.info(f'Client disconnected: {request.sid}')

@socketio.on('subscribe')
def handle_subscribe(data):
    """Subscribe to real-time quotes for given symbols"""
    symbols = data.get('symbols', [])
    for symbol in symbols:
        subscribed_symbols.add(symbol)
        join_room(symbol)
    
    logger.info(f'Client {request.sid} subscribed to: {symbols}')
    emit('subscribed', {'symbols': list(symbols)})
    
    # Start update thread if not running
    global update_thread
    if update_thread is None or not update_thread.is_alive():
        update_thread = threading.Thread(target=quote_update_worker, daemon=True)
        update_thread.start()

@socketio.on('unsubscribe')
def handle_unsubscribe(data):
    """Unsubscribe from symbols"""
    symbols = data.get('symbols', [])
    for symbol in symbols:
        if symbol in subscribed_symbols:
            subscribed_symbols.remove(symbol)
            leave_room(symbol)
    
    logger.info(f'Client {request.sid} unsubscribed from: {symbols}')
    emit('unsubscribed', {'symbols': list(symbols)})

def quote_update_worker():
    """Background thread to push real-time quotes"""
    logger.info('Quote update worker started')
    
    while len(subscribed_symbols) > 0:
        try:
            # Fetch real-time data for all A-shares
            df = ak.stock_zh_a_spot_em()
            
            # Filter subscribed symbols
            for symbol in list(subscribed_symbols):
                code = normalize_symbol(symbol)
                row = df[df['代码'] == code]
                
                if not row.empty:
                    data = row.iloc[0]
                    quote = {
                        'symbol': symbol,
                        'name': data['名称'],
                        'price': float(data['最新价']),
                        'change': float(data['涨跌额']),
                        'changePercent': float(data['涨跌幅']),
                        'volume': float(data['成交量']),
                        'amount': float(data['成交额']),
                        'high': float(data['最高']),
                        'low': float(data['最低']),
                        'open': float(data['今开']),
                        'prevClose': float(data['昨收']),
                        'timestamp': int(time.time() * 1000)
                    }
                    
                    # Emit to specific room
                    socketio.emit('quote_update', quote, room=symbol)
            
            time.sleep(update_interval)
            
        except Exception as e:
            logger.error(f'Error in quote update worker: {e}')
            time.sleep(5)
    
    logger.info('Quote update worker stopped (no subscribers)')

# ==================== HTTP REST API ====================

@app.route('/health', methods=['GET'])
def health_check():
    """Health check endpoint"""
    return jsonify({'status': 'healthy', 'service': 'QuantCore Python Backend'})

@app.route('/api/stock/snapshot', methods=['GET'])
def get_snapshot():
    """Get real-time snapshot for multiple symbols"""
    try:
        symbols_param = request.args.get('symbols', '')
        symbols = [s.strip() for s in symbols_param.split(',') if s.strip()]
        
        if not symbols:
            return jsonify({'error': 'No symbols provided'}), 400
        
        # Fetch all A-share real-time data
        df = ak.stock_zh_a_spot_em()
        
        result = []
        for symbol in symbols:
            code = normalize_symbol(symbol)
            row = df[df['代码'] == code]
            
            if not row.empty:
                data = row.iloc[0]
                result.append({
                    'symbol': symbol,
                    'name': data['名称'],
                    'price': float(data['最新价']),
                    'change': float(data['涨跌额']),
                    'changePercent': float(data['涨跌幅']),
                    'volume': float(data['成交量']),
                    'amount': float(data['成交额']),
                    'high': float(data['最高']),
                    'low': float(data['最低']),
                    'open': float(data['今开']),
                    'prevClose': float(data['昨收']),
                    'bid': float(data.get('买一价', 0)),
                    'ask': float(data.get('卖一价', 0)),
                    'timestamp': int(time.time() * 1000)
                })
        
        return jsonify(result)
        
    except Exception as e:
        logger.error(f'Error in get_snapshot: {e}')
        return jsonify({'error': str(e)}), 500

@app.route('/api/stock/klines', methods=['GET'])
def get_klines():
    """Get historical daily/weekly/monthly klines"""
    try:
        symbol = request.args.get('symbol', '')
        period = request.args.get('period', 'daily')  # daily, weekly, monthly
        start = request.args.get('start', '')
        end = request.args.get('end', '')
        
        if not symbol:
            return jsonify({'error': 'Symbol required'}), 400
        
        code = normalize_symbol(symbol)
        
        # Default date range
        if not end:
            end = datetime.now().strftime('%Y%m%d')
        if not start:
            start = (datetime.now() - timedelta(days=365)).strftime('%Y%m%d')
        
        # Fetch data from akshare
        df = ak.stock_zh_a_hist(symbol=code, period=period, start_date=start, end_date=end, adjust="qfq")
        
        # Convert to candle format
        candles = []
        for _, row in df.iterrows():
            candles.append({
                'time': row['日期'],
                'open': float(row['开盘']),
                'high': float(row['最高']),
                'low': float(row['最低']),
                'close': float(row['收盘']),
                'volume': float(row['成交量'])
            })
        
        return jsonify(candles)
        
    except Exception as e:
        logger.error(f'Error in get_klines: {e}')
        return jsonify({'error': str(e)}), 500

@app.route('/api/stock/klines_minute', methods=['GET'])
def get_klines_minute():
    """Get minute-level klines"""
    try:
        symbol = request.args.get('symbol', '')
        period = request.args.get('period', '1')  # 1, 5, 15, 30, 60
        
        if not symbol:
            return jsonify({'error': 'Symbol required'}), 400
        
        code = normalize_symbol(symbol)
        
        # Fetch minute data
        df = ak.stock_zh_a_hist_min_em(symbol=code, period=period, adjust="qfq")
        
        # Convert to candle format
        candles = []
        for _, row in df.iterrows():
            candles.append({
                'time': row['时间'],
                'open': float(row['开盘']),
                'high': float(row['最高']),
                'low': float(row['最低']),
                'close': float(row['收盘']),
                'volume': float(row['成交量'])
            })
        
        return jsonify(candles[-240:])  # Return last 240 candles
        
    except Exception as e:
        logger.error(f'Error in get_klines_minute: {e}')
        return jsonify({'error': str(e)}), 500

@app.route('/api/stock/intraday', methods=['GET'])
def get_intraday():
    """Get intraday tick data (分时)"""
    try:
        symbol = request.args.get('symbol', '')
        
        if not symbol:
            return jsonify({'error': 'Symbol required'}), 400
        
        code = normalize_symbol(symbol)
        
        # Fetch 1-minute data for today
        df = ak.stock_zh_a_hist_min_em(symbol=code, period='1', adjust="")
        
        # Filter today's data
        today = datetime.now().strftime('%Y-%m-%d')
        df_today = df[df['时间'].str.startswith(today)]
        
        # Convert to simple format
        ticks = []
        for _, row in df_today.iterrows():
            ticks.append({
                'time': row['时间'],
                'price': float(row['收盘']),
                'volume': float(row['成交量'])
            })
        
        return jsonify(ticks)
        
    except Exception as e:
        logger.error(f'Error in get_intraday: {e}')
        return jsonify({'error': str(e)}), 500

@app.route('/api/stock/info', methods=['GET'])
def get_stock_info():
    """Get company basic information"""
    try:
        symbol = request.args.get('symbol', '')
        
        if not symbol:
            return jsonify({'error': 'Symbol required'}), 400
        
        code = normalize_symbol(symbol)
        
        # Fetch company info
        df = ak.stock_individual_info_em(symbol=code)
        
        # Convert to dict
        info = {}
        for _, row in df.iterrows():
            info[row['item']] = row['value']
        
        return jsonify(info)
        
    except Exception as e:
        logger.error(f'Error in get_stock_info: {e}')
        return jsonify({'error': str(e)}), 500

@app.route('/api/stock/list', methods=['GET'])
def get_stock_list():
    """Get full A-share stock list"""
    try:
        df = ak.stock_zh_a_spot_em()
        
        stocks = []
        for _, row in df.iterrows():
            stocks.append({
                'code': row['代码'],
                'symbol': add_market_prefix(row['代码']),
                'name': row['名称'],
                'price': float(row['最新价']),
                'changePercent': float(row['涨跌幅'])
            })
        
        return jsonify(stocks)
        
    except Exception as e:
        logger.error(f'Error in get_stock_list: {e}')
        return jsonify({'error': str(e)}), 500

# ==================== Main ====================

if __name__ == '__main__':
    logger.info('Starting QuantCore Python Backend...')
    logger.info('Server running on http://localhost:5000')
    socketio.run(app, host='0.0.0.0', port=5000, debug=False)
