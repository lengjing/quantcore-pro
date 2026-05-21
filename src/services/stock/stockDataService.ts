/**
 * Stock Data Service
 *
 * Central registry for A-share data adapters. Exposes a unified API that maps
 * adapter-specific types (StockSnapshot / StockKline) to the UI-facing types
 * (MarketTicker / CandleData) that App.tsx already consumes.
 *
 * Usage:
 *   // List available adapters
 *   stockDataService.getAdapters();
 *
 *   // Switch the active adapter (e.g. from Settings UI)
 *   stockDataService.setActiveAdapter('eastmoney');
 *
 *   // Use the standard API (same signature as before the refactor)
 *   const tickers = await fetchStockTickers();
 *   const candles  = await fetchStockKlines('sh600519', '1D');
 */

import type { IStockDataAdapter, AdapterMeta } from './IStockDataAdapter';
import type { CandleData, MarketTicker } from '../../types';
import type { DailyPeriod, MinutePeriod } from './types';

import { PythonBackendAdapter } from './adapters/PythonBackendAdapter';
import { TencentAdapter } from './adapters/TencentAdapter';
import { SinaAdapter } from './adapters/SinaAdapter';
import { EastMoneyAdapter } from './adapters/EastMoneyAdapter';

// Default stock symbols exposed to the scanner / watchlist.
export const DEFAULT_STOCK_SYMBOLS = [
  // Indices (指数)
  'sh000001', 'sz399001', 'sz399006',
  // Blue-chips / popular A-shares
  'sh600519', 'sz000858', 'sz000568', 'sh600887', 'sh603288',
  'sz300750', 'sz002594', 'sh601012', 'sz002812', 'sz002460',
  'sh603501', 'sz002230', 'sh600584', 'sz002415', 'sz002475',
  'sh600036', 'sh601318', 'sh601166', 'sh600030', 'sh601211',
  'sh601857', 'sh600028', 'sh601668', 'sh600900', 'sh601919',
  'sz000002', 'sh600048', 'sh600276', 'sz000651', 'sz000333',
] as const;

/** Timeframe key → minute period mapping for minute-bar adapters. */
const MINUTE_PERIOD_MAP: Record<string, MinutePeriod> = {
  '1M': '1',
  '5M': '5',
  '15M': '15',
  '30M': '30',
  '1H': '60',
};

/** Timeframe key → daily period mapping for daily-bar adapters. */
const DAILY_PERIOD_MAP: Record<string, DailyPeriod> = {
  '1D': 'daily',
  '1W': 'weekly',
  '1MO': 'monthly',
};

// ---------------------------------------------------------------------------
// Adapter registry
// ---------------------------------------------------------------------------

class StockDataService {
  private readonly adapters: Map<string, IStockDataAdapter>;

  constructor() {
    this.adapters = new Map<string, IStockDataAdapter>();
    this.adapters.set('python-backend', new PythonBackendAdapter());
    this.adapters.set('tencent', new TencentAdapter());
    this.adapters.set('sina', new SinaAdapter());
    this.adapters.set('eastmoney', new EastMoneyAdapter());
  }

  /** ID of the currently active adapter. Defaults to PythonBackend for backward compatibility. */
  private activeAdapterId: string = 'python-backend';

  // -- Adapter management ---------------------------------------------------

  /** Return static metadata for all registered adapters. */
  getAdapters(): AdapterMeta[] {
    return Array.from(this.adapters.values()).map(
      ({ id, name, provider, isFree, costNote, browserCompatible, notes }) => ({
        id,
        name,
        provider,
        isFree,
        costNote,
        browserCompatible,
        notes,
      }),
    );
  }

  /** Return metadata for the currently active adapter. */
  getActiveAdapter(): AdapterMeta {
    const adapter = this.adapters.get(this.activeAdapterId);
    if (!adapter) throw new Error(`Adapter "${this.activeAdapterId}" not found`);
    return adapter;
  }

  /**
   * Switch the active data adapter.
   * @param id One of: 'python-backend', 'tencent', 'sina', 'eastmoney'.
   * @throws If the given id is not registered.
   */
  setActiveAdapter(id: string): void {
    if (!this.adapters.has(id as any)) {
      throw new Error(`Unknown adapter id: "${id}". Available: ${[...this.adapters.keys()].join(', ')}`);
    }
    this.activeAdapterId = id;
  }

  // -- Public API (maps to UI types) ----------------------------------------

  /**
   * Fetch real-time snapshots for the default symbol list and map them to
   * the UI-facing MarketTicker type.
   */
  async fetchStockTickers(): Promise<MarketTicker[]> {
    const adapter = this.adapters.get(this.activeAdapterId)!;
    const snapshots = await adapter.fetchSnapshots([...DEFAULT_STOCK_SYMBOLS]);
    return snapshots.map((s) => ({
      symbol: s.symbol,
      name: s.name,
      price: s.price,
      change: s.change,
      changePercent: s.changePercent,
      volume: s.volume,
      high: s.high,
      low: s.low,
      timestamp: s.timestamp,
      bid: s.bid,
      bidSize: s.bidSize,
      ask: s.ask,
      askSize: s.askSize,
    }));
  }

  /**
   * Fetch OHLCV candlestick data and map it to the UI-facing CandleData type.
   *
   * @param symbol Symbol in sh/sz prefix format.
   * @param timeframe UI timeframe key: '1M', '5M', '15M', '30M', '1H', '1D', '1W'.
   */
  async fetchStockKlines(symbol: string, timeframe: string): Promise<CandleData[]> {
    const adapter = this.adapters.get(this.activeAdapterId)!;
    const minutePeriod = MINUTE_PERIOD_MAP[timeframe];

    // Date range for daily klines: past 1 year.
    const endDate = new Date();
    const startDate = new Date(endDate);
    startDate.setFullYear(startDate.getFullYear() - 1);
    const startStr = startDate.toISOString().slice(0, 10).replace(/-/g, '');
    const endStr = endDate.toISOString().slice(0, 10).replace(/-/g, '');

    const klines = minutePeriod != null
      ? await adapter.fetchMinuteKlines(symbol, minutePeriod)
      : await adapter.fetchDailyKlines(
          symbol,
          DAILY_PERIOD_MAP[timeframe] ?? 'daily',
          startStr,
          endStr,
          'qfq',
        );

    return klines.map((k) => ({
      time: k.time,
      open: k.open,
      high: k.high,
      low: k.low,
      close: k.close,
      volume: k.volume,
    }));
  }
}

// Singleton — import this instance directly.
const stockDataService = new StockDataService();

export default stockDataService;

// ---------------------------------------------------------------------------
// Named exports preserving the original API surface consumed by App.tsx.
// ---------------------------------------------------------------------------

/** @see StockDataService.fetchStockTickers */
export const fetchStockTickers = (): Promise<MarketTicker[]> =>
  stockDataService.fetchStockTickers();

/** @see StockDataService.fetchStockKlines */
export const fetchStockKlines = (symbol: string, timeframe: string): Promise<CandleData[]> =>
  stockDataService.fetchStockKlines(symbol, timeframe);
