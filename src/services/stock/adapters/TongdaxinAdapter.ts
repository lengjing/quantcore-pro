/**
 * Tongdaxin (通达信) Adapter
 *
 * Fetches A-share data from the local QuantCore Pro Python backend via pytdx.
 *
 * Cost:       免费 (Free)
 * Browser:    ❌ Requires the local Python backend (port 5000)
 * Data:       Real-time quotes and K-lines via Tongdaxin HQ servers
 *
 * Local Python backend endpoints:
 *   GET /api/tdx/snapshot?symbols=...
 *   GET /api/tdx/klines/daily?symbol=...&period=...&start=...&end=...
 *   GET /api/tdx/klines/minute?symbol=...&period=...
 */

import type { IStockDataAdapter } from '../IStockDataAdapter';
import type { StockSnapshot, StockKline, MinutePeriod, DailyPeriod } from '../types';

const API_BASE = 'http://localhost:5000/api/tdx';

export class TongdaxinAdapter implements IStockDataAdapter {
  readonly id = 'tongdaxin';
  readonly name = '通达信';
  readonly provider = 'Tongdaxin (通达信)';
  readonly isFree = true;
  readonly costNote = '免费，需本地 Python 后端';
  readonly browserCompatible = false;
  readonly notes =
    'Real-time quotes and K-lines via pytdx Tongdaxin HQ servers. ' +
    'Unadjusted prices. Requires the local Python backend on port 5000.';
  readonly capabilities = ['realtime', 'dailyKlines', 'minuteKlines'] as const;

  async fetchSnapshots(symbols: string[]): Promise<StockSnapshot[]> {
    if (symbols.length === 0) return [];
    try {
      const url = `${API_BASE}/snapshot?symbols=${symbols.join(',')}`;
      const response = await fetch(url);
      if (!response.ok) throw new Error(`HTTP ${response.status}`);
      const json = await response.json();
      return (json.snapshots ?? []).map((s: Record<string, unknown>): StockSnapshot => ({
        symbol: String(s.symbol),
        name: String(s.name ?? s.symbol),
        price: Number(s.price),
        open: Number(s.open),
        prevClose: Number(s.prevClose),
        high: Number(s.high),
        low: Number(s.low),
        volume: Number(s.volume),
        amount: Number(s.amount),
        change: Number(s.change),
        changePercent: Number(s.changePercent),
        bid: s.bid != null ? Number(s.bid) : undefined,
        bidSize: s.bidSize != null ? Number(s.bidSize) : undefined,
        ask: s.ask != null ? Number(s.ask) : undefined,
        askSize: s.askSize != null ? Number(s.askSize) : undefined,
        timestamp: Number(s.timestamp),
      }));
    } catch (error) {
      console.error('TongdaxinAdapter fetchSnapshots error:', error);
      return [];
    }
  }

  async fetchDailyKlines(
    symbol: string,
    period: DailyPeriod,
    startDate: string,
    endDate: string,
    _adjust: 'qfq' | 'hfq' | '' = '',
  ): Promise<StockKline[]> {
    try {
      const params = new URLSearchParams({
        symbol,
        period,
        start: startDate,
        end: endDate,
      });
      const response = await fetch(`${API_BASE}/klines/daily?${params}`);
      if (!response.ok) throw new Error(`HTTP ${response.status}`);
      const json = await response.json();
      return (json.klines ?? []).map((k: Record<string, unknown>): StockKline => ({
        time: String(k.time),
        open: Number(k.open),
        high: Number(k.high),
        low: Number(k.low),
        close: Number(k.close),
        volume: Number(k.volume),
      }));
    } catch (error) {
      console.error(`TongdaxinAdapter fetchDailyKlines error (${symbol}):`, error);
      return [];
    }
  }

  async fetchMinuteKlines(symbol: string, period: MinutePeriod): Promise<StockKline[]> {
    try {
      const params = new URLSearchParams({ symbol, period });
      const response = await fetch(`${API_BASE}/klines/minute?${params}`);
      if (!response.ok) throw new Error(`HTTP ${response.status}`);
      const json = await response.json();
      return (json.klines ?? []).map((k: Record<string, unknown>): StockKline => ({
        time: String(k.time),
        open: Number(k.open),
        high: Number(k.high),
        low: Number(k.low),
        close: Number(k.close),
        volume: Number(k.volume),
      }));
    } catch (error) {
      console.error(`TongdaxinAdapter fetchMinuteKlines error (${symbol}):`, error);
      return [];
    }
  }
}
