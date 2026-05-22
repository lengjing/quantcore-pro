/**
 * BaoStock Adapter (百股通 / BaoStock)
 *
 * Fetches A-share data from BaoStock via the QuantCore Pro Python backend.
 * BaoStock is a Python-only library, so all calls are proxied through
 * the local Flask server at port 5000.
 *
 * Cost:       免费，需要注册（免费账号） (Free, requires free registration)
 * Browser:    ❌ Requires Electron / local Python backend (port 5000)
 * Data type:  End-of-day (非实时) — snapshots reflect the latest available
 *             closing price, not intraday ticks.
 * Minute bars: 5 / 15 / 30 / 60 min only (1-min NOT supported by BaoStock)
 *
 * Endpoints (Python backend):
 *   GET /api/baostock/snapshot?symbols=...
 *   GET /api/baostock/klines/daily?symbol=...&period=...&start=...&end=...&adjust=...
 *   GET /api/baostock/klines/minute?symbol=...&period=...
 */

import type { IStockDataAdapter } from '../IStockDataAdapter';
import type { StockSnapshot, StockKline, MinutePeriod, DailyPeriod } from '../types';

/** Base URL for the local Python backend. Configurable via env var at build time. */
const BACKEND_BASE =
  (typeof process !== 'undefined' && process.env.QUANTCORE_API_URL) ||
  'http://localhost:5000';

const API_BASE = `${BACKEND_BASE}/api/baostock`;

/** 1-min bars are not supported by BaoStock; map to 5-min as the closest alternative. */
const MINUTE_PERIOD_MAP: Record<MinutePeriod, string> = {
  '1': '5',   // BaoStock has no 1-min data; fall back to 5-min
  '5': '5',
  '15': '15',
  '30': '30',
  '60': '60',
};

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
    'Requires local Python backend on port 5000.';

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
}
