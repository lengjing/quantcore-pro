/**
 * Yahoo Finance Adapter (雅虎财经)
 *
 * Uses the public Yahoo Finance v8 API for US stocks, HK stocks,
 * crypto, and international commodities/indices.
 *
 * Core strengths: Global coverage — US stocks, HK stocks, crypto, forex, commodities.
 * Free, no API key required, works from browser.
 *
 * Cost:       免费，无需 Token (Free, no token required)
 * Browser:    ⚠️  CORS restrictions — works in Electron or via proxy.
 * Endpoints:
 *   Quote:   https://query1.finance.yahoo.com/v8/finance/chart/{symbol}
 *   Search:  https://query2.finance.yahoo.com/v1/finance/search
 */

import type { IStockDataAdapter, AdapterCapability } from '../IStockDataAdapter';
import type { StockSnapshot, StockKline, MinutePeriod, DailyPeriod } from '../types';
import { fetchJson } from '../../../utils/fetchJson';

const CHART_BASE = 'https://query1.finance.yahoo.com/v8/finance/chart';

/**
 * Convert sh/sz-prefixed A-share symbol to Yahoo format.
 * Yahoo uses: code.SS for Shanghai, code.SZ for Shenzhen
 */
function toYahooSymbol(symbol: string): string {
  if (symbol.startsWith('sh')) return `${symbol.slice(2)}.SS`;
  if (symbol.startsWith('sz')) return `${symbol.slice(2)}.SZ`;
  return symbol;
}

/** Map DailyPeriod to Yahoo interval string. */
const INTERVAL_MAP: Record<DailyPeriod, string> = {
  daily: '1d',
  weekly: '1wk',
  monthly: '1mo',
};

/** Map MinutePeriod to Yahoo interval string. */
const MINUTE_INTERVAL_MAP: Record<MinutePeriod, string> = {
  '1': '1m',
  '5': '5m',
  '15': '15m',
  '30': '30m',
  '60': '60m',
};

interface YahooChartResult {
  chart?: {
    result?: Array<{
      meta?: {
        regularMarketPrice?: number;
        previousClose?: number;
        currency?: string;
        shortName?: string;
        longName?: string;
      };
      timestamp?: number[];
      indicators?: {
        quote?: Array<{
          open?: (number | null)[];
          high?: (number | null)[];
          low?: (number | null)[];
          close?: (number | null)[];
          volume?: (number | null)[];
        }>;
      };
    }>;
    error?: { code: string; description: string };
  };
}

export class YahooAdapter implements IStockDataAdapter {
  readonly id = 'yahoo';
  readonly name = 'Yahoo Finance';
  readonly provider = '雅虎财经 (Yahoo)';
  readonly isFree = true;
  readonly costNote = '免费，无需 Token，全球通用';
  readonly browserCompatible = false;
  readonly notes = 'Global coverage: US stocks, HK stocks, crypto, forex, commodities. No CORS — requires Electron or proxy.';
  readonly capabilities: readonly AdapterCapability[] = ['realtime', 'dailyKlines', 'minuteKlines'];

  async fetchSnapshots(symbols: string[]): Promise<StockSnapshot[]> {
    if (symbols.length === 0) return [];

    const results: StockSnapshot[] = [];

    // Yahoo requires individual requests per symbol for quotes
    const promises = symbols.map(async (sym) => {
      try {
        const yahooSym = toYahooSymbol(sym);
        const url = `${CHART_BASE}/${encodeURIComponent(yahooSym)}?interval=1d&range=1d`;
        const data = await fetchJson<YahooChartResult>(url);

        const result = data?.chart?.result?.[0];
        if (!result?.meta) return null;

        const meta = result.meta;
        const price = meta.regularMarketPrice ?? 0;
        const prevClose = meta.previousClose ?? 0;

        return {
          symbol: sym,
          name: meta.shortName || meta.longName || sym,
          price,
          open: price, // Simplified — meta doesn't always have open
          prevClose,
          high: price,
          low: price,
          volume: 0,
          amount: 0,
          change: price - prevClose,
          changePercent: prevClose > 0 ? ((price - prevClose) / prevClose) * 100 : 0,
          timestamp: Date.now(),
        } as StockSnapshot;
      } catch {
        return null;
      }
    });

    const settled = await Promise.all(promises);
    for (const snapshot of settled) {
      if (snapshot) results.push(snapshot);
    }

    return results;
  }

  async fetchDailyKlines(
    symbol: string,
    period: DailyPeriod,
    startDate: string,
    endDate: string,
    _adjust?: 'qfq' | 'hfq' | '',
  ): Promise<StockKline[]> {
    try {
      const yahooSym = toYahooSymbol(symbol);
      const interval = INTERVAL_MAP[period] ?? '1d';

      // Convert YYYYMMDD to Unix timestamps
      const startTs = Math.floor(
        new Date(`${startDate.slice(0, 4)}-${startDate.slice(4, 6)}-${startDate.slice(6, 8)}`).getTime() / 1000,
      );
      const endTs = Math.floor(
        new Date(`${endDate.slice(0, 4)}-${endDate.slice(4, 6)}-${endDate.slice(6, 8)}`).getTime() / 1000,
      );

      const url = `${CHART_BASE}/${encodeURIComponent(yahooSym)}?interval=${interval}&period1=${startTs}&period2=${endTs}`;
      const data = await fetchJson<YahooChartResult>(url);

      return this.parseChartData(data);
    } catch (err) {
      console.warn('[YahooAdapter] fetchDailyKlines failed:', err);
      return [];
    }
  }

  async fetchMinuteKlines(symbol: string, period: MinutePeriod): Promise<StockKline[]> {
    try {
      const yahooSym = toYahooSymbol(symbol);
      const interval = MINUTE_INTERVAL_MAP[period] ?? '5m';
      // Yahoo limits minute data to recent range (7 days for 1m, 60 days for others)
      const range = period === '1' ? '1d' : '5d';

      const url = `${CHART_BASE}/${encodeURIComponent(yahooSym)}?interval=${interval}&range=${range}`;
      const data = await fetchJson<YahooChartResult>(url);

      return this.parseChartData(data);
    } catch (err) {
      console.warn('[YahooAdapter] fetchMinuteKlines failed:', err);
      return [];
    }
  }

  private parseChartData(data: YahooChartResult): StockKline[] {
    const result = data?.chart?.result?.[0];
    if (!result?.timestamp || !result.indicators?.quote?.[0]) return [];

    const timestamps = result.timestamp;
    const quote = result.indicators.quote[0];
    const klines: StockKline[] = [];

    for (let i = 0; i < timestamps.length; i++) {
      const open = quote.open?.[i];
      const high = quote.high?.[i];
      const low = quote.low?.[i];
      const close = quote.close?.[i];
      const volume = quote.volume?.[i];

      if (open == null || high == null || low == null || close == null) continue;

      const date = new Date(timestamps[i] * 1000);
      const time = date.toISOString().slice(0, 19).replace('T', ' ');

      klines.push({
        time,
        open,
        high,
        low,
        close,
        volume: Math.round((volume ?? 0) / 100), // Convert shares to lots
      });
    }

    return klines;
  }
}
