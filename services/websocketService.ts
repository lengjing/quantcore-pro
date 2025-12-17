
import { Trade } from '../types';

// Use standard port 443 path
const WS_BASE = 'wss://stream.binance.com/ws';

type CallbackMap = {
  trade?: (trade: Trade) => void;
  depth?: (bids: any[], asks: any[]) => void;
  ticker?: (data: any) => void;
};

let ws: WebSocket | null = null;
let activeSymbol: string | null = null;

export const connectWebSocket = (
  symbol: string, 
  callbacks: CallbackMap
) => {
  if (ws) {
    ws.close();
  }

  const cleanSymbol = symbol.replace('-', '').toLowerCase();
  activeSymbol = symbol;

  // Subscribe to:
  // 1. aggTrade (Time & Sales)
  // 2. depth20 (Order Book)
  
  const streams = [
    `${cleanSymbol}@aggTrade`,
    `${cleanSymbol}@depth20@100ms`,
  ].join('/');

  try {
    ws = new WebSocket(`${WS_BASE}/${streams}`);

    ws.onopen = () => {
      // console.log('WS Connected');
    };

    ws.onmessage = (event) => {
      try {
        const msg = JSON.parse(event.data);
        const stream = msg.stream;
        const data = msg.data;

        if (stream?.endsWith('aggTrade')) {
          if (callbacks.trade) {
            callbacks.trade({
              id: data.a,
              price: parseFloat(data.p),
              quantity: parseFloat(data.q),
              time: data.T,
              isBuyerMaker: data.m
            });
          }
        } else if (stream?.endsWith('depth20@100ms')) {
          if (callbacks.depth) {
            const bids = data.bids.map((b: string[]) => ({ price: parseFloat(b[0]), size: parseFloat(b[1]) }));
            const asks = data.asks.map((a: string[]) => ({ price: parseFloat(a[0]), size: parseFloat(a[1]) }));
            callbacks.depth(bids, asks);
          }
        }
      } catch (parseError) {
        console.warn('WS Message Parse Error:', parseError);
      }
    };

    ws.onerror = (err) => {
      console.error('WS Connection Error:', err);
    };
  } catch (e) {
    console.error('Failed to initialize WebSocket:', e);
  }

  return () => {
    if (ws) {
      ws.close();
      ws = null;
    }
  };
};
