import React, { useState, useMemo, useCallback, useEffect, useRef } from 'react';
import {
  TrendingUp,
  TrendingDown,
  ArrowUp,
  ArrowDown,
  ExternalLink,
  Clock,
  BookmarkPlus,
  BarChart2,
  Grid,
  TrendingUp as LineIcon,
} from 'lucide-react';
import type { MarketTicker, MarketMode, ViewState as ViewStateType } from '../types';
import { ViewState } from '../types';
import { Panel } from '../components/ui/Panel';
import {
  CRYPTO_SECTORS,
  CN_SECTORS,
  computeSectorStats,
  type SectorStats,
  type SectorSnapshot,
} from '../data/sectors';
import { SectorCharts, type SectorChartType } from '../components/SectorCharts';

// ── Types ──────────────────────────────────────────────────────────────────────

type MainTab = 'TABLE' | 'SECTORS';
type Tab = 'ALL' | 'GAINERS' | 'LOSERS' | 'ACTIVE';
type SortKey = keyof Pick<
  MarketTicker,
  'symbol' | 'price' | 'changePercent' | 'change' | 'volume' | 'high' | 'low'
> | 'spread';
type SortDir = 'asc' | 'desc';

interface MarketViewProps {
  marketTickers: MarketTicker[];
  marketMode: MarketMode;
  setActiveSymbol: (s: string) => void;
  setView: (v: ViewStateType) => void;
  addToWatchlist?: (symbol: string) => void;
  onRefresh?: () => void;
}

// ── Helpers ────────────────────────────────────────────────────────────────────

const fmtVol = (v: number): string => {
  if (v >= 1e9) return `${(v / 1e9).toFixed(2)}B`;
  if (v >= 1e6) return `${(v / 1e6).toFixed(2)}M`;
  if (v >= 1e3) return `${(v / 1e3).toFixed(1)}K`;
  return v.toFixed(0);
};

const priceDp = (p: number): number => {
  if (p >= 1000) return 2;
  if (p >= 1) return 4;
  return 8;
};

const shortName = (symbol: string): string =>
  symbol.replace('-USDT', '').replace('sh', '').replace('sz', '');

const fmtTime = (ts: number): string => {
  const d = new Date(ts);
  return `${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`;
};

// ── Sub-components ─────────────────────────────────────────────────────────────

/** Horizontal day-range bar: shows where current price falls between 24h low and high. */
const RangeBar = ({ price, low, high }: { price: number; low: number; high: number }) => {
  const range = high - low;
  const pct = range > 0 ? Math.min(100, Math.max(0, ((price - low) / range) * 100)) : 50;
  return (
    <div className="flex items-center gap-1">
      <span className="text-gray-600 text-[8px] w-8 text-right">{low.toFixed(priceDp(low))}</span>
      <div className="relative w-16 h-1 bg-[#222] rounded-full">
        <div
          className="absolute top-0 h-full bg-terminal-accent/50 rounded-full"
          style={{ width: `${pct}%` }}
        />
        <div
          className="absolute top-1/2 -translate-y-1/2 w-1.5 h-1.5 bg-terminal-accent rounded-full border border-black"
          style={{ left: `calc(${pct}% - 3px)` }}
        />
      </div>
      <span className="text-gray-600 text-[8px] w-8">{high.toFixed(priceDp(high))}</span>
    </div>
  );
};

/** Sortable column header button. */
const Th = ({
  sortKey: k,
  activeSortKey,
  sortDir,
  onSort,
  children,
  left = false,
}: {
  sortKey: SortKey;
  activeSortKey: SortKey;
  sortDir: SortDir;
  onSort: (k: SortKey) => void;
  children: React.ReactNode;
  left?: boolean;
}) => {
  const active = activeSortKey === k;
  return (
    <th
      className={[
        'px-2 py-1.5 cursor-pointer select-none whitespace-nowrap group/th',
        left ? 'text-left' : 'text-right',
        active ? 'text-terminal-accent' : 'text-gray-500 hover:text-gray-300',
      ].join(' ')}
      onClick={() => onSort(k)}
    >
      <span className={`inline-flex items-center gap-0.5 ${left ? '' : 'justify-end'}`}>
        {children}
        {active ? (
          sortDir === 'asc' ? <ArrowUp size={8} /> : <ArrowDown size={8} />
        ) : (
          <ArrowDown size={8} className="opacity-0 group-hover/th:opacity-30" />
        )}
      </span>
    </th>
  );
};

// ── Main component ─────────────────────────────────────────────────────────────

export const MarketView = ({
  marketTickers,
  marketMode,
  setActiveSymbol,
  setView,
  addToWatchlist,
  onRefresh,
}: MarketViewProps) => {
  const [mainTab, setMainTab] = useState<MainTab>('TABLE');
  const [tab, setTab] = useState<Tab>('ALL');
  const [sortKey, setSortKey] = useState<SortKey>('volume');
  const [sortDir, setSortDir] = useState<SortDir>('desc');
  const [search, setSearch] = useState('');

  // ── Sectors state ──────────────────────────────────────────────────────────
  const [snapshots, setSnapshots] = useState<SectorSnapshot[]>([]);
  const [activeSnapshot, setActiveSnapshot] = useState<SectorSnapshot | null>(null);
  const [selectedSectorId, setSelectedSectorId] = useState<string | null>(null);
  const [sectorChartType, setSectorChartType] = useState<SectorChartType>('BAR');
  const lastSnapshotRef = useRef<number>(0);

  // Push a snapshot every 5 minutes when tickers change
  useEffect(() => {
    if (marketTickers.length === 0) return;
    const now = Date.now();
    if (now - lastSnapshotRef.current >= 5 * 60 * 1000) {
      lastSnapshotRef.current = now;
      const sectors = marketMode === 'CRYPTO' ? CRYPTO_SECTORS : CN_SECTORS;
      const stats = computeSectorStats(marketTickers, sectors);
      setSnapshots((prev) => {
        const next = [...prev, { ts: now, sectorStats: stats }];
        return next.slice(-12);
      });
    }
  }, [marketTickers, marketMode]);

  // ── Market-wide statistics ──────────────────────────────────────────────────
  const stats = useMemo(() => {
    const advancing = marketTickers.filter((t) => t.changePercent > 0).length;
    const declining = marketTickers.filter((t) => t.changePercent < 0).length;
    const unchanged = marketTickers.length - advancing - declining;
    const avgChange =
      marketTickers.length > 0
        ? marketTickers.reduce((s, t) => s + t.changePercent, 0) / marketTickers.length
        : 0;
    const totalVolume = marketTickers.reduce((s, t) => s + t.volume, 0);

    let btcDominance = 0;
    if (marketMode === 'CRYPTO') {
      const btc = marketTickers.find((t) => t.symbol === 'BTC-USDT');
      if (btc && totalVolume > 0) btcDominance = (btc.volume / totalVolume) * 100;
    }

    const topGainers = [...marketTickers]
      .filter((t) => t.changePercent > 0)
      .sort((a, b) => b.changePercent - a.changePercent)
      .slice(0, 5);

    const topLosers = [...marketTickers]
      .filter((t) => t.changePercent < 0)
      .sort((a, b) => a.changePercent - b.changePercent)
      .slice(0, 5);

    const mostActive = [...marketTickers]
      .sort((a, b) => b.volume - a.volume)
      .slice(0, 5);

    return { advancing, declining, unchanged, avgChange, totalVolume, btcDominance, topGainers, topLosers, mostActive };
  }, [marketTickers, marketMode]);

  // ── Live sector stats ───────────────────────────────────────────────────────
  const liveSectorStats = useMemo((): SectorStats[] => {
    const sectors = marketMode === 'CRYPTO' ? CRYPTO_SECTORS : CN_SECTORS;
    return computeSectorStats(marketTickers, sectors);
  }, [marketTickers, marketMode]);

  const displayedSectorStats = activeSnapshot ? activeSnapshot.sectorStats : liveSectorStats;

  const selectedSector = displayedSectorStats.find((s) => s.def.id === selectedSectorId) ?? null;

  // ── Table data ──────────────────────────────────────────────────────────────
  const filtered = useMemo(() => {
    let rows = [...marketTickers];

    // Keyword search
    const q = search.trim().toUpperCase();
    if (q) {
      rows = rows.filter((t) => t.symbol.toUpperCase().includes(q) || (t.name ?? '').toUpperCase().includes(q));
    }

    // Tab filter
    if (tab === 'GAINERS') {
      rows = rows.filter((t) => t.changePercent > 0).sort((a, b) => b.changePercent - a.changePercent).slice(0, 100);
    } else if (tab === 'LOSERS') {
      rows = rows.filter((t) => t.changePercent < 0).sort((a, b) => a.changePercent - b.changePercent).slice(0, 100);
    } else if (tab === 'ACTIVE') {
      rows = rows.sort((a, b) => b.volume - a.volume).slice(0, 100);
    } else {
      // ALL — user-controlled sort
      rows = rows.sort((a, b) => {
        let av: number;
        let bv: number;
        if (sortKey === 'symbol') {
          return sortDir === 'asc'
            ? a.symbol.localeCompare(b.symbol)
            : b.symbol.localeCompare(a.symbol);
        }
        if (sortKey === 'spread') {
          av = a.ask && a.bid ? ((a.ask - a.bid) / a.ask) * 100 : 0;
          bv = b.ask && b.bid ? ((b.ask - b.bid) / b.ask) * 100 : 0;
        } else {
          av = (a[sortKey] as number) ?? 0;
          bv = (b[sortKey] as number) ?? 0;
        }
        return sortDir === 'asc' ? av - bv : bv - av;
      });
    }

    return rows;
  }, [marketTickers, tab, sortKey, sortDir, search]);

  const handleSort = useCallback(
    (k: SortKey) => {
      if (sortKey === k) setSortDir((d) => (d === 'asc' ? 'desc' : 'asc'));
      else { setSortKey(k); setSortDir('desc'); }
    },
    [sortKey],
  );

  const goToSymbol = useCallback(
    (symbol: string) => {
      setActiveSymbol(symbol);
      setView(ViewState.DASHBOARD);
    },
    [setActiveSymbol, setView],
  );

  const sortProps = { activeSortKey: sortKey, sortDir, onSort: handleSort };

  return (
    <div className="flex h-full gap-1 min-h-0">

      {/* ── Stats Sidebar ─────────────────────────────────────────────── */}
      <div className="w-52 shrink-0 flex flex-col gap-1 min-h-0">
        <Panel title="MARKET OVERVIEW" className="flex-1 overflow-hidden">
          <div className="p-2 space-y-3 font-mono text-[10px] overflow-y-auto h-full custom-scrollbar">

            {/* Instrument count */}
            <div>
              <div className="text-gray-500 mb-0.5">INSTRUMENTS</div>
              <div className="text-white text-lg font-bold leading-none">{marketTickers.length.toLocaleString()}</div>
            </div>

            {/* A/D/U cards */}
            <div className="grid grid-cols-3 gap-0.5">
              <div className="bg-green-950/40 border border-green-900/40 p-1.5 text-center">
                <div className="text-terminal-success font-bold text-sm leading-none">{stats.advancing}</div>
                <div className="text-gray-500 mt-0.5">↑ UP</div>
              </div>
              <div className="bg-red-950/40 border border-red-900/40 p-1.5 text-center">
                <div className="text-terminal-error font-bold text-sm leading-none">{stats.declining}</div>
                <div className="text-gray-500 mt-0.5">↓ DN</div>
              </div>
              <div className="bg-[#111] border border-[#2a2a2a] p-1.5 text-center">
                <div className="text-gray-400 font-bold text-sm leading-none">{stats.unchanged}</div>
                <div className="text-gray-500 mt-0.5">→ FL</div>
              </div>
            </div>

            {/* Breadth bar */}
            {marketTickers.length > 0 && (
              <div>
                <div className="flex justify-between text-gray-500 mb-1">
                  <span>BREADTH</span>
                  <span className={stats.advancing > stats.declining ? 'text-terminal-success' : 'text-terminal-error'}>
                    {((stats.advancing / marketTickers.length) * 100).toFixed(0)}% ADV
                  </span>
                </div>
                <div className="h-1.5 bg-[#1a1a1a] rounded-full overflow-hidden flex">
                  <div
                    className="h-full bg-terminal-success/70 transition-all"
                    style={{ width: `${(stats.advancing / marketTickers.length) * 100}%` }}
                  />
                  <div
                    className="h-full bg-terminal-error/70 transition-all"
                    style={{ width: `${(stats.declining / marketTickers.length) * 100}%` }}
                  />
                </div>
              </div>
            )}

            {/* Key metrics */}
            <div className="border-t border-[#1e1e1e] pt-2 space-y-1.5">
              <div className="flex justify-between">
                <span className="text-gray-500">AVG CHG</span>
                <span className={stats.avgChange >= 0 ? 'text-terminal-success' : 'text-terminal-error'}>
                  {stats.avgChange >= 0 ? '+' : ''}{stats.avgChange.toFixed(2)}%
                </span>
              </div>
              <div className="flex justify-between">
                <span className="text-gray-500">TOTAL VOL</span>
                <span className="text-gray-200">{fmtVol(stats.totalVolume)}</span>
              </div>
              {marketMode === 'CRYPTO' && stats.btcDominance > 0 && (
                <div className="flex justify-between">
                  <span className="text-gray-500">BTC DOM</span>
                  <span className="text-blue-400">{stats.btcDominance.toFixed(1)}%</span>
                </div>
              )}
            </div>

            {/* Top 5 gainers mini-list */}
            <div className="border-t border-[#1e1e1e] pt-2">
              <div className="flex items-center gap-1 text-gray-500 mb-1">
                <TrendingUp size={8} className="text-terminal-success" />
                <span>TOP GAINERS</span>
              </div>
              {stats.topGainers.map((t) => (
                <div
                  key={t.symbol}
                  className="flex justify-between py-0.5 cursor-pointer hover:text-white group/mini"
                  onClick={() => goToSymbol(t.symbol)}
                >
                  <span className="text-gray-400 group-hover/mini:text-terminal-accent truncate max-w-[90px]">
                    {shortName(t.symbol)}
                  </span>
                  <span className="text-terminal-success font-bold">+{t.changePercent.toFixed(2)}%</span>
                </div>
              ))}
            </div>

            {/* Top 5 losers mini-list */}
            <div className="border-t border-[#1e1e1e] pt-2">
              <div className="flex items-center gap-1 text-gray-500 mb-1">
                <TrendingDown size={8} className="text-terminal-error" />
                <span>TOP LOSERS</span>
              </div>
              {stats.topLosers.map((t) => (
                <div
                  key={t.symbol}
                  className="flex justify-between py-0.5 cursor-pointer hover:text-white group/mini"
                  onClick={() => goToSymbol(t.symbol)}
                >
                  <span className="text-gray-400 group-hover/mini:text-terminal-accent truncate max-w-[90px]">
                    {shortName(t.symbol)}
                  </span>
                  <span className="text-terminal-error font-bold">{t.changePercent.toFixed(2)}%</span>
                </div>
              ))}
            </div>

            {/* Most active mini-list */}
            <div className="border-t border-[#1e1e1e] pt-2">
              <div className="flex items-center gap-1 text-gray-500 mb-1">
                <span className="text-yellow-500">⚡</span>
                <span>MOST ACTIVE</span>
              </div>
              {stats.mostActive.map((t) => (
                <div
                  key={t.symbol}
                  className="flex justify-between py-0.5 cursor-pointer hover:text-white group/mini"
                  onClick={() => goToSymbol(t.symbol)}
                >
                  <span className="text-gray-400 group-hover/mini:text-terminal-accent truncate max-w-[90px]">
                    {shortName(t.symbol)}
                  </span>
                  <span className="text-gray-300">{fmtVol(t.volume)}</span>
                </div>
              ))}
            </div>

          </div>
        </Panel>
      </div>

      {/* ── Main Panel (TABLE / SECTORS) ────────────────────────────── */}
      <Panel
        title={`MARKET INTELLIGENCE — ${marketMode === 'CRYPTO' ? 'CRYPTO / BINANCE USDT' : 'A-SHARE MARKET'}`}
        className="flex-1 min-w-0"
        onRefresh={onRefresh}
        tools={
          <div className="flex items-center gap-1 mr-1">
            {/* Main tab toggle */}
            {(['TABLE', 'SECTORS'] as MainTab[]).map((mt) => (
              <button
                key={mt}
                onClick={() => setMainTab(mt)}
                className={[
                  'text-[9px] font-mono font-bold px-2 py-0.5 uppercase tracking-wider transition-colors',
                  mainTab === mt
                    ? 'bg-terminal-accent text-black'
                    : 'text-gray-500 hover:text-gray-200 border border-transparent hover:border-[#333]',
                ].join(' ')}
              >
                {mt}
              </button>
            ))}

            {mainTab === 'TABLE' && (
              <>
                <div className="h-3 w-px bg-[#333] mx-1" />
                {(['ALL', 'GAINERS', 'LOSERS', 'ACTIVE'] as Tab[]).map((t) => {
                  const labels: Record<Tab, string> = {
                    ALL: 'ALL',
                    GAINERS: '↑ GAINERS',
                    LOSERS: '↓ LOSERS',
                    ACTIVE: '⚡ ACTIVE',
                  };
                  return (
                    <button
                      key={t}
                      onClick={() => setTab(t)}
                      className={[
                        'text-[9px] font-mono font-bold px-2 py-0.5 uppercase tracking-wider transition-colors',
                        tab === t
                          ? 'bg-terminal-accent text-black'
                          : 'text-gray-500 hover:text-gray-200 border border-transparent hover:border-[#333]',
                      ].join(' ')}
                    >
                      {labels[t]}
                    </button>
                  );
                })}
                <div className="h-3 w-px bg-[#333] mx-1" />
                <input
                  type="text"
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  placeholder="FILTER…"
                  className="bg-[#0d0d0d] border border-[#333] text-[9px] font-mono text-white px-2 py-0.5 w-20 focus:outline-none focus:border-terminal-accent placeholder-gray-700 uppercase"
                />
                <span className="text-[9px] text-gray-600 font-mono ml-1">{filtered.length} rows</span>
              </>
            )}

            {mainTab === 'SECTORS' && (
              <>
                <div className="h-3 w-px bg-[#333] mx-1" />
                {/* Chart type toggle */}
                <div className="flex items-center gap-0.5">
                  {([
                    { type: 'BAR' as SectorChartType, icon: BarChart2, label: 'BAR' },
                    { type: 'HEATMAP' as SectorChartType, icon: Grid, label: 'HEAT' },
                    { type: 'LINE' as SectorChartType, icon: LineIcon, label: 'LINE' },
                  ] as { type: SectorChartType; icon: React.ElementType; label: string }[]).map(({ type, icon: Icon, label }) => (
                    <button
                      key={type}
                      onClick={() => setSectorChartType(type)}
                      title={label}
                      className={[
                        'flex items-center gap-0.5 text-[9px] font-mono font-bold px-1.5 py-0.5 uppercase tracking-wider transition-colors',
                        sectorChartType === type
                          ? 'bg-terminal-accent text-black'
                          : 'text-gray-500 hover:text-gray-200 border border-transparent hover:border-[#333]',
                      ].join(' ')}
                    >
                      <Icon size={8} />
                      {label}
                    </button>
                  ))}
                </div>
              </>
            )}

            {mainTab === 'SECTORS' && snapshots.length > 0 && (
              <>
                <div className="h-3 w-px bg-[#333] mx-1" />
                <div className="flex items-center gap-0.5">
                  <Clock size={8} className="text-gray-600" />
                  <button
                    onClick={() => setActiveSnapshot(null)}
                    className={`text-[9px] font-mono px-1.5 py-0.5 ${!activeSnapshot ? 'text-terminal-success font-bold' : 'text-gray-600 hover:text-gray-300'}`}
                  >
                    LIVE
                  </button>
                  {snapshots.map((snap) => (
                    <button
                      key={snap.ts}
                      onClick={() => setActiveSnapshot(snap)}
                      className={`text-[9px] font-mono px-1.5 py-0.5 ${activeSnapshot?.ts === snap.ts ? 'text-terminal-accent font-bold' : 'text-gray-600 hover:text-gray-300'}`}
                    >
                      {fmtTime(snap.ts)}
                    </button>
                  ))}
                </div>
              </>
            )}
          </div>
        }
      >
        {/* ── TABLE content ──────────────────────────────────────────── */}
        {mainTab === 'TABLE' && (
          <div className="h-full overflow-auto custom-scrollbar">
            <table className="w-full font-mono text-[10px] border-collapse">
              <thead className="sticky top-0 bg-[#0c0c0c] z-10">
                <tr className="border-b border-terminal-border">
                  <Th sortKey="symbol" {...sortProps} left>SYMBOL</Th>
                  {marketMode === 'CN_STOCK' && (
                    <th className="px-2 py-1.5 text-left text-gray-500 whitespace-nowrap">NAME</th>
                  )}
                  <Th sortKey="price" {...sortProps}>LAST</Th>
                  <Th sortKey="changePercent" {...sortProps}>CHG%</Th>
                  <Th sortKey="change" {...sortProps}>CHG</Th>
                  <Th sortKey="high" {...sortProps}>24H HIGH</Th>
                  <Th sortKey="low" {...sortProps}>24H LOW</Th>
                  <th className="px-2 py-1.5 text-center text-gray-500 whitespace-nowrap">DAY RANGE</th>
                  <Th sortKey="volume" {...sortProps}>VOLUME</Th>
                  <th className="px-2 py-1.5 text-right text-gray-500">BID</th>
                  <th className="px-2 py-1.5 text-right text-gray-500">ASK</th>
                  <Th sortKey="spread" {...sortProps}>SPREAD%</Th>
                  <th className="px-2 py-1.5 text-right text-gray-600 w-8"></th>
                </tr>
              </thead>
              <tbody>
                {filtered.length === 0 ? (
                  <tr>
                    <td colSpan={13} className="text-center py-12 text-gray-600">
                      {marketTickers.length === 0 ? 'LOADING MARKET DATA…' : 'NO RESULTS FOR FILTER'}
                    </td>
                  </tr>
                ) : (
                  filtered.map((ticker) => {
                    const dp = priceDp(ticker.price);
                    const spread =
                      ticker.ask && ticker.bid
                        ? ((ticker.ask - ticker.bid) / ticker.ask) * 100
                        : null;
                    const isUp = ticker.changePercent >= 0;
                    const flashBg =
                      ticker.lastTickDir === 'UP'
                        ? 'bg-green-900/10'
                        : ticker.lastTickDir === 'DOWN'
                        ? 'bg-red-900/10'
                        : '';

                    return (
                      <tr
                        key={ticker.symbol}
                        className={`border-b border-[#0f0f0f] hover:bg-[#141414] cursor-pointer group/row transition-colors ${flashBg}`}
                        onClick={() => goToSymbol(ticker.symbol)}
                      >
                        <td className="px-2 py-1 text-left">
                          <div className="flex items-center gap-1">
                            <span className="font-bold text-terminal-accent">{shortName(ticker.symbol)}</span>
                            {marketMode === 'CRYPTO' && (
                              <span className="text-gray-600 text-[8px]">USDT</span>
                            )}
                          </div>
                        </td>
                        {marketMode === 'CN_STOCK' && (
                          <td className="px-2 py-1 text-left text-gray-400 max-w-[90px] truncate">
                            {ticker.name ?? '—'}
                          </td>
                        )}
                        <td className="px-2 py-1 text-right text-white font-bold tabular-nums">
                          {ticker.price.toFixed(dp)}
                        </td>
                        <td className={`px-2 py-1 text-right font-bold tabular-nums ${isUp ? 'text-terminal-success' : 'text-terminal-error'}`}>
                          <span className="inline-flex items-center justify-end gap-0.5">
                            {isUp ? <ArrowUp size={7} /> : <ArrowDown size={7} />}
                            {isUp ? '+' : ''}{ticker.changePercent.toFixed(2)}%
                          </span>
                        </td>
                        <td className={`px-2 py-1 text-right tabular-nums ${isUp ? 'text-terminal-success' : 'text-terminal-error'}`}>
                          {ticker.change >= 0 ? '+' : ''}{ticker.change.toFixed(dp)}
                        </td>
                        <td className="px-2 py-1 text-right text-gray-400 tabular-nums">
                          {ticker.high.toFixed(dp)}
                        </td>
                        <td className="px-2 py-1 text-right text-gray-400 tabular-nums">
                          {ticker.low.toFixed(dp)}
                        </td>
                        <td className="px-2 py-1 text-center">
                          {ticker.high > ticker.low ? (
                            <RangeBar price={ticker.price} low={ticker.low} high={ticker.high} />
                          ) : (
                            <span className="text-gray-700">—</span>
                          )}
                        </td>
                        <td className="px-2 py-1 text-right text-gray-300 tabular-nums">
                          {fmtVol(ticker.volume)}
                        </td>
                        <td className="px-2 py-1 text-right text-sky-400 tabular-nums">
                          {ticker.bid ? ticker.bid.toFixed(dp) : <span className="text-gray-700">—</span>}
                        </td>
                        <td className="px-2 py-1 text-right text-orange-400 tabular-nums">
                          {ticker.ask ? ticker.ask.toFixed(dp) : <span className="text-gray-700">—</span>}
                        </td>
                        <td className={`px-2 py-1 text-right tabular-nums ${spread !== null ? (spread > 0.1 ? 'text-yellow-600' : 'text-gray-500') : 'text-gray-700'}`}>
                          {spread !== null ? `${spread.toFixed(3)}%` : '—'}
                        </td>
                        <td className="px-2 py-1 text-right">
                          <button
                            className="text-gray-700 group-hover/row:text-terminal-accent opacity-0 group-hover/row:opacity-100 transition-opacity"
                            title="Open chart"
                            onClick={(e) => { e.stopPropagation(); goToSymbol(ticker.symbol); }}
                          >
                            <ExternalLink size={9} />
                          </button>
                        </td>
                      </tr>
                    );
                  })
                )}
              </tbody>
            </table>
          </div>
        )}

        {/* ── SECTORS content ────────────────────────────────────────── */}
        {mainTab === 'SECTORS' && (
          <div className="flex h-full min-h-0 gap-1 p-1">
            {/* Chart area */}
            <div className="flex-1 flex flex-col min-h-0 min-w-0">
              {activeSnapshot && (
                <div className="flex items-center gap-1 mb-1 text-[9px] font-mono text-yellow-600 bg-yellow-900/10 border border-yellow-900/30 px-2 py-1 shrink-0">
                  <Clock size={8} />
                  VIEWING SNAPSHOT @ {fmtTime(activeSnapshot.ts)} — CLICK LIVE TO RETURN TO REAL-TIME
                </div>
              )}
              <div className="flex-1 min-h-0">
                <SectorCharts
                  chartType={sectorChartType}
                  liveSectorStats={displayedSectorStats}
                  snapshots={snapshots}
                  selectedSectorId={selectedSectorId}
                  onSelectSector={setSelectedSectorId}
                />
              </div>
            </div>

            {/* Component detail panel */}
            {selectedSector && (
              <div className="w-64 shrink-0 flex flex-col bg-terminal-panel border border-terminal-border min-h-0">
                {/* Header */}
                <div className="px-2 py-1.5 border-b border-terminal-border flex items-center justify-between shrink-0">
                  <div className="flex items-center gap-1.5">
                    <div
                      className="w-2 h-2 rounded-sm"
                      style={{ backgroundColor: selectedSector.def.color }}
                    />
                    <span className="text-[10px] font-bold font-mono text-gray-200">{selectedSector.def.name}</span>
                    <span className="text-[9px] text-gray-600">({selectedSector.def.nameEn})</span>
                  </div>
                  <button
                    onClick={() => setSelectedSectorId(null)}
                    className="text-gray-600 hover:text-gray-300 text-[10px] font-mono"
                  >
                    ✕
                  </button>
                </div>
                {/* Summary */}
                <div className="px-2 py-1.5 border-b border-[#1a1a1a] shrink-0 font-mono text-[9px]">
                  <div className="flex justify-between">
                    <span className="text-gray-500">AVG CHG</span>
                    <span className={selectedSector.avgChange >= 0 ? 'text-terminal-success font-bold' : 'text-terminal-error font-bold'}>
                      {selectedSector.avgChange >= 0 ? '+' : ''}{selectedSector.avgChange.toFixed(2)}%
                    </span>
                  </div>
                  <div className="flex justify-between mt-0.5">
                    <span className="text-gray-500">TOTAL VOL</span>
                    <span className="text-gray-300">{fmtVol(selectedSector.totalVolume)}</span>
                  </div>
                  <div className="flex justify-between mt-0.5">
                    <span className="text-gray-500">ADV / DEC</span>
                    <span>
                      <span className="text-terminal-success">{selectedSector.advancing}</span>
                      <span className="text-gray-600"> / </span>
                      <span className="text-terminal-error">{selectedSector.declining}</span>
                    </span>
                  </div>
                </div>
                {/* Component table */}
                <div className="flex-1 overflow-y-auto custom-scrollbar">
                  {selectedSector.components.length === 0 ? (
                    <div className="text-center py-6 text-[9px] font-mono text-gray-600">
                      NO COMPONENTS IN UNIVERSE
                    </div>
                  ) : (
                    <table className="w-full font-mono text-[9px]">
                      <thead className="sticky top-0 bg-[#111]">
                        <tr className="text-gray-600 border-b border-[#1a1a1a]">
                          <th className="px-2 py-1 text-left">SYMBOL</th>
                          <th className="px-2 py-1 text-right">LAST</th>
                          <th className="px-2 py-1 text-right">CHG%</th>
                          <th className="px-2 py-1 w-6"></th>
                        </tr>
                      </thead>
                      <tbody>
                        {[...selectedSector.components]
                          .sort((a, b) => b.changePercent - a.changePercent)
                          .map((c) => {
                            const isUp = c.changePercent >= 0;
                            return (
                              <tr
                                key={c.symbol}
                                className="border-b border-[#0f0f0f] hover:bg-[#141414] cursor-pointer group/row"
                                onClick={() => goToSymbol(c.symbol)}
                              >
                                <td className="px-2 py-1 text-left">
                                  <div className="font-bold text-terminal-accent">{shortName(c.symbol)}</div>
                                  {c.name && (
                                    <div className="text-[8px] text-gray-600 truncate max-w-[80px]">{c.name}</div>
                                  )}
                                </td>
                                <td className="px-2 py-1 text-right text-white tabular-nums">
                                  {c.price.toFixed(priceDp(c.price))}
                                </td>
                                <td className={`px-2 py-1 text-right font-bold tabular-nums ${isUp ? 'text-terminal-success' : 'text-terminal-error'}`}>
                                  {isUp ? '+' : ''}{c.changePercent.toFixed(2)}%
                                </td>
                                <td className="px-2 py-1 text-right">
                                  <div className="flex items-center justify-end gap-0.5 opacity-0 group-hover/row:opacity-100">
                                    <button
                                      title="Watchlist"
                                      onClick={(e) => { e.stopPropagation(); addToWatchlist?.(c.symbol); }}
                                      className="text-gray-600 hover:text-terminal-accent"
                                    >
                                      <BookmarkPlus size={8} />
                                    </button>
                                    <button
                                      title="Chart"
                                      onClick={(e) => { e.stopPropagation(); goToSymbol(c.symbol); }}
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
            )}
          </div>
        )}
      </Panel>
    </div>
  );
};
