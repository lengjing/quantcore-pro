import { CandleData, MarketTicker } from '../../types';
import { fetchJson } from '../../utils/fetchJson';

/** Public Binance data API — no auth required. */
const BASE_URL = 'https://data-api.binance.vision/api/v3';

/** "BTCUSDT" → "BTC-USDT" for display. */
const formatSymbol = (raw: string): string =>
  raw.endsWith('USDT') ? raw.replace('USDT', '-USDT') : raw;

/** "BTC-USDT" → "BTCUSDT" for API calls. */
const unformatSymbol = (display: string): string => display.replace('-', '');

/** Guard that prevents stock symbols leaking into crypto calls. */
const isCryptoSymbol = (symbol: string): boolean =>
  Boolean(symbol) && !symbol.startsWith('sh') && !symbol.startsWith('sz') && !/^\d/.test(symbol);

/** Map UI timeframe keys to Binance interval strings. */
const INTERVAL_MAP: Record<string, string> = {
  '1M': '1m',
  '5M': '5m',
  '15M': '15m',
  '1H': '1h',
  '4H': '4h',
  '1D': '1d',
};

/** Raw shape of a single entry from Binance GET /ticker/24hr. */
interface BinanceTicker24hr {
  symbol: string;
  lastPrice: string;
  priceChange: string;
  priceChangePercent: string;
  quoteVolume: string;
  highPrice: string;
  lowPrice: string;
  closeTime: number;
}

/**
 * Fetch the top USDT trading pairs sorted by 24h quote volume.
 * Returns an empty array on any error so the UI degrades gracefully.
 */
export const fetchTopTickers = async (): Promise<MarketTicker[]> => {
  try {
    const data = await fetchJson<BinanceTicker24hr[]>(`${BASE_URL}/ticker/24hr`, 'fetchTopTickers');

    return data
      .filter((d) => d.symbol.endsWith('USDT') && parseFloat(d.quoteVolume) > 1_000_000)
      .sort((a, b) => parseFloat(b.quoteVolume) - parseFloat(a.quoteVolume))
      .map((d) => ({
        symbol: formatSymbol(d.symbol),
        price: parseFloat(d.lastPrice),
        change: parseFloat(d.priceChange),
        changePercent: parseFloat(d.priceChangePercent),
        volume: parseFloat(d.quoteVolume),
        high: parseFloat(d.highPrice),
        low: parseFloat(d.lowPrice),
        timestamp: d.closeTime,
      }));
  } catch (error) {
    console.error('Binance fetchTopTickers error:', error);
    return [];
  }
};

/**
 * Fetch OHLCV candlestick data for a crypto symbol.
 * @param symbol Display-format symbol, e.g. "BTC-USDT".
 * @param timeframe UI timeframe key, e.g. "1H".
 */
export const fetchKlines = async (symbol: string, timeframe: string): Promise<CandleData[]> => {
  if (!isCryptoSymbol(symbol)) return [];

  try {
    const interval = INTERVAL_MAP[timeframe] ?? '1h';
    const url = `${BASE_URL}/klines?symbol=${unformatSymbol(symbol)}&interval=${interval}&limit=100`;

    // Binance klines are arrays of mixed primitives: [openTime, open, high, low, close, volume, ...]
    const data = await fetchJson<(string | number)[][]>(url, `fetchKlines(${symbol})`);

    return data.map((d) => ({
      time: new Date(d[0] as number).toISOString(),
      open: parseFloat(d[1] as string),
      high: parseFloat(d[2] as string),
      low: parseFloat(d[3] as string),
      close: parseFloat(d[4] as string),
      volume: parseFloat(d[5] as string),
    }));
  } catch (error) {
    console.error(`Binance fetchKlines error (${symbol}):`, error);
    return [];
  }
};

/** Raw shape of a single entry from Binance GET /trades. */
interface BinanceRawTrade {
  id: number;
  price: string;
  qty: string;
  time: number;
  isBuyerMaker: boolean;
}

/**
 * Fetch recent public trades for Time & Sales.
 * @param symbol Display-format symbol, e.g. "BTC-USDT".
 * @param limit Number of trades to fetch (max 1000).
 */
export const fetchRecentTrades = async (symbol: string, limit = 30): Promise<import('../../types').Trade[]> => {
  if (!isCryptoSymbol(symbol)) return [];

  try {
    const url = `${BASE_URL}/trades?symbol=${unformatSymbol(symbol)}&limit=${limit}`;
    const data = await fetchJson<BinanceRawTrade[]>(url, `fetchRecentTrades(${symbol})`);
    return data.map((t) => ({
      id: t.id,
      price: parseFloat(t.price),
      quantity: parseFloat(t.qty),
      time: t.time,
      isBuyerMaker: t.isBuyerMaker,
    })).reverse(); // newest first
  } catch (error) {
    console.error(`Binance fetchRecentTrades error (${symbol}):`, error);
    return [];
  }
};

/** Raw shape of the Binance GET /depth response. */
interface BinanceDepthResponse {
  bids: [string, string][];
  asks: [string, string][];
}

/**
 * Fetch L2 order-book depth (top 20 levels each side).
 * @param symbol Display-format symbol, e.g. "BTC-USDT".
 */
export const fetchDepth = async (
  symbol: string,
): Promise<{ bids: { price: number; size: number }[]; asks: { price: number; size: number }[] }> => {
  if (!isCryptoSymbol(symbol)) return { bids: [], asks: [] };

  try {
    const url = `${BASE_URL}/depth?symbol=${unformatSymbol(symbol)}&limit=20`;
    const data = await fetchJson<BinanceDepthResponse>(url, `fetchDepth(${symbol})`);

    return {
      bids: data.bids.map((b) => ({ price: parseFloat(b[0]), size: parseFloat(b[1]) })),
      asks: data.asks.map((a) => ({ price: parseFloat(a[0]), size: parseFloat(a[1]) })),
    };
  } catch (error) {
    console.error(`Binance fetchDepth error (${symbol}):`, error);
    return { bids: [], asks: [] };
  }
};
