/**
 * Tencent Finance Adapter (腾讯财经)
 *
 * Uses the public Tencent Finance market data API.
 *
 * Cost:       免费，无需注册 (Free, no registration)
 * Browser:    ✅ Works — API returns Access-Control-Allow-Origin: *
 * Endpoints:
 *   Real-time: https://qt.gtimg.cn/q=sh600519,sz000858
 *   Daily:     https://web.ifzq.gtimg.cn/appstock/app/fqkline/get?param={symbol},day,,,{limit},{adjust}
 *   Minute:    https://web.ifzq.gtimg.cn/appstock/app/kline/mkline?param={symbol},{interval},,{limit}
 */

import type { IStockDataAdapter } from '../IStockDataAdapter';
import type { StockSnapshot, StockKline, MinutePeriod, DailyPeriod } from '../types';

const QT_BASE = 'https://qt.gtimg.cn';
const KLINE_BASE = 'https://web.ifzq.gtimg.cn/appstock/app';

/**
 * Parse a Tencent real-time quote string.
 *
 * Response line format (fields delimited by "~"):
 *   v_{symbol}="1~name~code~price~prevClose~open~vol~...~date~time~change~changePct~high~low~vol~amount~..."
 *
 * Key field indices:
 *   [1]  name        [2]  code       [3]  price
 *   [4]  prevClose   [5]  open       [6]  volume (lots)
 *   [9]  bid1        [19] ask1
 *   [30] date        [31] time
 *   [32] change      [33] changePct  [34] high  [35] low
 *   [37] amount (CNY)
 */
function parseTencentQuoteLine(rawLine: string, originalSymbol: string): StockSnapshot | null {
  // Strip surrounding quotes and the variable assignment prefix.
  const inner = rawLine.replace(/^v_[^=]+=["']|["'];?\s*$/g, '');
  if (!inner || inner === '-1') return null; // API returns "-1" for unknown symbols.

  const f = inner.split('~');
  if (f.length < 38) return null;

  const price = parseFloat(f[3]);
  const prevClose = parseFloat(f[4]);
  if (isNaN(price) || price <= 0) return null;

  const change = parseFloat(f[32]) || price - prevClose;
  const changePct = parseFloat(f[33]) || (prevClose > 0 ? (change / prevClose) * 100 : 0);

  return {
    symbol: originalSymbol,
    name: f[1],
    price,
    open: parseFloat(f[5]) || prevClose,
    prevClose,
    high: parseFloat(f[34]) || price,
    low: parseFloat(f[35]) || price,
    volume: parseFloat(f[6]) || 0,
    amount: parseFloat(f[37]) || 0,
    change,
    changePercent: changePct,
    bid: parseFloat(f[9]) || undefined,
    ask: parseFloat(f[19]) || undefined,
    timestamp: Date.now(),
  };
}

/**
 * Convert a Tencent kline array entry to StockKline.
 * Tencent field order: [date/datetime, open, close, high, low, volume]
 * NOTE: close is index 2, high is index 3, low is index 4 (differs from standard OHLCV order).
 */
function parseTencentKlineEntry(entry: any[]): StockKline | null {
  if (!Array.isArray(entry) || entry.length < 6) return null;
  return {
    time: String(entry[0]),
    open: parseFloat(entry[1]),
    high: parseFloat(entry[3]),
    low: parseFloat(entry[4]),
    close: parseFloat(entry[2]),
    volume: parseFloat(entry[5]),
  };
}

export class TencentAdapter implements IStockDataAdapter {
  readonly id = 'tencent';
  readonly name = '腾讯财经';
  readonly provider = 'Tencent Finance (腾讯财经)';
  readonly isFree = true;
  readonly costNote = '免费，无需注册';
  readonly browserCompatible = true;
  readonly notes = 'Good reliability. Real-time quotes refresh every ~3 s. No price adjustment for daily klines.';

  async fetchSnapshots(symbols: string[]): Promise<StockSnapshot[]> {
    if (symbols.length === 0) return [];

    try {
      // Tencent accepts a comma-separated list of symbols directly.
      const url = `${QT_BASE}/q=${symbols.join(',')}`;
      const response = await fetch(url);
      if (!response.ok) throw new Error(`HTTP ${response.status}`);

      const text = await response.text();
      const snapshots: StockSnapshot[] = [];

      // Each symbol produces one line like: v_sh600519="...";\n
      for (const symbol of symbols) {
        const lineRegex = new RegExp(`v_${symbol}="[^"]*"`, 'i');
        const match = text.match(lineRegex);
        if (!match) continue;

        const parsed = parseTencentQuoteLine(match[0], symbol);
        if (parsed) snapshots.push(parsed);
      }

      return snapshots;
    } catch (error) {
      console.error('TencentAdapter fetchSnapshots error:', error);
      return [];
    }
  }

  async fetchDailyKlines(
    symbol: string,
    period: DailyPeriod,
    _startDate: string,
    _endDate: string,
    adjust: 'qfq' | 'hfq' | '' = 'qfq',
  ): Promise<StockKline[]> {
    // Tencent's fqkline API takes a limit not date ranges; we request 365 bars.
    const limit = 365;
    const periodMap: Record<DailyPeriod, string> = {
      daily: 'day',
      weekly: 'week',
      monthly: 'month',
    };
    const tencentPeriod = periodMap[period] ?? 'day';
    const adjustParam = adjust || 'not'; // "not" means unadjusted in Tencent's API.

    try {
      const url = `${KLINE_BASE}/fqkline/get?param=${symbol},${tencentPeriod},,,${limit},${adjustParam}`;
      const response = await fetch(url);
      if (!response.ok) throw new Error(`HTTP ${response.status}`);

      const json = await response.json();
      const entries: any[][] = json?.data?.[symbol]?.[tencentPeriod] ?? [];

      return entries.flatMap((entry) => {
        const kline = parseTencentKlineEntry(entry);
        return kline ? [kline] : [];
      });
    } catch (error) {
      console.error(`TencentAdapter fetchDailyKlines error (${symbol}):`, error);
      return [];
    }
  }

  async fetchMinuteKlines(symbol: string, period: MinutePeriod): Promise<StockKline[]> {
    // Tencent minute intervals: m1, m5, m15, m30, m60
    const intervalMap: Record<MinutePeriod, string> = {
      '1': 'm1',
      '5': 'm5',
      '15': 'm15',
      '30': 'm30',
      '60': 'm60',
    };
    const interval = intervalMap[period];
    const limit = 240; // ~4 h of 1-min bars, or full day for 5-min bars.

    try {
      const url = `${KLINE_BASE}/kline/mkline?param=${symbol},${interval},,${limit}`;
      const response = await fetch(url);
      if (!response.ok) throw new Error(`HTTP ${response.status}`);

      const json = await response.json();
      const entries: any[][] = json?.data?.[symbol]?.[interval] ?? [];

      return entries.flatMap((entry) => {
        const kline = parseTencentKlineEntry(entry);
        return kline ? [kline] : [];
      });
    } catch (error) {
      console.error(`TencentAdapter fetchMinuteKlines error (${symbol}):`, error);
      return [];
    }
  }
}
