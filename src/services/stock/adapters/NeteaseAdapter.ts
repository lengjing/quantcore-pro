/**
 * NetEase Finance Adapter (网易财经/163)
 *
 * Uses the public NetEase Money API for A-share market data.
 *
 * Core strengths: Historical financial reports, balance sheets, income statements.
 * Also provides real-time snapshots and historical klines.
 *
 * Cost:       免费，无需注册 (Free, no registration)
 * Browser:    ⚠️  API does NOT send CORS headers — works in Electron or via proxy.
 * Endpoints:
 *   Real-time: https://api.money.126.net/data/feed/{codes}
 *   History:   https://quotes.money.163.com/service/chddata.html
 */

import type { IStockDataAdapter, AdapterCapability } from '../IStockDataAdapter';
import type { StockSnapshot, StockKline, MinutePeriod, DailyPeriod } from '../types';

const API_BASE = 'https://api.money.126.net';
const HISTORY_BASE = 'https://quotes.money.163.com';

/**
 * Convert sh/sz-prefixed symbol to NetEase code format.
 * NetEase uses: 0+code for Shanghai, 1+code for Shenzhen
 */
function toNeteaseCode(symbol: string): string {
  const code = symbol.startsWith('sh') || symbol.startsWith('sz') ? symbol.slice(2) : symbol;
  const prefix = symbol.startsWith('sh') ? '0' : '1';
  return `${prefix}${code}`;
}

/**
 * Convert NetEase code back to sh/sz-prefixed symbol.
 */
function fromNeteaseCode(code: string): string {
  if (code.startsWith('0')) return `sh${code.slice(1)}`;
  if (code.startsWith('1')) return `sz${code.slice(1)}`;
  return code;
}

/** Parse the JSONP response from NetEase API. */
function parseJsonp(text: string): Record<string, unknown> {
  const match = text.match(/\((\{[\s\S]*\})\)/);
  if (!match) return {};
  try {
    return JSON.parse(match[1]) as Record<string, unknown>;
  } catch {
    return {};
  }
}

export class NeteaseAdapter implements IStockDataAdapter {
  readonly id = 'netease';
  readonly name = 'NetEase Finance';
  readonly provider = '网易财经 (163)';
  readonly isFree = true;
  readonly costNote = '免费，无需注册';
  readonly browserCompatible = false;
  readonly notes = 'Strengths: historical financial reports, balance sheets, income statements. No CORS — requires Electron or proxy.';
  readonly capabilities: readonly AdapterCapability[] = ['realtime', 'dailyKlines'];

  async fetchSnapshots(symbols: string[]): Promise<StockSnapshot[]> {
    if (symbols.length === 0) return [];

    try {
      const codes = symbols.map(toNeteaseCode);
      const url = `${API_BASE}/data/feed/${codes.join(',')}?callback=_ntes_quote_callback`;
      const response = await fetch(url);
      const text = await response.text();
      const data = parseJsonp(text);

      const results: StockSnapshot[] = [];
      for (const code of codes) {
        const item = data[code] as Record<string, unknown> | undefined;
        if (!item || typeof item !== 'object') continue;

        const price = Number(item.price) || 0;
        const prevClose = Number(item.yestclose) || 0;

        results.push({
          symbol: fromNeteaseCode(code),
          name: String(item.name || ''),
          price,
          open: Number(item.open) || 0,
          prevClose,
          high: Number(item.high) || 0,
          low: Number(item.low) || 0,
          volume: Number(item.volume) || 0,
          amount: Number(item.turnover) || 0,
          change: price - prevClose,
          changePercent: prevClose > 0 ? ((price - prevClose) / prevClose) * 100 : 0,
          bid: Number(item.bid1) || undefined,
          bidSize: Number(item.bidvol1) || undefined,
          ask: Number(item.ask1) || undefined,
          askSize: Number(item.askvol1) || undefined,
          timestamp: Date.now(),
        });
      }

      return results;
    } catch (err) {
      console.warn('[NeteaseAdapter] fetchSnapshots failed:', err);
      return [];
    }
  }

  async fetchDailyKlines(
    symbol: string,
    period: DailyPeriod,
    startDate: string,
    endDate: string,
    _adjust?: 'qfq' | 'hfq' | '',
  ): Promise<StockKline[]> {
    try {
      const code = toNeteaseCode(symbol);
      // NetEase provides CSV download for historical data
      const start = `${startDate.slice(0, 4)}-${startDate.slice(4, 6)}-${startDate.slice(6, 8)}`;
      const end = `${endDate.slice(0, 4)}-${endDate.slice(4, 6)}-${endDate.slice(6, 8)}`;

      const fields = 'TCLOSE;HIGH;LOW;TOPEN;VOTURNOVER';
      const url = `${HISTORY_BASE}/service/chddata.html?code=${code}&start=${start}&end=${end}&fields=${fields}`;
      const response = await fetch(url);
      const text = await response.text();

      const lines = text.trim().split('\n');
      if (lines.length < 2) return [];

      // CSV header: 日期,股票代码,名称,收盘价,最高价,最低价,开盘价,成交量
      const results: StockKline[] = [];
      for (let i = 1; i < lines.length; i++) {
        const cols = lines[i].split(',');
        if (cols.length < 8) continue;

        const date = cols[0].trim();
        const close = parseFloat(cols[3]);
        const high = parseFloat(cols[4]);
        const low = parseFloat(cols[5]);
        const open = parseFloat(cols[6]);
        const volume = parseFloat(cols[7]);

        if (isNaN(close) || close === 0) continue;

        results.push({
          time: date,
          open,
          high,
          low,
          close,
          volume: Math.round(volume / 100), // Convert shares to lots
        });
      }

      // NetEase returns newest first, reverse to oldest first
      results.reverse();
      return results;
    } catch (err) {
      console.warn('[NeteaseAdapter] fetchDailyKlines failed:', err);
      return [];
    }
  }

  async fetchMinuteKlines(_symbol: string, _period: MinutePeriod): Promise<StockKline[]> {
    // NetEase does not provide a public minute-level kline API
    console.warn('[NeteaseAdapter] minuteKlines not supported');
    return [];
  }
}
