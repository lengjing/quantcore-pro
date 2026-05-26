/**
 * SectorDetailPanel
 *
 * A full-featured drill-down view for a single sector/concept.
 *
 * Features
 * ─────────
 * • Timeframe selector (1M / 5M / 15M / 1H / 4H / 1D)
 * • Two chart modes switchable via toolbar:
 *   - RELATIVE: normalised % return line chart for every component
 *   - BARS: current-snapshot change% horizontal bar chart
 * • Component table (sorted by change%) with click-through to Dashboard
 */

import React, { useState, useEffect, useRef, useCallback } from 'react';
import { useTranslation } from 'react-i18next';
import {
  ResponsiveContainer,
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ReferenceLine,
  BarChart,
  Bar,
  Cell,
} from 'recharts';
import { ExternalLink, BookmarkPlus, BarChart2, TrendingUp, Loader, Trash2 } from 'lucide-react';
import type { CandleData, MarketMode, ColorScheme } from '../types';
import type { Timeframe } from '../types';
import type { SectorStats } from '../data/sectors';
import { useColors } from '../hooks/useColors';
import { fetchKlines } from '../services/crypto/binanceRestService';
import { fetchStockKlines } from '../services/stock/stockDataService';

// ── Types ──────────────────────────────────────────────────────────────────────

type DetailChartType = 'RELATIVE' | 'BARS';

interface SectorDetailPanelProps {
  sector: SectorStats;
  marketMode: MarketMode;
  isCustom?: boolean;
  onClose: () => void;
  onGoToSymbol: (symbol: string) => void;
  onAddToWatchlist?: (symbol: string) => void;
  onDeleteCustom?: (id: string) => void;
  colorScheme: ColorScheme;
}

// ── Constants ──────────────────────────────────────────────────────────────────

const TIMEFRAMES: Timeframe[] = ['1M', '5M', '15M', '1H', '4H', '1D'];

// ── Helpers ────────────────────────────────────────────────────────────────────

const fmtVol = (v: number): string => {
  if (v >= 1e9) return `${(v / 1e9).toFixed(1)}B`;
  if (v >= 1e6) return `${(v / 1e6).toFixed(1)}M`;
  if (v >= 1e3) return `${(v / 1e3).toFixed(1)}K`;
  return v.toFixed(0);
};

const priceDp = (p: number) => (p >= 1000 ? 2 : p >= 1 ? 4 : 8);

const shortName = (symbol: string) =>
  symbol.replace('-USDT', '').replace('sh', '').replace('sz', '');

/** Fetch candle data for a single symbol, routing to the right service. */
async function fetchComponentKlines(
  symbol: string,
  timeframe: Timeframe,
  marketMode: MarketMode,
): Promise<CandleData[]> {
  try {
    if (marketMode === 'CRYPTO') {
      return await fetchKlines(symbol, timeframe);
    } else {
      return await fetchStockKlines(symbol, timeframe);
    }
  } catch {
    return [];
  }
}

/**
 * Normalise a candle array to percentage returns from the first close.
 * Returns an array of { time, pct } ready for recharts.
 */
function normalise(candles: CandleData[]): { time: string; pct: number }[] {
  if (candles.length === 0) return [];
  const base = candles[0].close;
  if (base === 0) return [];
  return candles.map((c) => ({
    time: c.time.slice(5, 16).replace('T', ' '), // "MM-DD HH:mm"
    pct: parseFloat(((c.close / base - 1) * 100).toFixed(3)),
  }));
}

// ── Main component ─────────────────────────────────────────────────────────────

export const SectorDetailPanel: React.FC<SectorDetailPanelProps> = ({
  sector,
  marketMode,
  isCustom = false,
  onClose,
  onGoToSymbol,
  onAddToWatchlist,
  onDeleteCustom,
  colorScheme,
}) => {
  const { t, i18n } = useTranslation();
  const colors = useColors(colorScheme);
  const [timeframe, setTimeframe] = useState<Timeframe>('1D');
  const [chartType, setChartType] = useState<DetailChartType>('RELATIVE');
  const [candleMap, setCandleMap] = useState<Record<string, { time: string; pct: number }[]>>({});
  const [loading, setLoading] = useState(false);
  const loadRef = useRef(0);

  // ── Fetch klines for all components when timeframe or sector changes ──────
  const loadKlines = useCallback(async () => {
    const symbols = sector.def.symbols;
    if (symbols.length === 0 || chartType !== 'RELATIVE') return;

    const stamp = ++loadRef.current;
    setLoading(true);
    setCandleMap({});

    const results = await Promise.all(
      symbols.map(async (sym) => {
        const candles = await fetchComponentKlines(sym, timeframe, marketMode);
        return { sym, series: normalise(candles) };
      }),
    );

    if (loadRef.current !== stamp) return; // stale
    const map: Record<string, { time: string; pct: number }[]> = {};
    results.forEach(({ sym, series }) => {
      if (series.length > 0) map[sym] = series;
    });
    setCandleMap(map);
    setLoading(false);
  }, [sector.def.symbols, timeframe, chartType, marketMode]);

  useEffect(() => {
    loadKlines();
  }, [loadKlines]);

  // ── Build merged time-series for recharts ─────────────────────────────────
  const lineData = React.useMemo(() => {
    const symbols = Object.keys(candleMap);
    if (symbols.length === 0) return [];

    // Build a unified time index from the longest series
    const longest = symbols.reduce(
      (best, s) => (candleMap[s].length > (candleMap[best]?.length ?? 0) ? s : best),
      symbols[0],
    );
    return candleMap[longest].map((point, idx) => {
      const row: Record<string, string | number> = { time: point.time };
      symbols.forEach((s) => {
        const v = candleMap[s][idx];
        if (v !== undefined) row[s] = v.pct;
      });
      return row;
    });
  }, [candleMap]);

  // ── BAR data (current snapshot) ───────────────────────────────────────────
  const barData = React.useMemo(
    () =>
      [...sector.components]
        .sort((a, b) => b.changePercent - a.changePercent)
        .map((c) => ({
          name: shortName(c.symbol),
          symbol: c.symbol,
          change: parseFloat(c.changePercent.toFixed(2)),
          color: sector.def.color,
        })),
    [sector.components, sector.def.color],
  );

  const symbolColors: Record<string, string> = React.useMemo(() => {
    // Spread colors for component lines using hue rotation from the sector color
    const base = sector.def.color;
    const syms = sector.def.symbols;
    // Use fixed terminal-style palette for up to 12 components
    const palette = [
      '#3b82f6', '#10b981', '#f59e0b', '#ef4444', '#8b5cf6',
      '#06b6d4', '#f97316', '#84cc16', '#ec4899', '#6366f1',
      '#14b8a6', '#a855f7',
    ];
    const map: Record<string, string> = {};
    syms.forEach((s, i) => {
      map[s] = palette[i % palette.length] ?? base;
    });
    return map;
  }, [sector.def.symbols, sector.def.color]);

  return (
    <div className="w-80 shrink-0 flex flex-col bg-terminal-panel border border-terminal-border min-h-0">

      {/* ── Header ─────────────────────────────────────────────────────────── */}
      <div className="px-2 py-1.5 border-b border-terminal-border flex items-center justify-between shrink-0">
        <div className="flex items-center gap-1.5 min-w-0">
          <div className="w-2 h-2 rounded-sm shrink-0" style={{ backgroundColor: sector.def.color }} />
          <span className="text-[10px] font-bold font-mono text-gray-200 truncate">{sector.def.name}</span>
          {sector.def.name !== sector.def.nameEn && (
            <span className="text-[8px] text-gray-600 truncate hidden sm:inline">{sector.def.nameEn}</span>
          )}
          {isCustom && (
            <span className="text-[7px] font-mono text-yellow-600 border border-yellow-800 px-0.5 shrink-0">CUSTOM</span>
          )}
        </div>
        <div className="flex items-center gap-1 shrink-0">
          {isCustom && onDeleteCustom && (
            <button
              onClick={() => onDeleteCustom(sector.def.id)}
              title="Delete custom sector"
              className="text-gray-700 hover:text-red-400 transition-colors"
            >
              <Trash2 size={10} />
            </button>
          )}
          <button onClick={onClose} className="text-gray-600 hover:text-gray-300 text-[10px] font-mono ml-1">✕</button>
        </div>
      </div>

      {/* ── Summary bar ────────────────────────────────────────────────────── */}
      <div className="px-2 py-1 border-b border-[#1a1a1a] shrink-0 font-mono text-[9px] flex gap-3 items-center">
        <span className={colors.clsBold(sector.avgChange)}>
          {sector.avgChange >= 0 ? '+' : ''}{sector.avgChange.toFixed(2)}%
        </span>
        <span className="text-gray-600">|</span>
        <span className={colors.upClass}>{sector.advancing}↑</span>
        <span className={colors.downClass}>{sector.declining}↓</span>
        <span className="text-gray-600">|</span>
        <span className="text-gray-500">{fmtVol(sector.totalVolume)}</span>
      </div>

      {/* ── Toolbar: timeframe + chart type ────────────────────────────────── */}
      <div className="px-2 py-1 border-b border-[#1a1a1a] shrink-0 flex items-center gap-1 flex-wrap">
        {/* Timeframe buttons */}
        <div className="flex items-center gap-px">
          {TIMEFRAMES.map((tf) => (
            <button
              key={tf}
              onClick={() => setTimeframe(tf)}
              className={[
                'text-[8px] font-mono font-bold px-1.5 py-0.5 transition-colors',
                timeframe === tf
                  ? 'bg-terminal-accent text-black'
                  : 'text-gray-600 hover:text-gray-200',
              ].join(' ')}
            >
              {tf}
            </button>
          ))}
        </div>
        <div className="h-3 w-px bg-[#333] mx-0.5" />
        {/* Chart type buttons */}
        <div className="flex items-center gap-px">
          <button
            onClick={() => setChartType('RELATIVE')}
            title="Relative performance"
            className={[
              'flex items-center gap-0.5 text-[8px] font-mono font-bold px-1.5 py-0.5 transition-colors',
              chartType === 'RELATIVE'
                ? 'bg-terminal-accent text-black'
                : 'text-gray-600 hover:text-gray-200',
            ].join(' ')}
          >
            <TrendingUp size={8} />LINE
          </button>
          <button
            onClick={() => setChartType('BARS')}
            title="Current change bars"
            className={[
              'flex items-center gap-0.5 text-[8px] font-mono font-bold px-1.5 py-0.5 transition-colors',
              chartType === 'BARS'
                ? 'bg-terminal-accent text-black'
                : 'text-gray-600 hover:text-gray-200',
            ].join(' ')}
          >
            <BarChart2 size={8} />BAR
          </button>
        </div>
      </div>

      {/* ── Chart area ─────────────────────────────────────────────────────── */}
      <div className="shrink-0" style={{ height: 200 }}>
        {chartType === 'RELATIVE' ? (
          loading ? (
            <div className="flex items-center justify-center h-full gap-1.5 text-gray-600 text-[9px] font-mono">
              <Loader size={10} className="animate-spin" />
              {t('FETCHING_DATA')} {timeframe} {t('DATA_SUFFIX')}
            </div>
          ) : lineData.length === 0 ? (
            <div className="flex items-center justify-center h-full text-gray-700 text-[9px] font-mono">
              {t('NO_DATA_SYMBOL_MISMATCH')}
            </div>
          ) : (
            <ResponsiveContainer width="100%" height="100%">
              <LineChart data={lineData} margin={{ top: 6, right: 8, left: 0, bottom: 2 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="#1a1a1a" />
                <XAxis
                  dataKey="time"
                  tick={{ fill: '#555', fontSize: 7, fontFamily: 'monospace' }}
                  axisLine={{ stroke: '#2a2a2a' }}
                  tickLine={false}
                  interval="preserveStartEnd"
                />
                <YAxis
                  tickFormatter={(v) => `${v > 0 ? '+' : ''}${v}%`}
                  tick={{ fill: '#555', fontSize: 7, fontFamily: 'monospace' }}
                  axisLine={false}
                  tickLine={false}
                  width={36}
                />
                <Tooltip
                  contentStyle={{
                    background: '#0d0d0d',
                    border: '1px solid #333',
                    borderRadius: 0,
                    fontFamily: 'monospace',
                    fontSize: 9,
                    padding: '4px 8px',
                  }}
                  labelStyle={{ color: '#777', marginBottom: 2 }}
                  formatter={(value, name) => {
                    const v = Number(value ?? 0);
                    return [
                      <span key={String(name)} style={{ color: colors.hex(v), fontWeight: 700 }}>
                        {v >= 0 ? '+' : ''}{v}%
                      </span>,
                      shortName(String(name)),
                    ];
                  }}
                />
                <ReferenceLine y={0} stroke="#333" strokeDasharray="4 4" />
                {Object.keys(candleMap).map((sym) => (
                  <Line
                    key={sym}
                    type="monotone"
                    dataKey={sym}
                    stroke={symbolColors[sym] ?? sector.def.color}
                    strokeWidth={1.5}
                    dot={false}
                    activeDot={{ r: 2 }}
                    isAnimationActive={false}
                  />
                ))}
              </LineChart>
            </ResponsiveContainer>
          )
        ) : (
          <ResponsiveContainer width="100%" height="100%">
            <BarChart
              data={barData}
              layout="vertical"
              margin={{ top: 4, right: 40, left: 4, bottom: 4 }}
              barCategoryGap="20%"
            >
              <CartesianGrid strokeDasharray="3 3" stroke="#1a1a1a" horizontal={false} />
              <XAxis
                type="number"
                domain={['auto', 'auto']}
                tickFormatter={(v) => `${v > 0 ? '+' : ''}${v}%`}
                tick={{ fill: '#555', fontSize: 7, fontFamily: 'monospace' }}
                axisLine={{ stroke: '#2a2a2a' }}
                tickLine={false}
              />
              <YAxis
                type="category"
                dataKey="name"
                width={40}
                tick={{ fill: '#888', fontSize: 7, fontFamily: 'monospace' }}
                axisLine={false}
                tickLine={false}
              />
              <Tooltip
                cursor={{ fill: 'rgba(255,255,255,0.03)' }}
                contentStyle={{
                  background: '#0d0d0d',
                  border: '1px solid #333',
                  borderRadius: 0,
                  fontFamily: 'monospace',
                  fontSize: 9,
                }}
                formatter={(value) => {
                  const v = Number(value ?? 0);
                  return [
                    <span key="v" style={{ color: colors.hex(v), fontWeight: 700 }}>
                      {v >= 0 ? '+' : ''}{v}%
                    </span>,
                    t('TH_CHG'),
                  ];
                }}
              />
              <ReferenceLine x={0} stroke="#333" strokeWidth={1} />
              <Bar dataKey="change" radius={0}>
                {barData.map((entry) => (
                  <Cell
                    key={entry.symbol}
                    fill={colors.hex(entry.change)}
                    fillOpacity={0.75}
                  />
                ))}
              </Bar>
            </BarChart>
          </ResponsiveContainer>
        )}
      </div>

      {/* ── Component table ─────────────────────────────────────────────────── */}
      <div className="flex-1 overflow-y-auto custom-scrollbar min-h-0">
        {sector.components.length === 0 ? (
          <div className="text-center py-6 text-[9px] font-mono text-gray-600">
            {t('NO_COMPONENTS')}
          </div>
        ) : (
          <table className="w-full font-mono text-[9px]">
            <thead className="sticky top-0 bg-[#111]">
              <tr className="text-gray-600 border-b border-[#1a1a1a]">
                <th className="px-2 py-1 text-left">{t('TH_SYMBOL')}</th>
                <th className="px-2 py-1 text-right">{t('TH_LAST')}</th>
                <th className="px-2 py-1 text-right">{t('TH_CHG')}</th>
                <th className="px-2 py-1 w-8"></th>
              </tr>
            </thead>
            <tbody>
              {[...sector.components]
                .sort((a, b) => b.changePercent - a.changePercent)
                .map((c) => {
                  const isUp = c.changePercent >= 0;
                  return (
                    <tr
                      key={c.symbol}
                      className="border-b border-[#0f0f0f] hover:bg-[#141414] cursor-pointer group/row"
                      onClick={() => onGoToSymbol(c.symbol)}
                    >
                      <td className="px-2 py-1 text-left">
                        <div
                          className="inline-block w-1 h-1 rounded-sm mr-1"
                          style={{ background: symbolColors[c.symbol] ?? sector.def.color }}
                        />
                        <span className="font-bold text-terminal-accent">{shortName(c.symbol)}</span>
                        {c.name && (
                          <div className="text-[8px] text-gray-600 truncate max-w-[80px]">{c.name}</div>
                        )}
                      </td>
                      <td className="px-2 py-1 text-right text-white tabular-nums">
                        {c.price.toFixed(priceDp(c.price))}
                      </td>
                      <td className={`px-2 py-1 text-right font-bold tabular-nums ${colors.clsBold(c.changePercent)}`}>
                        {isUp ? '+' : ''}{c.changePercent.toFixed(2)}%
                      </td>
                      <td className="px-2 py-1 text-right">
                        <div className="flex items-center justify-end gap-0.5 opacity-0 group-hover/row:opacity-100">
                          <button
                            title="Add to watchlist"
                            onClick={(e) => { e.stopPropagation(); onAddToWatchlist?.(c.symbol); }}
                            className="text-gray-600 hover:text-terminal-accent"
                          >
                            <BookmarkPlus size={8} />
                          </button>
                          <button
                            title="Open chart"
                            onClick={(e) => { e.stopPropagation(); onGoToSymbol(c.symbol); }}
                            className="text-gray-600 hover:text-terminal-accent"
                          >
                            <ExternalLink size={8} />
                          </button>
                        </div>
                      </td>
                    </tr>
                  );
                })}
            </tbody>
          </table>
        )}
      </div>
    </div>
  );
};
