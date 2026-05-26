/**
 * East Money Adapter (东方财富)
 *
 * Uses the public East Money market data API.
 *
 * Cost:       免费，无需注册 (Free, no registration)
 * Browser:    ✅ Works — API sends permissive CORS headers
 * Endpoints:
 *   Real-time: https://push2.eastmoney.com/api/qt/ulist.np/get
 *   Daily:     https://push2his.eastmoney.com/api/qt/stock/kline/get  (klt=101/102/103)
 *   Minute:    https://push2his.eastmoney.com/api/qt/stock/kline/get  (klt=1/5/15/30/60)
 */

import type { IStockDataAdapter } from '../IStockDataAdapter';
import type { StockSnapshot, StockKline, MinutePeriod, DailyPeriod } from '../types';
import { fetchJson } from '../../../utils/fetchJson';

const PUSH2_BASE = 'https://push2.eastmoney.com';
const PUSH2HIS_BASE = 'https://push2his.eastmoney.com';

/**
 * Convert a sh/sz-prefixed symbol to East Money's "market.code" secid format.
 *
 * Market codes:
 *   1 = Shanghai (沪)  — sh prefix, or 6xxxxx / index 0xxxxx/1xxxxx
 *   0 = Shenzhen (深)  — sz prefix, or 0xxxxx / 3xxxxx
 */
function toSecId(symbol: string): string {
  const code = symbol.startsWith('sh') || symbol.startsWith('sz') ? symbol.slice(2) : symbol;
  const market = symbol.startsWith('sh') ? '1' : '0';
  return `${market}.${code}`;
}

/** Shape of a single "diff" item from the East Money real-time quote API. */
interface EastMoneyDiffItem {
  f2: number | string;   // current price
  f3: number | string;   // changePct (%)
  f4: number | string;   // change amount
  f5: number | string;   // volume (lots)
  f6: number | string;   // amount (CNY)
  f12: string;           // stock code
  f14: string;           // stock name
  f15: number | string;  // high
  f16: number | string;  // low
  f17: number | string;  // open
  f18: number | string;  // prevClose
}

/**
 * Parse a single East Money "diff" item into a StockSnapshot.
 *
 * Field mapping (with fltt=2, prices are direct decimals):
 *   f2  current price    f3  changePct (%)   f4  change amount
 *   f5  volume (lots)    f6  amount (CNY)    f7  amplitude
 *   f12 stock code       f14 stock name
 *   f15 high             f16 low
 *   f17 open             f18 prevClose
 */
function parseDiffItem(item: EastMoneyDiffItem, originalSymbol: string): StockSnapshot | null {
  const price = Number(item.f2);
  if (isNaN(price) || price <= 0) return null;

  return {
    symbol: originalSymbol,
    name: item.f14 ?? '',
    price,
    open: Number(item.f17) || price,
    prevClose: Number(item.f18) || price,
    high: Number(item.f15) || price,
    low: Number(item.f16) || price,
    volume: Number(item.f5) || 0,
    amount: Number(item.f6) || 0,
    change: Number(item.f4) || 0,
    changePercent: Number(item.f3) || 0,
    timestamp: Date.now(),
  };
}

/**
 * Parse an East Money kline string entry.
 *
 * Kline string format (comma-separated):
 *   f51 date/datetime, f52 open, f53 close, f54 high, f55 low, f56 volume (lots), f57 amount, ...
 */
function parseKlineEntry(entry: string): StockKline | null {
  const f = entry.split(',');
  if (f.length < 6) return null;

  const open = parseFloat(f[1]);
  const close = parseFloat(f[2]);
  const high = parseFloat(f[3]);
  const low = parseFloat(f[4]);
  const volume = parseFloat(f[5]);

  if ([open, close, high, low].some(isNaN)) return null;

  return {
    time: f[0],
    open,
    high,
    low,
    close,
    volume: isNaN(volume) ? 0 : volume,
  };
}

export class EastMoneyAdapter implements IStockDataAdapter {
  readonly id = 'eastmoney';
  readonly name = '东方财富';
  readonly provider = 'East Money (东方财富证券)';
  readonly isFree = true;
  readonly costNote = '免费，无需注册';
  readonly browserCompatible = true;
  readonly notes =
    'Comprehensive data. Supports forward/backward price adjustment. ' +
    'Good reliability; used by major retail brokerage apps.';
  readonly capabilities = ['realtime', 'dailyKlines', 'minuteKlines'] as const;

  async fetchSnapshots(symbols: string[]): Promise<StockSnapshot[]> {
    if (symbols.length === 0) return [];

    // Build the secids parameter: "1.600519,0.000858,..."
    const secids = symbols.map(toSecId).join(',');
    const fields = 'f1,f2,f3,f4,f5,f6,f7,f12,f14,f15,f16,f17,f18';

    try {
      const url =
        `${PUSH2_BASE}/api/qt/ulist.np/get` +
        `?fltt=2&invt=2&secids=${encodeURIComponent(secids)}&fields=${fields}`;
      const json = await fetchJson<{ data?: { diff?: EastMoneyDiffItem[] } }>(url, 'EastMoney fetchSnapshots');
      const diffList = json?.data?.diff ?? [];

      // Build a lookup from code → original symbol so we can attach the correct prefix.
      const codeToSymbol = new Map<string, string>(
        symbols.map((s) => [s.slice(2), s]),
      );

      return diffList.flatMap((item) => {
        const originalSymbol = codeToSymbol.get(String(item.f12)) ?? `sh${item.f12}`;
        const snapshot = parseDiffItem(item, originalSymbol);
        return snapshot ? [snapshot] : [];
      });
    } catch (error) {
      console.error('EastMoneyAdapter fetchSnapshots error:', error);
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
    // klt: 101=daily, 102=weekly, 103=monthly
    const kltMap: Record<DailyPeriod, number> = {
      daily: 101,
      weekly: 102,
      monthly: 103,
    };
    const klt = kltMap[period] ?? 101;

    // fqt: 0=none, 1=forward (qfq), 2=backward (hfq)
    const fqtMap: Record<string, number> = { qfq: 1, hfq: 2, '': 0 };
    const fqt = fqtMap[adjust ?? 'qfq'] ?? 1;

    const beg = startDate || '20000101';
    const end = endDate || '20991231';

    try {
      const url =
        `${PUSH2HIS_BASE}/api/qt/stock/kline/get` +
        `?secid=${toSecId(symbol)}` +
        `&fields1=f1,f2,f3,f4,f5,f6` +
        `&fields2=f51,f52,f53,f54,f55,f56,f57,f58,f59,f60,f61` +
        `&klt=${klt}&fqt=${fqt}&beg=${beg}&end=${end}&lmt=500`;
      const json = await fetchJson<{ data?: { klines?: string[] } }>(url, `EastMoney fetchDailyKlines(${symbol})`);
      const klines = json?.data?.klines ?? [];

      return klines.flatMap((entry) => {
        const kline = parseKlineEntry(entry);
        return kline ? [kline] : [];
      });
    } catch (error) {
      console.error(`EastMoneyAdapter fetchDailyKlines error (${symbol}):`, error);
      return [];
    }
  }

  async fetchMinuteKlines(symbol: string, period: MinutePeriod): Promise<StockKline[]> {
    // klt: 1=1-min, 5=5-min, 15=15-min, 30=30-min, 60=60-min
    const kltMap: Record<MinutePeriod, number> = {
      '1': 1,
      '5': 5,
      '15': 15,
      '30': 30,
      '60': 60,
    };
    const klt = kltMap[period] ?? 5;

    // For minute klines, fetch the last 2 trading days to ensure full intraday coverage.
    const end = new Date();
    const beg = new Date(end);
    beg.setDate(beg.getDate() - 2);
    const begStr = beg.toISOString().slice(0, 10).replace(/-/g, '');
    const endStr = end.toISOString().slice(0, 10).replace(/-/g, '');

    try {
      const url =
        `${PUSH2HIS_BASE}/api/qt/stock/kline/get` +
        `?secid=${toSecId(symbol)}` +
        `&fields1=f1,f2,f3,f4,f5,f6` +
        `&fields2=f51,f52,f53,f54,f55,f56,f57,f58,f59,f60,f61` +
        `&klt=${klt}&fqt=0&beg=${begStr}&end=${endStr}&lmt=480`;
      const json = await fetchJson<{ data?: { klines?: string[] } }>(url, `EastMoney fetchMinuteKlines(${symbol})`);
      const klines = json?.data?.klines ?? [];

      // Keep only today's bars to match the expected intraday view.
      const today = new Date().toISOString().slice(0, 10);
      return klines.flatMap((entry) => {
        const kline = parseKlineEntry(entry);
        if (!kline) return [];
        // Minute klines include datetime; daily starts with date only — filter to today.
        return kline.time.startsWith(today) ? [kline] : [];
      });
    } catch (error) {
      console.error(`EastMoneyAdapter fetchMinuteKlines error (${symbol}):`, error);
      return [];
    }
  }
}
