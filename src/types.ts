
export enum ViewState {
  DASHBOARD = 'DASHBOARD',
  MARKET = 'MARKET',
  STRATEGY = 'STRATEGY',
  BACKTEST = 'BACKTEST',
  NEWS = 'NEWS',
  SCANNER = 'SCANNER',
  SETTINGS = 'SETTINGS'
}

export enum OrderSide {
  BUY = 'BUY',
  SELL = 'SELL'
}

export enum OrderStatus {
  PENDING = 'PENDING',
  FILLED = 'FILLED',
  CANCELLED = 'CANCELLED'
}

export type Timeframe = '1M' | '5M' | '15M' | '1H' | '4H' | '1D';

export interface MarketTicker {
  symbol: string;
  price: number;
  change: number;
  changePercent: number;
  volume: number;
  high: number;
  low: number;
  timestamp: number;
  bid?: number;
  ask?: number;
  lastTickDir?: 'UP' | 'DOWN' | 'NONE'; // For flash animation
  bidSize?: number;
  askSize?: number;
  name?: string;
}

export interface Order {
  id: string;
  symbol: string;
  side: OrderSide;
  type: 'LIMIT' | 'MARKET';
  quantity: number;
  price: number;
  status: OrderStatus;
  timestamp: string;
}

export interface Position {
  symbol: string;
  quantity: number;
  avgPrice: number;
  currentPrice: number;
  pnl: number;
  pnlPercent: number;
}

export interface CandleData {
  time: string;
  open: number;
  high: number;
  low: number;
  close: number;
  volume: number;
  ma7?: number;
  ma25?: number;
  ma99?: number;
}

export interface Trade {
  id: number;
  price: number;
  quantity: number;
  time: number;
  isBuyerMaker: boolean; // true = Sell side taker (Red), false = Buy side taker (Green)
}

export interface LogEntry {
  id: string;
  timestamp: string;
  level: 'INFO' | 'WARN' | 'ERROR' | 'TRADE' | 'SYS';
  message: string;
}

export interface NewsItem {
  id: string;
  headline: string;
  source: string;
  time: string;
  sentiment: 'POSITIVE' | 'NEGATIVE' | 'NEUTRAL';
  relatedSymbols: string[];
  url?: string;
}

export interface BacktestMetric {
  label: string;
  value: string;
  color?: string;
}

export interface BacktestResult {
  equityCurve: { time: string; value: number }[];
  trades: { time: string; side: 'BUY' | 'SELL'; price: number; pnl: number }[];
  metrics: BacktestMetric[];
}

export interface StrategyFile {
  name: string;
  language: string; // 'python' | 'json' | 'markdown' | 'javascript'
  content: string;
}
