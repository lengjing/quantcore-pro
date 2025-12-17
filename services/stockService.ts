/**
 * Stock Service - Python Backend Integration
 * All stock data fetched from local Python Flask server using akshare
 */

import { CandleData, MarketTicker } from '../types';

const API_BASE = 'http://localhost:5000/api/stock';

// Default stock symbols for scanner
const STOCK_SYMBOLS = [
  // Indices
  'sh000001', 'sz399001', 'sz399006',

  // Popular stocks
  'sh600519', 'sz000858', 'sz000568', 'sh600887', 'sh603288',
  'sz300750', 'sz002594', 'sh601012', 'sz002812', 'sz002460',
  'sh603501', 'sz002230', 'sh600584', 'sz002415', 'sz002475',
  'sh600036', 'sh601318', 'sh601166', 'sh600030', 'sh601211',
  'sh601857', 'sh600028', 'sh601668', 'sh600900', 'sh601919',
  'sz000002', 'sh600048', 'sh600276', 'sz000651', 'sz000333'
];

export const fetchStockTickers = async (): Promise<MarketTicker[]> => {
  try {
    const symbolsParam = STOCK_SYMBOLS.join(',');
    const url = `${API_BASE}/snapshot?symbols=${symbolsParam}`;

    const response = await fetch(url);
    if (!response.ok) throw new Error('Network error');

    const data = await response.json();

    // Transform to MarketTicker format
    return data.map((item: any) => ({
      symbol: item.symbol,
      name: item.name,
      price: item.price,
      change: item.change,
      changePercent: item.changePercent,
      volume: item.volume,
      high: item.high,
      low: item.low,
      timestamp: item.timestamp,
      bid: item.bid || 0,
      bidSize: item.bidSize || 0,
      ask: item.ask || 0,
      askSize: item.askSize || 0
    }));

  } catch (error) {
    console.error("Python Stock API Error (Tickers):", error);
    return [];
  }
};

export const fetchStockKlines = async (symbol: string, timeframe: string): Promise<CandleData[]> => {
  try {
    let url = '';

    // Determine if we need minute data or daily data
    if (['1M', '5M', '15M', '30M', '1H'].includes(timeframe)) {
      // Minute klines
      let period = '1';
      if (timeframe === '5M') period = '5';
      else if (timeframe === '15M') period = '15';
      else if (timeframe === '30M') period = '30';
      else if (timeframe === '1H') period = '60';

      url = `${API_BASE}/klines_minute?symbol=${symbol}&period=${period}`;
    } else {
      // Daily/weekly/monthly klines
      let period = 'daily';
      if (timeframe === '1W') period = 'weekly';
      else if (timeframe === '1M') period = 'monthly';

      // Get last year of data
      const endDate = new Date();
      const startDate = new Date();
      startDate.setFullYear(startDate.getFullYear() - 1);

      const start = startDate.toISOString().split('T')[0].replace(/-/g, '');
      const end = endDate.toISOString().split('T')[0].replace(/-/g, '');

      url = `${API_BASE}/klines?symbol=${symbol}&period=${period}&start=${start}&end=${end}`;
    }

    const response = await fetch(url);
    if (!response.ok) throw new Error('Network error');

    const data = await response.json();

    // Transform to CandleData format
    return data.map((item: any) => ({
      time: item.time,
      open: item.open,
      high: item.high,
      low: item.low,
      close: item.close,
      volume: item.volume
    }));

  } catch (error) {
    console.error(`Python Stock API Error (Klines for ${symbol}):`, error);
    return [];
  }
};

/**
 * Fetch intraday tick data (分时数据)
 */
export const fetchIntradayData = async (symbol: string): Promise<any[]> => {
  try {
    const url = `${API_BASE}/intraday?symbol=${symbol}`;
    const response = await fetch(url);

    if (!response.ok) throw new Error('Network error');

    return await response.json();

  } catch (error) {
    console.error(`Python Stock API Error (Intraday for ${symbol}):`, error);
    return [];
  }
};

/**
 * Fetch company basic information
 */
export const fetchStockInfo = async (symbol: string): Promise<any> => {
  try {
    const url = `${API_BASE}/info?symbol=${symbol}`;
    const response = await fetch(url);

    if (!response.ok) throw new Error('Network error');

    return await response.json();

  } catch (error) {
    console.error(`Python Stock API Error (Info for ${symbol}):`, error);
    return {};
  }
};

/**
 * Fetch full A-share stock list
 */
export const fetchStockList = async (): Promise<any[]> => {
  try {
    const url = `${API_BASE}/list`;
    const response = await fetch(url);

    if (!response.ok) throw new Error('Network error');

    return await response.json();

  } catch (error) {
    console.error("Python Stock API Error (Stock List):", error);
    return [];
  }
};