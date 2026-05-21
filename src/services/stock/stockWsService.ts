/**
 * Stock WebSocket Service
 *
 * Maintains a Socket.IO connection to the local Python backend (port 5000)
 * for real-time A-share quote streaming.
 *
 * Requires: the Python backend running — `cd python && python main.py`
 */

import { io, Socket } from 'socket.io-client';

export interface QuoteData {
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

export type QuoteCallback = (data: QuoteData) => void;

class StockWsService {
  private socket: Socket | null = null;
  private quoteCallbacks: Set<QuoteCallback> = new Set();
  private connected = false;

  /** Open the Socket.IO connection (idempotent — safe to call multiple times). */
  connect(): void {
    if (this.socket) return;

    this.socket = io('http://localhost:5000', {
      transports: ['websocket', 'polling'],
    });

    this.socket.on('connect', () => {
      console.log('[StockWsService] Connected to Python backend');
      this.connected = true;
    });

    this.socket.on('disconnect', () => {
      console.log('[StockWsService] Disconnected from Python backend');
      this.connected = false;
    });

    this.socket.on('quote_update', (data: QuoteData) => {
      this.quoteCallbacks.forEach((cb) => cb(data));
    });
  }

  /** Close the Socket.IO connection and clean up state. */
  disconnect(): void {
    this.socket?.disconnect();
    this.socket = null;
    this.connected = false;
  }

  /** Subscribe to real-time quotes for the given symbols. Connects automatically if needed. */
  subscribe(symbols: string[]): void {
    if (!this.socket || !this.connected) {
      this.connect();
      // Delay emit until the connection handshake completes.
      this.socket?.once('connect', () => {
        this.socket?.emit('subscribe', { symbols });
      });
    } else {
      this.socket.emit('subscribe', { symbols });
    }
  }

  /** Unsubscribe from real-time quotes for the given symbols. */
  unsubscribe(symbols: string[]): void {
    if (this.socket && this.connected) {
      this.socket.emit('unsubscribe', { symbols });
    }
  }

  /** Register a callback that fires on every quote update. */
  onQuoteUpdate(callback: QuoteCallback): void {
    this.quoteCallbacks.add(callback);
  }

  /** Remove a previously registered quote callback. */
  offQuoteUpdate(callback: QuoteCallback): void {
    this.quoteCallbacks.delete(callback);
  }
}

// Singleton — import this directly.
const stockWsService = new StockWsService();

export default stockWsService;
