/**
 * Normalized A-share data types shared across all adapters.
 * Adapters always return these types; the stock data service maps them to UI types.
 */

/** Real-time market snapshot for a single A-share security. */
export interface StockSnapshot {
  /** Symbol in sh/sz prefix format, e.g. "sh600519". */
  symbol: string;
  /** Chinese company name, e.g. "贵州茅台". */
  name: string;
  /** Latest traded price (CNY). */
  price: number;
  /** Today's opening price. */
  open: number;
  /** Previous day's closing price. */
  prevClose: number;
  /** Today's highest price. */
  high: number;
  /** Today's lowest price. */
  low: number;
  /** Trading volume in lots (手, 1 lot = 100 shares). */
  volume: number;
  /** Turnover amount in CNY. */
  amount: number;
  /** Absolute price change (price − prevClose). */
  change: number;
  /** Percentage price change. */
  changePercent: number;
  /** Best bid price (买一价). Optional — not all adapters provide it. */
  bid?: number;
  /** Best bid size in lots. Optional. */
  bidSize?: number;
  /** Best ask price (卖一价). Optional. */
  ask?: number;
  /** Best ask size in lots. Optional. */
  askSize?: number;
  /** Unix timestamp in milliseconds. */
  timestamp: number;
}

/** Single OHLCV candlestick bar. */
export interface StockKline {
  /** ISO date string (daily: "YYYY-MM-DD") or datetime string (minute: "YYYY-MM-DD HH:mm:ss"). */
  time: string;
  open: number;
  high: number;
  low: number;
  close: number;
  /** Volume in lots (手). */
  volume: number;
}

/** Minute-bar period in minutes. */
export type MinutePeriod = '1' | '5' | '15' | '30' | '60';

/** Daily-and-above aggregation period. */
export type DailyPeriod = 'daily' | 'weekly' | 'monthly';
