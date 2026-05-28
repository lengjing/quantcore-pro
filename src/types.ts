
// ---------------------------------------------------------------------------
// App-level UI types (shared across components / hooks / views)
// ---------------------------------------------------------------------------

export type MarketMode = 'CRYPTO' | 'CN_STOCK';
export type ScannerSort = 'CHANGE_DESC' | 'CHANGE_ASC' | 'VOL_DESC';

/**
 * Color scheme for price change indicators.
 * 'greenUp' — green for up, red for down (international default)
 * 'redUp'   — red for up, green for down (China convention)
 */
export type ColorScheme = 'greenUp' | 'redUp';

/**
 * PAPER — all orders are simulated; positions track P&L but no real funds are used.
 * LIVE  — orders are intended to be routed to a real exchange.
 *         A confirmation dialog is always shown before execution.
 */
export type TradingMode = 'PAPER' | 'LIVE';

export interface Notification {
  id: string;
  type: 'SUCCESS' | 'ERROR' | 'INFO';
  message: string;
}

// ---------------------------------------------------------------------------

export enum ViewState {
  DASHBOARD = 'DASHBOARD',
  MARKET = 'MARKET',
  STRATEGY = 'STRATEGY',
  BACKTEST = 'BACKTEST',
  NEWS = 'NEWS',
  SCANNER = 'SCANNER',
  SETTINGS = 'SETTINGS',
  AI = 'AI',
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

export type Timeframe = '1M' | '5M' | '15M' | '1H' | '4H' | '1D' | '1W' | '1MO';

/** K-line period category for UI grouping */
export type KlinePeriod = 'realtime' | 'daily' | 'weekly' | 'monthly';

/** Map period categories to their default timeframes */
export const KLINE_PERIOD_TIMEFRAMES: Record<KlinePeriod, Timeframe[]> = {
  realtime: ['1M', '5M', '15M', '1H'],
  daily: ['1D'],
  weekly: ['1W'],
  monthly: ['1MO'],
};

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

/** A single level in an order book (bid or ask). */
export interface DepthLevel {
  price: number;
  size: number;
}

/** L2 order-book depth snapshot (top N levels each side). */
export interface OrderBookDepth {
  bids: DepthLevel[];
  asks: DepthLevel[];
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

export type AIProvider =
  | 'nvidia_nim'
  | 'open_router'
  | 'deepseek'
  | 'mistral'
  | 'mistral_codestral'
  | 'opencode'
  | 'opencode_go'
  | 'wafer'
  | 'kimi'
  | 'cerebras'
  | 'groq'
  | 'fireworks'
  | 'zai'
  | 'lmstudio'
  | 'llamacpp'
  | 'ollama';

export interface AISettings {
  provider: AIProvider;
  apiKey: string;
  model: string;
}

export interface StrategyFile {
  name: string;
  language: string; // 'python' | 'json' | 'markdown' | 'javascript'
  content: string;
}

// ---------------------------------------------------------------------------
// AI Assistant types
// ---------------------------------------------------------------------------

export interface ToolUseEvent {
  tool: string;
  input: Record<string, unknown>;
  output: unknown;
}

export type AIAction =
  | {
      type: 'ADD_SECTOR';
      payload: { name: string; nameEn: string; description?: string; symbols: string[] };
    }
  | { type: 'ADD_TO_WATCHLIST'; payload: { symbols: string[] } };

export interface ChatMessage {
  id: string;
  role: 'user' | 'assistant';
  content: string;
  toolUse?: ToolUseEvent[];
  actions?: AIAction[];
  timestamp: number;
  isLoading?: boolean;
}

export interface BackendStatus {
  claude: boolean;
}
