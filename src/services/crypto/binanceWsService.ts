import { Trade } from '../../types';

const WS_BASE = 'wss://stream.binance.com/ws';

export interface BinanceWsCallbacks {
  /** Called for every aggregated trade (Time & Sales). */
  trade?: (trade: Trade) => void;
  /** Called on every L2 order-book snapshot update (depth20). */
  depth?: (bids: { price: number; size: number }[], asks: { price: number; size: number }[]) => void;
  /** Called when the WebSocket closes (for reconnect logic). */
  onClose?: () => void;
}

let ws: WebSocket | null = null;

/**
 * Open a combined Binance WebSocket stream for aggTrade and depth20.
 * Closes any previously open connection before opening the new one.
 *
 * @returns A cleanup function that closes the socket when called.
 */
export const connectWebSocket = (symbol: string, callbacks: BinanceWsCallbacks): (() => void) => {
  // Close any existing connection first.
  if (ws) {
    ws.close();
    ws = null;
  }

  const cleanSymbol = symbol.replace('-', '').toLowerCase();
  const streams = [`${cleanSymbol}@aggTrade`, `${cleanSymbol}@depth20@100ms`].join('/');

  let closed = false;

  try {
    ws = new WebSocket(`${WS_BASE}/${streams}`);

    ws.onmessage = (event) => {
      try {
        const msg = JSON.parse(event.data);
        const { stream, data } = msg;

        if (stream?.endsWith('aggTrade') && callbacks.trade) {
          callbacks.trade({
            id: data.a,
            price: parseFloat(data.p),
            quantity: parseFloat(data.q),
            time: data.T,
            isBuyerMaker: data.m,
          });
        } else if (stream?.endsWith('depth20@100ms') && callbacks.depth) {
          callbacks.depth(
            data.bids.map((b: string[]) => ({ price: parseFloat(b[0]), size: parseFloat(b[1]) })),
            data.asks.map((a: string[]) => ({ price: parseFloat(a[0]), size: parseFloat(a[1]) })),
          );
        }
      } catch (err) {
        console.warn('Binance WS parse error:', err);
      }
    };

    ws.onerror = (err) => {
      console.error('Binance WS connection error:', err);
    };

    ws.onclose = () => {
      if (!closed) {
        callbacks.onClose?.();
      }
    };
  } catch (err) {
    console.error('Failed to initialise Binance WebSocket:', err);
  }

  return () => {
    closed = true;
    if (ws) {
      ws.close();
      ws = null;
    }
  };
};

