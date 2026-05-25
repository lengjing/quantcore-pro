import type { StockSnapshot, StockKline, MinutePeriod, DailyPeriod } from './types';

/**
 * Capabilities that a data adapter can declare.
 * When multi-adapter mode is active, the service routes each request to the
 * adapter that declares the matching capability.
 */
export type AdapterCapability =
  | 'realtime'      // real-time snapshots / quotes
  | 'dailyKlines'   // daily / weekly / monthly OHLCV
  | 'minuteKlines'; // intraday minute-level OHLCV

/** Static metadata about a data adapter. */
export interface AdapterMeta {
  /** Unique identifier used to select this adapter at runtime. */
  readonly id: string;
  /** Human-readable display name. */
  readonly name: string;
  /** Primary data provider name (Chinese name in brackets for reference). */
  readonly provider: string;
  /** Whether the data source is free to use without a paid subscription. */
  readonly isFree: boolean;
  /**
   * Brief cost note, e.g.:
   * - "免费，无需注册" (Free, no registration)
   * - "免费，需要申请 API Key" (Free, requires API key)
   * - "付费，商业授权" (Paid, commercial license)
   */
  readonly costNote: string;
  /**
   * Whether this adapter works when called directly from a browser
   * (i.e. does NOT require a local proxy / Electron context for CORS).
   */
  readonly browserCompatible: boolean;
  /** Optional notes about limitations, reliability, or usage constraints. */
  readonly notes?: string;
  /**
   * Capabilities this adapter supports. When multi-adapter routing is enabled,
   * each capability is served by the adapter assigned to it.
   * Defaults to all capabilities if not specified.
   */
  readonly capabilities?: readonly AdapterCapability[];
}

/**
 * Contract that every A-share data adapter must satisfy.
 * Implementations are responsible for:
 *  - Normalising raw API responses into the shared StockSnapshot / StockKline types.
 *  - Handling all network errors gracefully (never throwing, returning [] on failure).
 */
export interface IStockDataAdapter extends AdapterMeta {
  /**
   * Fetch real-time snapshots for one or more symbols.
   *
   * @param symbols Symbols in sh/sz prefix format, e.g. ["sh600519", "sz000858"].
   * @returns Resolved snapshots; symbols with no data are silently omitted.
   */
  fetchSnapshots(symbols: string[]): Promise<StockSnapshot[]>;

  /**
   * Fetch daily / weekly / monthly OHLCV candlesticks.
   *
   * @param symbol  Symbol in sh/sz prefix format.
   * @param period  Aggregation granularity.
   * @param startDate  Start date in YYYYMMDD format.
   * @param endDate    End date in YYYYMMDD format.
   * @param adjust  Price adjustment type: 'qfq' (forward), 'hfq' (backward), '' (none).
   */
  fetchDailyKlines(
    symbol: string,
    period: DailyPeriod,
    startDate: string,
    endDate: string,
    adjust?: 'qfq' | 'hfq' | '',
  ): Promise<StockKline[]>;

  /**
   * Fetch minute-level OHLCV candlesticks.
   * Returns the most recent available bars (typically 240 for intraday use).
   *
   * @param symbol Symbol in sh/sz prefix format.
   * @param period Period in minutes.
   */
  fetchMinuteKlines(symbol: string, period: MinutePeriod): Promise<StockKline[]>;
}
