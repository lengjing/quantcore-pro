/**
 * Stock WebSocket Service
 * Connects to Python backend WebSocket for real-time stock quotes
 */

import { io, Socket } from 'socket.io-client';

interface QuoteCallback {
    (data: QuoteData): void;
}

interface QuoteData {
    symbol: string;
    name: string;
    price: number;
    change: number;
    changePercent: number;
    volume: number;
    amount: number;
    high: number;
    low: number;
    open: number;
    prevClose: number;
    timestamp: number;
}

class StockWebSocketService {
    private socket: Socket | null = null;
    private quoteCallbacks: QuoteCallback[] = [];
    private isConnected = false;

    connect() {
        if (this.socket) {
            return;
        }

        this.socket = io('http://localhost:5000', {
            transports: ['websocket', 'polling']
        });

        this.socket.on('connect', () => {
            console.log('Connected to stock WebSocket server');
            this.isConnected = true;
        });

        this.socket.on('disconnect', () => {
            console.log('Disconnected from stock WebSocket server');
            this.isConnected = false;
        });

        this.socket.on('connected', (data) => {
            console.log('Server acknowledged connection:', data);
        });

        this.socket.on('quote_update', (data: QuoteData) => {
            this.quoteCallbacks.forEach(callback => callback(data));
        });

        this.socket.on('subscribed', (data) => {
            console.log('Subscribed to symbols:', data.symbols);
        });

        this.socket.on('unsubscribed', (data) => {
            console.log('Unsubscribed from symbols:', data.symbols);
        });
    }

    disconnect() {
        if (this.socket) {
            this.socket.disconnect();
            this.socket = null;
            this.isConnected = false;
        }
    }

    subscribe(symbols: string[]) {
        if (!this.socket || !this.isConnected) {
            console.warn('Socket not connected, attempting to connect...');
            this.connect();
            // Wait a bit for connection
            setTimeout(() => {
                this.socket?.emit('subscribe', { symbols });
            }, 1000);
        } else {
            this.socket.emit('subscribe', { symbols });
        }
    }

    unsubscribe(symbols: string[]) {
        if (this.socket && this.isConnected) {
            this.socket.emit('unsubscribe', { symbols });
        }
    }

    onQuoteUpdate(callback: QuoteCallback) {
        this.quoteCallbacks.push(callback);
    }

    removeQuoteCallback(callback: QuoteCallback) {
        this.quoteCallbacks = this.quoteCallbacks.filter(cb => cb !== callback);
    }
}

// Singleton instance
const stockWebSocketService = new StockWebSocketService();

export default stockWebSocketService;
export type { QuoteData, QuoteCallback };
