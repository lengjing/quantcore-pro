/**
 * Sina Finance Adapter (新浪财经)
 *
 * Uses the public Sina Finance market data API.
 *
 * Cost:       免费，无需注册 (Free, no registration)
 * Browser:    ⚠️  hq.sinajs.cn does NOT send CORS headers — blocked in plain browser context.
 *             Works fine in Electron (no CORS enforcement) or via a CORS proxy.
 *             money.finance.sina.com.cn (historical klines) is generally browser-accessible.
 * Endpoints:
 *   Real-time: https://hq.sinajs.cn/list={symbol_list}
 *   History:   https://money.finance.sina.com.cn/quotes_service/api/json_v2.php/CN_MarketData.getKLineData
 */

import type { IStockDataAdapter } from '../IStockDataAdapter';
import type { StockSnapshot, StockKline, MinutePeriod, DailyPeriod } from '../types';

const HQ_BASE = 'https://hq.sinajs.cn';
const KLINE_BASE = 'https://money.finance.sina.com.cn/quotes_service/api/json_v2.php';

/**
 * Parse a Sina real-time quote string.
 *
 * Response format (comma-separated inside quotes):
 *   var hq_str_{symbol}="name,open,prevClose,price,high,low,bid,ask,volume,amount,...,date,time,...";
 *
 * Key field indices:
 *   [0] name        [1] open       [2] prevClose
 *   [3] price       [4] high       [5] low
 *   [6] bid         [7] ask
 *   [8] volume (shares) [9] amount (CNY)
 *   [30] date (YYYY-MM-DD)  [31] time (HH:mm:ss)
 */
function parseSinaQuoteLine(rawLine: string, originalSymbol: string): StockSnapshot | null {
  // Extract content between the outer quotes.
  const match = rawLine.match(/hq_str_[^=]+="([^"]*)"/);
  if (!match || !match[1]) return null;

  const f = match[1].split(',');
  if (f.length < 10) return null;

  const price = parseFloat(f[3]);
  const prevClose = parseFloat(f[2]);
  if (isNaN(price) || price <= 0) return null;

  const change = price - prevClose;
  const changePct = prevClose > 0 ? (change / prevClose) * 100 : 0;

  return {
    symbol: originalSymbol,
    name: f[0],
    price,
    open: parseFloat(f[1]) || prevClose,
    prevClose,
    high: parseFloat(f[4]) || price,
    low: parseFloat(f[5]) || price,
    // Sina reports volume in shares; convert to lots (手, 1 lot = 100 shares).
    volume: (parseFloat(f[8]) || 0) / 100,
    amount: parseFloat(f[9]) || 0,
    change,
    changePercent: changePct,
    bid: parseFloat(f[6]) || undefined,
    ask: parseFloat(f[7]) || undefined,
    timestamp: Date.now(),
  };
}

export class SinaAdapter implements IStockDataAdapter {
  readonly id = 'sina';
  readonly name = '新浪财经';
  readonly provider = 'Sina Finance (新浪财经)';
  readonly isFree = true;
  readonly costNote = '免费，无需注册';
  readonly browserCompatible = false;
  readonly notes =
    'Real-time endpoint (hq.sinajs.cn) requires Electron or a CORS proxy due to missing CORS headers. ' +
    'Historical kline endpoint is browser-accessible. Data is unadjusted.';

  async fetchSnapshots(symbols: string[]): Promise<StockSnapshot[]> {
    if (symbols.length === 0) return [];

    try {
      const url = `${HQ_BASE}/list=${symbols.join(',')}`;
      const response = await fetch(url);
      if (!response.ok) throw new Error(`HTTP ${response.status}`);

      // Response encoding is GB2312; modern fetch decodes it as UTF-8 which may garble
      // Chinese characters. We decode manually if possible, otherwise accept ASCII fields.
      const buffer = await response.arrayBuffer();
      let text: string;
      try {
        text = new TextDecoder('gb2312').decode(buffer);
      } catch {
        text = new TextDecoder('utf-8').decode(buffer);
      }

      return symbols.flatMap((symbol) => {
        const lineRegex = new RegExp(`hq_str_${symbol}="[^"]*"`, 'i');
        const match = text.match(lineRegex);
        if (!match) return [];
        const parsed = parseSinaQuoteLine(match[0], symbol);
        return parsed ? [parsed] : [];
      });
    } catch (error) {
      console.error('SinaAdapter fetchSnapshots error:', error);
      return [];
    }
  }

  async fetchDailyKlines(
    symbol: string,
    period: DailyPeriod,
    _startDate: string,
    _endDate: string,
    _adjust: 'qfq' | 'hfq' | '' = '',
  ): Promise<StockKline[]> {
    // Sina's scale parameter: 240 = daily, 1680 = weekly, 7200 = monthly.
    const scaleMap: Record<DailyPeriod, number> = {
      daily: 240,
      weekly: 1680,
      monthly: 7200,
    };
    const scale = scaleMap[period] ?? 240;

    try {
      const url =
        `${KLINE_BASE}/CN_MarketData.getKLineData` +
        `?symbol=${symbol}&scale=${scale}&ma=no&datalen=365`;
      const response = await fetch(url);
      if (!response.ok) throw new Error(`HTTP ${response.status}`);

      const data: any[] = await response.json();
      return data.map((item) => ({
        time: String(item.day),
        open: parseFloat(item.open),
        high: parseFloat(item.high),
        low: parseFloat(item.low),
        close: parseFloat(item.close),
        // Sina reports daily volume in shares; convert to lots.
        volume: parseFloat(item.volume) / 100,
      }));
    } catch (error) {
      console.error(`SinaAdapter fetchDailyKlines error (${symbol}):`, error);
      return [];
    }
  }

  async fetchMinuteKlines(symbol: string, period: MinutePeriod): Promise<StockKline[]> {
    // Sina minute scales: 5, 15, 30, 60.
    const scaleMap: Record<MinutePeriod, number> = {
      '1': 1,
      '5': 5,
      '15': 15,
      '30': 30,
      '60': 60,
    };
    const scale = scaleMap[period] ?? 5;

    try {
      const url =
        `${KLINE_BASE}/CN_MarketData.getKLineData` +
        `?symbol=${symbol}&scale=${scale}&ma=no&datalen=240`;
      const response = await fetch(url);
      if (!response.ok) throw new Error(`HTTP ${response.status}`);

      const data: any[] = await response.json();
      return data.map((item) => ({
        time: String(item.day),
        open: parseFloat(item.open),
        high: parseFloat(item.high),
        low: parseFloat(item.low),
        close: parseFloat(item.close),
        volume: parseFloat(item.volume) / 100,
      }));
    } catch (error) {
      console.error(`SinaAdapter fetchMinuteKlines error (${symbol}):`, error);
      return [];
    }
  }
}
