/**
 * BaoStock Adapter (百股通 / BaoStock)
 *
 * Fetches A-share data from the local QuantCore Pro Python backend.
 *
 * Cost:       免费，需要注册（免费账号） (Free, requires free registration)
 * Browser:    ❌ Requires the local Python backend (port 5000)
 * Data type:  End-of-day (非实时) — snapshots reflect the latest available
 *             closing price, not intraday ticks.
 * Minute bars: 5 / 15 / 30 / 60 min only (1-min NOT supported by BaoStock)
 *
 * Local Python backend endpoints:
 *   GET /api/baostock/snapshot?symbols=...
 *   GET /api/baostock/klines/daily?symbol=...&period=...&start=...&end=...&adjust=...
 *   GET /api/baostock/klines/minute?symbol=...&period=...
 *   GET /api/baostock/profit?symbol=...&year=...&quarter=...
 *   GET /api/baostock/operation?symbol=...&year=...&quarter=...
 *   GET /api/baostock/growth?symbol=...&year=...&quarter=...
 *   GET /api/baostock/balance?symbol=...&year=...&quarter=...
 *   GET /api/baostock/cash_flow?symbol=...&year=...&quarter=...
 *   GET /api/baostock/dupont?symbol=...&year=...&quarter=...
 *   GET /api/baostock/stock_basic?symbol=...
 *   GET /api/baostock/trade_dates?start=...&end=...
 *   GET /api/baostock/all_stocks?date=...
 *   GET /api/baostock/index/sz50?date=...
 *   GET /api/baostock/index/hs300?date=...
 *   GET /api/baostock/index/zz500?date=...
 */

import type { IStockDataAdapter } from '../IStockDataAdapter';
import type { StockSnapshot, StockKline, MinutePeriod, DailyPeriod } from '../types';

const API_BASE = 'http://localhost:5000/api/baostock';

/** 1-min bars are not supported by BaoStock; map to 5-min as the closest alternative. */
const MINUTE_PERIOD_MAP: Record<MinutePeriod, string> = {
  '1': '5',   // BaoStock has no 1-min data; fall back to 5-min
  '5': '5',
  '15': '15',
  '30': '30',
  '60': '60',
};

// ---------------------------------------------------------------------------
// Types for fundamental / reference data
// ---------------------------------------------------------------------------

export interface BaoStockFundamentalResult {
  data: Record<string, string>[];
  fields: string[];
}

export interface BaoStockStockBasicResult {
  data: Record<string, string>;
}

export interface BaoStockTradeDatesResult {
  dates: string[];
}

export interface BaoStockAllStocksResult {
  stocks: Record<string, string>[];
}

export interface BaoStockIndexResult {
  stocks: Record<string, string>[];
}

// ---------------------------------------------------------------------------
// Adapter
// ---------------------------------------------------------------------------

export class BaoStockAdapter implements IStockDataAdapter {
  readonly id = 'baostock';
  readonly name = 'BaoStock (百股通)';
  readonly provider = 'BaoStock (百股通)';
  readonly isFree = true;
  readonly costNote = '免费，需要注册免费账号';
  readonly browserCompatible = false;
  readonly notes =
    'End-of-day data only (no intraday ticks). ' +
    'Minute bars: 5/15/30/60 min (1-min unsupported). ' +
    'Requires the local Python backend on port 5000.';
  readonly capabilities = ['realtime', 'dailyKlines', 'minuteKlines'] as const;

  // ─── Core IStockDataAdapter methods ──────────────────────────────────────

  async fetchSnapshots(symbols: string[]): Promise<StockSnapshot[]> {
    if (symbols.length === 0) return [];
    try {
      const url = `${API_BASE}/snapshot?symbols=${symbols.join(',')}`;
      const response = await fetch(url);
      if (!response.ok) throw new Error(`HTTP ${response.status}`);
      const json = await response.json();
      return (json.snapshots ?? []).map((s: any): StockSnapshot => ({
        symbol: s.symbol,
        name: s.name ?? s.symbol,
        price: s.price,
        open: s.open,
        prevClose: s.prevClose,
        high: s.high,
        low: s.low,
        volume: s.volume,
        amount: s.amount,
        change: s.change,
        changePercent: s.changePercent,
        timestamp: s.timestamp,
      }));
    } catch (error) {
      console.error('BaoStockAdapter fetchSnapshots error:', error);
      return [];
    }
  }

  async fetchDailyKlines(
    symbol: string,
    period: DailyPeriod,
    startDate: string,
    endDate: string,
    adjust: 'qfq' | 'hfq' | '' = 'qfq',
  ): Promise<StockKline[]> {
    try {
      const params = new URLSearchParams({
        symbol,
        period,
        start: startDate,
        end: endDate,
        adjust,
      });
      const response = await fetch(`${API_BASE}/klines/daily?${params}`);
      if (!response.ok) throw new Error(`HTTP ${response.status}`);
      const json = await response.json();
      return (json.klines ?? []).map((k: any): StockKline => ({
        time: k.time,
        open: k.open,
        high: k.high,
        low: k.low,
        close: k.close,
        volume: k.volume,
      }));
    } catch (error) {
      console.error(`BaoStockAdapter fetchDailyKlines error (${symbol}):`, error);
      return [];
    }
  }

  async fetchMinuteKlines(symbol: string, period: MinutePeriod): Promise<StockKline[]> {
    const bsPeriod = MINUTE_PERIOD_MAP[period];
    if (period === '1') {
      console.warn('BaoStockAdapter: 1-min bars unsupported; returning 5-min bars instead.');
    }
    try {
      const params = new URLSearchParams({ symbol, period: bsPeriod });
      const response = await fetch(`${API_BASE}/klines/minute?${params}`);
      if (!response.ok) throw new Error(`HTTP ${response.status}`);
      const json = await response.json();
      return (json.klines ?? []).map((k: any): StockKline => ({
        time: k.time,
        open: k.open,
        high: k.high,
        low: k.low,
        close: k.close,
        volume: k.volume,
      }));
    } catch (error) {
      console.error(`BaoStockAdapter fetchMinuteKlines error (${symbol}):`, error);
      return [];
    }
  }

  // ─── Fundamental data methods ────────────────────────────────────────────

  /** Fetch quarterly profitability data (季频盈利能力). */
  async fetchProfitData(symbol: string, year: number, quarter: number): Promise<BaoStockFundamentalResult> {
    return this._fetchFundamental('profit', symbol, year, quarter);
  }

  /** Fetch quarterly operation data (季频营运能力). */
  async fetchOperationData(symbol: string, year: number, quarter: number): Promise<BaoStockFundamentalResult> {
    return this._fetchFundamental('operation', symbol, year, quarter);
  }

  /** Fetch quarterly growth data (季频成长能力). */
  async fetchGrowthData(symbol: string, year: number, quarter: number): Promise<BaoStockFundamentalResult> {
    return this._fetchFundamental('growth', symbol, year, quarter);
  }

  /** Fetch quarterly balance sheet data (季频偿债能力). */
  async fetchBalanceData(symbol: string, year: number, quarter: number): Promise<BaoStockFundamentalResult> {
    return this._fetchFundamental('balance', symbol, year, quarter);
  }

  /** Fetch quarterly cash flow data (季频现金流量). */
  async fetchCashFlowData(symbol: string, year: number, quarter: number): Promise<BaoStockFundamentalResult> {
    return this._fetchFundamental('cash_flow', symbol, year, quarter);
  }

  /** Fetch quarterly DuPont analysis data (季频杜邦指数). */
  async fetchDupontData(symbol: string, year: number, quarter: number): Promise<BaoStockFundamentalResult> {
    return this._fetchFundamental('dupont', symbol, year, quarter);
  }

  // ─── Reference data methods ──────────────────────────────────────────────

  /** Fetch stock basic info (证券资料). */
  async fetchStockBasic(symbol: string): Promise<BaoStockStockBasicResult> {
    try {
      const res = await fetch(`${API_BASE}/stock_basic?symbol=${encodeURIComponent(symbol)}`);
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      return await res.json();
    } catch (error) {
      console.error('BaoStockAdapter fetchStockBasic error:', error);
      return { data: {} };
    }
  }

  /** Fetch trading calendar (交易日历). */
  async fetchTradeDates(startDate: string, endDate: string): Promise<string[]> {
    try {
      const params = new URLSearchParams({ start: startDate, end: endDate });
      const res = await fetch(`${API_BASE}/trade_dates?${params}`);
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const json = await res.json();
      return json.dates ?? [];
    } catch (error) {
      console.error('BaoStockAdapter fetchTradeDates error:', error);
      return [];
    }
  }

  /** Fetch all stocks on a given date (证券代码列表). */
  async fetchAllStocks(date: string): Promise<Record<string, string>[]> {
    try {
      const res = await fetch(`${API_BASE}/all_stocks?date=${encodeURIComponent(date)}`);
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const json = await res.json();
      return json.stocks ?? [];
    } catch (error) {
      console.error('BaoStockAdapter fetchAllStocks error:', error);
      return [];
    }
  }

  /** Fetch SSE 50 index constituents (上证50成分股). */
  async fetchSZ50(date?: string): Promise<Record<string, string>[]> {
    return this._fetchIndex('sz50', date);
  }

  /** Fetch CSI 300 index constituents (沪深300成分股). */
  async fetchHS300(date?: string): Promise<Record<string, string>[]> {
    return this._fetchIndex('hs300', date);
  }

  /** Fetch CSI 500 index constituents (中证500成分股). */
  async fetchZZ500(date?: string): Promise<Record<string, string>[]> {
    return this._fetchIndex('zz500', date);
  }

  // ─── Helpers ─────────────────────────────────────────────────────────────

  private async _fetchFundamental(
    endpoint: string,
    symbol: string,
    year: number,
    quarter: number,
  ): Promise<BaoStockFundamentalResult> {
    try {
      const params = new URLSearchParams({
        symbol,
        year: String(year),
        quarter: String(quarter),
      });
      const res = await fetch(`${API_BASE}/${endpoint}?${params}`);
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      return await res.json();
    } catch (error) {
      console.error(`BaoStockAdapter ${endpoint} error:`, error);
      return { data: [], fields: [] };
    }
  }

  private async _fetchIndex(index: string, date?: string): Promise<Record<string, string>[]> {
    try {
      const url = date
        ? `${API_BASE}/index/${index}?date=${encodeURIComponent(date)}`
        : `${API_BASE}/index/${index}`;
      const res = await fetch(url);
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const json = await res.json();
      return json.stocks ?? [];
    } catch (error) {
      console.error(`BaoStockAdapter ${index} error:`, error);
      return [];
    }
  }
}
