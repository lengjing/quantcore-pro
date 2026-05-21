/**
 * Python Backend Adapter
 *
 * Delegates to the local Flask + akshare server running on port 5000.
 * Start it with: `cd python && python main.py`
 *
 * Cost:    免费 (Free) — akshare is an open-source library
 * Requires: Local Python server (see python/main.py)
 * Browser:  ✅ Works (same-origin or CORS-enabled localhost)
 */

import type { IStockDataAdapter, AdapterMeta } from '../IStockDataAdapter';
import type { StockSnapshot, StockKline, MinutePeriod, DailyPeriod } from '../types';

const API_BASE = 'http://localhost:5000/api/stock';

/** Strip the "sh" / "sz" market prefix, returning just the numeric code. */
const stripPrefix = (symbol: string): string =>
  symbol.startsWith('sh') || symbol.startsWith('sz') ? symbol.slice(2) : symbol;

export class PythonBackendAdapter implements IStockDataAdapter {
  readonly id = 'python-backend';
  readonly name = 'Python / akshare Backend';
  readonly provider = 'akshare (东方财富、同花顺等多数据源聚合)';
  readonly isFree = true;
  readonly costNote = '免费，需要本地 Python 服务 (cd python && python main.py)';
  readonly browserCompatible = true;
  readonly notes = 'Highest data quality. Supports qfq/hfq adjustment. Requires the local Flask server.';

  async fetchSnapshots(symbols: string[]): Promise<StockSnapshot[]> {
    if (symbols.length === 0) return [];

    try {
      const url = `${API_BASE}/snapshot?symbols=${symbols.join(',')}`;
      const response = await fetch(url);
      if (!response.ok) throw new Error(`HTTP ${response.status}`);

      const data: any[] = await response.json();
      return data.map((item) => ({
        symbol: item.symbol,
        name: item.name ?? '',
        price: Number(item.price) || 0,
        open: Number(item.open) || 0,
        prevClose: Number(item.prevClose) || 0,
        high: Number(item.high) || 0,
        low: Number(item.low) || 0,
        volume: Number(item.volume) || 0,
        amount: Number(item.amount) || 0,
        change: Number(item.change) || 0,
        changePercent: Number(item.changePercent) || 0,
        bid: item.bid != null ? Number(item.bid) : undefined,
        bidSize: item.bidSize != null ? Number(item.bidSize) : undefined,
        ask: item.ask != null ? Number(item.ask) : undefined,
        askSize: item.askSize != null ? Number(item.askSize) : undefined,
        timestamp: Number(item.timestamp) || Date.now(),
      }));
    } catch (error) {
      console.error('PythonBackendAdapter fetchSnapshots error:', error);
      return [];
    }
  }

  async fetchDailyKlines(
    symbol: string,
    period: DailyPeriod,
    startDate: string,
    endDate: string,
    _adjust: 'qfq' | 'hfq' | '' = 'qfq',
  ): Promise<StockKline[]> {
    try {
      const url = `${API_BASE}/klines?symbol=${symbol}&period=${period}&start=${startDate}&end=${endDate}`;
      const response = await fetch(url);
      if (!response.ok) throw new Error(`HTTP ${response.status}`);

      const data: any[] = await response.json();
      return data.map((item) => ({
        time: String(item.time),
        open: Number(item.open),
        high: Number(item.high),
        low: Number(item.low),
        close: Number(item.close),
        volume: Number(item.volume),
      }));
    } catch (error) {
      console.error(`PythonBackendAdapter fetchDailyKlines error (${symbol}):`, error);
      return [];
    }
  }

  async fetchMinuteKlines(symbol: string, period: MinutePeriod): Promise<StockKline[]> {
    try {
      const url = `${API_BASE}/klines_minute?symbol=${symbol}&period=${period}`;
      const response = await fetch(url);
      if (!response.ok) throw new Error(`HTTP ${response.status}`);

      const data: any[] = await response.json();
      return data.map((item) => ({
        time: String(item.time),
        open: Number(item.open),
        high: Number(item.high),
        low: Number(item.low),
        close: Number(item.close),
        volume: Number(item.volume),
      }));
    } catch (error) {
      console.error(`PythonBackendAdapter fetchMinuteKlines error (${symbol}):`, error);
      return [];
    }
  }
}
