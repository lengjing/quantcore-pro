import type { CandleData, Trade } from '../../types';

const WS_BASE = 'wss://stream.binance.com/ws';

/** Map UI timeframe keys to Binance kline interval strings. */
export const WS_INTERVAL_MAP: Record<string, string> = {
  '1M': '1m',
  '5M': '5m',
  '15M': '15m',
  '1H': '1h',
  '4H': '4h',
  '1D': '1d',
};

export interface BinanceWsCallbacks {
  /** Called for every aggregated trade (Time & Sales). */
  trade?: (trade: Trade) => void;
  /** Called on every L2 order-book snapshot update (depth20). */
  depth?: (bids: { price: number; size: number }[], asks: { price: number; size: number }[]) => void;
  /**
   * Called on every kline update for the active timeframe.
   * `isClosed = true` when the bar is confirmed; `false` while it is still forming.
   */
  kline?: (candle: CandleData, isClosed: boolean) => void;
  /** Called when the WebSocket closes (for reconnect logic). */
  onClose?: () => void;
}

let ws: WebSocket | null = null;

/**
 * Open a combined Binance WebSocket stream for aggTrade, depth20, and kline.
 * Closes any previously open connection before opening the new one.
 *
 * @param symbol   Display-format symbol, e.g. "BTC-USDT".
 * @param interval UI timeframe key, e.g. "1H".
 * @returns A cleanup function that closes the socket when called.
 */
export const connectWebSocket = (
  symbol: string,
  interval: string,
  callbacks: BinanceWsCallbacks,
): (() => void) => {
  // Close any existing connection first.
  if (ws) {
    ws.close();
    ws = null;
  }

  const cleanSymbol = symbol.replace('-', '').toLowerCase();
  const wsInterval = WS_INTERVAL_MAP[interval] ?? '1h';
  const streams = [
    `${cleanSymbol}@aggTrade`,
    `${cleanSymbol}@depth20@100ms`,
    `${cleanSymbol}@kline_${wsInterval}`,
  ].join('/');

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
        } else if (stream?.includes('@kline_') && callbacks.kline) {
          const k = data.k;
          callbacks.kline(
            {
              time: new Date(k.t).toISOString(),
              open: parseFloat(k.o),
              high: parseFloat(k.h),
              low: parseFloat(k.l),
              close: parseFloat(k.c),
              volume: parseFloat(k.v),
            },
            k.x as boolean,
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

