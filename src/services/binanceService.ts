
import { CandleData, MarketTicker } from '../types';

// Use Binance Vision Data API which is friendlier for public data access
const BASE_URL = 'https://data-api.binance.vision/api/v3';

const formatSymbol = (symbol: string) => {
  if (symbol.endsWith('USDT')) {
    return symbol.replace('USDT', '-USDT');
  }
  return symbol;
};

const unformatSymbol = (symbol: string) => {
  return symbol.replace('-', '');
};

export const fetchTopTickers = async (): Promise<MarketTicker[]> => {
  try {
    const response = await fetch(`${BASE_URL}/ticker/24hr`);
    if (!response.ok) throw new Error(`HTTP Error: ${response.status}`);
    
    const data = await response.json();
    
    // Filter for USDT pairs, sort by Quote Volume (liquidity)
    // Fetch enough items to support infinite scroll
    const topPairs = data
      .filter((d: any) => d.symbol.endsWith('USDT') && parseFloat(d.quoteVolume) > 1000000)
      .sort((a: any, b: any) => parseFloat(b.quoteVolume) - parseFloat(a.quoteVolume));

    return topPairs.map((d: any) => ({
      symbol: formatSymbol(d.symbol),
      price: parseFloat(d.lastPrice),
      change: parseFloat(d.priceChange),
      changePercent: parseFloat(d.priceChangePercent),
      volume: parseFloat(d.quoteVolume),
      high: parseFloat(d.highPrice),
      low: parseFloat(d.lowPrice),
      timestamp: d.closeTime
    }));
  } catch (error) {
    console.error("Binance API Error (Tickers):", error);
    return [];
  }
};

export const fetchKlines = async (symbol: string, timeframe: string): Promise<CandleData[]> => {
  // Guard against non-crypto symbols leaking into this call
  if (!symbol || symbol.startsWith('sh') || symbol.startsWith('sz') || /^\d/.test(symbol)) {
    return [];
  }

  try {
    const cleanSymbol = unformatSymbol(symbol);
    const intervalMap: Record<string, string> = {
      '1M': '1m', '5M': '5m', '15M': '15m', '1H': '1h', '4H': '4h', '1D': '1d'
    };
    const interval = intervalMap[timeframe] || '1h';
    
    const response = await fetch(`${BASE_URL}/klines?symbol=${cleanSymbol}&interval=${interval}&limit=100`);
    if (!response.ok) throw new Error(`HTTP Error: ${response.status}`);

    const data = await response.json();
    
    return data.map((d: any[]) => ({
      time: new Date(d[0]).toISOString(),
      open: parseFloat(d[1]),
      high: parseFloat(d[2]),
      low: parseFloat(d[3]),
      close: parseFloat(d[4]),
      volume: parseFloat(d[5])
    }));

  } catch (error) {
    console.error(`Binance API Error (Klines for ${symbol}):`, error);
    return [];
  }
};

export const fetchDepth = async (symbol: string): Promise<{ bids: { price: number; size: number }[], asks: { price: number; size: number }[] }> => {
  // Guard against non-crypto symbols
  if (!symbol || symbol.startsWith('sh') || symbol.startsWith('sz') || /^\d/.test(symbol)) {
    return { bids: [], asks: [] };
  }

  try {
    const cleanSymbol = unformatSymbol(symbol);
    const response = await fetch(`${BASE_URL}/depth?symbol=${cleanSymbol}&limit=20`);
    if (!response.ok) throw new Error(`HTTP Error: ${response.status}`);
    const data = await response.json();

    return {
      bids: data.bids.map((b: string[]) => ({ price: parseFloat(b[0]), size: parseFloat(b[1]) })),
      asks: data.asks.map((a: string[]) => ({ price: parseFloat(a[0]), size: parseFloat(a[1]) }))
    };
  } catch (error) {
    console.error(`Binance API Error (Depth for ${symbol}):`, error);
    return { bids: [], asks: [] };
  }
};
