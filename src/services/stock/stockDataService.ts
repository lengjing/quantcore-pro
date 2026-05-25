/**
 * Stock Data Service
 *
 * Central registry for A-share data adapters. Exposes a unified API that maps
 * adapter-specific types (StockSnapshot / StockKline) to the UI-facing types
 * (MarketTicker / CandleData) that App.tsx already consumes.
 *
 * Supports two operating modes:
 *   1. **Single adapter** (default): All requests route to one active adapter.
 *   2. **Multi-adapter**: Each capability (realtime, dailyKlines, minuteKlines)
 *      can be independently assigned to a different adapter, allowing multiple
 *      data sources to work simultaneously.
 *
 * Usage:
 *   // List available adapters
 *   stockDataService.getAdapters();
 *
 *   // Switch the active adapter (single-mode, for backward compat)
 *   stockDataService.setActiveAdapter('tencent');
 *
 *   // Multi-adapter: assign capabilities to specific adapters
 *   stockDataService.setCapabilityAdapter('realtime', 'eastmoney');
 *   stockDataService.setCapabilityAdapter('dailyKlines', 'baostock');
 *   stockDataService.setMultiAdapterMode(true);
 */

import type { IStockDataAdapter, AdapterMeta, AdapterCapability } from './IStockDataAdapter';
import type { CandleData, MarketTicker } from '../../types';
import type { DailyPeriod, MinutePeriod } from './types';

import { TencentAdapter } from './adapters/TencentAdapter';
import { SinaAdapter } from './adapters/SinaAdapter';
import { EastMoneyAdapter } from './adapters/EastMoneyAdapter';
import { BaoStockAdapter } from './adapters/BaoStockAdapter';

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

/** All supported capability types. */
const ALL_CAPABILITIES: readonly AdapterCapability[] = ['realtime', 'dailyKlines', 'minuteKlines'];

// ---------------------------------------------------------------------------
// Adapter registry
// ---------------------------------------------------------------------------

class StockDataService {
  private readonly adapters: Map<string, IStockDataAdapter>;

  constructor() {
    this.adapters = new Map<string, IStockDataAdapter>();
    this.adapters.set('tencent', new TencentAdapter());
    this.adapters.set('sina', new SinaAdapter());
    this.adapters.set('eastmoney', new EastMoneyAdapter());
    this.adapters.set('baostock', new BaoStockAdapter());
  }

  /** ID of the currently active adapter. Defaults to EastMoney (browser-compatible, supports adjustment). */
  private activeAdapterId: string = 'eastmoney';

  /** Whether multi-adapter routing is enabled. */
  private multiAdapterEnabled: boolean = false;

  /** Per-capability adapter assignments for multi-adapter mode. */
  private capabilityMap: Record<AdapterCapability, string> = {
    realtime: 'eastmoney',
    dailyKlines: 'eastmoney',
    minuteKlines: 'eastmoney',
  };

  // -- Adapter management ---------------------------------------------------

  /** Return static metadata for all registered adapters. */
  getAdapters(): AdapterMeta[] {
    return Array.from(this.adapters.values()).map(
      ({ id, name, provider, isFree, costNote, browserCompatible, notes, capabilities }) => ({
        id,
        name,
        provider,
        isFree,
        costNote,
        browserCompatible,
        notes,
        capabilities: capabilities ?? [...ALL_CAPABILITIES],
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
   * Switch the active data adapter (single-adapter mode).
   * @param id One of: 'tencent', 'sina', 'eastmoney', 'baostock'.
   * @throws If the given id is not registered.
   */
  setActiveAdapter(id: string): void {
    if (!this.adapters.has(id)) {
      throw new Error(`Unknown adapter id: "${id}". Available: ${[...this.adapters.keys()].join(', ')}`);
    }
    this.activeAdapterId = id;
  }

  // -- Multi-adapter management ─────────────────────────────────────────────

  /** Enable or disable multi-adapter mode. */
  setMultiAdapterMode(enabled: boolean): void {
    this.multiAdapterEnabled = enabled;
  }

  /** Check if multi-adapter mode is active. */
  isMultiAdapterMode(): boolean {
    return this.multiAdapterEnabled;
  }

  /**
   * Assign a specific adapter to handle a capability.
   * @param capability The capability to assign.
   * @param adapterId The adapter ID to handle this capability.
   */
  setCapabilityAdapter(capability: AdapterCapability, adapterId: string): void {
    if (!this.adapters.has(adapterId)) {
      throw new Error(`Unknown adapter id: "${adapterId}"`);
    }
    this.capabilityMap[capability] = adapterId;
  }

  /** Get the current capability → adapter mapping. */
  getCapabilityMap(): Record<AdapterCapability, string> {
    return { ...this.capabilityMap };
  }

  /**
   * Resolve the adapter to use for a given capability.
   * In single mode, returns the active adapter.
   * In multi mode, returns the adapter assigned to the capability.
   */
  private resolveAdapter(capability: AdapterCapability): IStockDataAdapter {
    const id = this.multiAdapterEnabled
      ? this.capabilityMap[capability]
      : this.activeAdapterId;
    return this.adapters.get(id) ?? this.adapters.get(this.activeAdapterId)!;
  }

  // -- Public API (maps to UI types) ----------------------------------------

  /**
   * Fetch real-time snapshots for the default symbol list and map them to
   * the UI-facing MarketTicker type.
   */
  async fetchStockTickers(): Promise<MarketTicker[]> {
    const adapter = this.resolveAdapter('realtime');
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
    const minutePeriod = MINUTE_PERIOD_MAP[timeframe];
    const capability: AdapterCapability = minutePeriod != null ? 'minuteKlines' : 'dailyKlines';
    const adapter = this.resolveAdapter(capability);

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
