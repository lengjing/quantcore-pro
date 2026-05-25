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
  Plus,
  X,
  Loader,
  ChevronLeft,
  RefreshCw,
} from 'lucide-react';
import type { MarketTicker, MarketMode, ViewState as ViewStateType } from '../types';
import { ViewState } from '../types';
import { Panel } from '../components/ui/Panel';
import { Modal } from '../components/ui/Modal';
import {
  CRYPTO_SECTORS,
  CN_SECTORS,
  computeSectorStats,
  type SectorStats,
  type SectorSnapshot,
  type CustomSectorDef,
  nextCustomColor,
  newCustomSectorId,
} from '../data/sectors';
import { SectorCharts, type SectorChartType } from '../components/SectorCharts';
import { SectorDetailPanel } from '../components/SectorDetailPanel';
import { useSectorBoards } from '../hooks/useSectorBoards';
import type { BoardCategory } from '../services/stock/sectorBoardService';

// ── Types ──────────────────────────────────────────────────────────────────────

type MainTab = 'TABLE' | 'SECTORS' | 'BOARDS';
type Tab = 'ALL' | 'GAINERS' | 'LOSERS' | 'ACTIVE';
type SortKey = keyof Pick<
  MarketTicker,
  'symbol' | 'price' | 'changePercent' | 'change' | 'volume' | 'high' | 'low'
> | 'spread';
type SortDir = 'asc' | 'desc';

// ── Helpers ────────────────────────────────────────────────────────────────────

/** Format large CNY values with 亿/万 units */
function formatCNY(value: number): string {
  const abs = Math.abs(value);
  if (abs >= 1e8) return `${(value / 1e8).toFixed(2)}亿`;
  if (abs >= 1e4) return `${(value / 1e4).toFixed(0)}万`;
  return value.toFixed(0);
}

interface MarketViewProps {
  marketTickers: MarketTicker[];
  marketMode: MarketMode;
  setActiveSymbol: (s: string) => void;
  setView: (v: ViewStateType) => void;
  addToWatchlist?: (symbol: string) => void;
  onRefresh?: () => void;
  customSectors: CustomSectorDef[];
  setCustomSectors: (fn: (prev: CustomSectorDef[]) => CustomSectorDef[]) => void;
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
  customSectors,
  setCustomSectors,
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

  // ── API-driven sector boards (题材聚焦 / 题材轮动) ────────────────────────
  const sectorBoards = useSectorBoards();

  // ── Custom (user-defined) sectors — state is owned by App.tsx ─────────────
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [newSectorName, setNewSectorName] = useState('');
  const [newSectorNameEn, setNewSectorNameEn] = useState('');
  const [newSectorSymbols, setNewSectorSymbols] = useState('');

  const handleCreateSector = useCallback(() => {
    const name = newSectorName.trim();
    if (!name) return;
    const symbols = newSectorSymbols
      .split(/[\n,，\s]+/)
      .map((s) => s.trim().toUpperCase())
      .filter(Boolean);
    const sector: CustomSectorDef = {
      id: newCustomSectorId(),
      name,
      nameEn: newSectorNameEn.trim() || name,
      color: nextCustomColor(customSectors),
      symbols,
      isCustom: true,
    };
    setCustomSectors((prev) => [...prev, sector]);
    setNewSectorName('');
    setNewSectorNameEn('');
    setNewSectorSymbols('');
    setShowCreateModal(false);
    setSelectedSectorId(sector.id);
  }, [newSectorName, newSectorNameEn, newSectorSymbols, customSectors, setCustomSectors]);

  const handleDeleteCustomSector = useCallback(
    (id: string) => {
      setCustomSectors((prev) => prev.filter((s) => s.id !== id));
      setSelectedSectorId((prev) => (prev === id ? null : prev));
    },
    [setCustomSectors],
  );

  // Push a snapshot every 5 minutes when tickers change
  useEffect(() => {
    if (marketTickers.length === 0) return;
    const now = Date.now();
    if (now - lastSnapshotRef.current >= 5 * 60 * 1000) {
      lastSnapshotRef.current = now;
      const builtIn = marketMode === 'CRYPTO' ? CRYPTO_SECTORS : CN_SECTORS;
      const sectors = [...builtIn, ...customSectors];
      const stats = computeSectorStats(marketTickers, sectors);
      setSnapshots((prev) => {
        const next = [...prev, { ts: now, sectorStats: stats }];
        return next.slice(-12);
      });
    }
  }, [marketTickers, marketMode, customSectors]);

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
    const builtIn = marketMode === 'CRYPTO' ? CRYPTO_SECTORS : CN_SECTORS;
    const sectors = [...builtIn, ...customSectors];
    return computeSectorStats(marketTickers, sectors);
  }, [marketTickers, marketMode, customSectors]);

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
            {(['TABLE', 'SECTORS', 'BOARDS'] as MainTab[]).map((mt) => (
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
                {mt === 'BOARDS' ? '题材' : mt}
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
            {mainTab === 'SECTORS' && (
              <>
                <div className="h-3 w-px bg-[#333] mx-1" />
                <button
                  onClick={() => setShowCreateModal(true)}
                  title="Create custom concept sector"
                  className="flex items-center gap-0.5 text-[9px] font-mono font-bold px-1.5 py-0.5 text-gray-500 hover:text-gray-200 border border-transparent hover:border-[#333] transition-colors"
                >
                  <Plus size={8} />CONCEPT
                </button>
              </>
            )}

            {mainTab === 'BOARDS' && (
              <>
                <div className="h-3 w-px bg-[#333] mx-1" />
                {/* Board category toggle */}
                {(['concept', 'industry'] as BoardCategory[]).map((cat) => (
                  <button
                    key={cat}
                    onClick={() => sectorBoards.switchCategory(cat)}
                    className={[
                      'text-[9px] font-mono font-bold px-2 py-0.5 uppercase tracking-wider transition-colors',
                      sectorBoards.category === cat
                        ? 'bg-terminal-accent text-black'
                        : 'text-gray-500 hover:text-gray-200 border border-transparent hover:border-[#333]',
                    ].join(' ')}
                  >
                    {cat === 'concept' ? '概念板块' : '行业板块'}
                  </button>
                ))}
                <div className="h-3 w-px bg-[#333] mx-1" />
                <button
                  onClick={() => sectorBoards.refreshBoards()}
                  title="Refresh board data"
                  className="flex items-center gap-0.5 text-[9px] font-mono font-bold px-1.5 py-0.5 text-gray-500 hover:text-gray-200 border border-transparent hover:border-[#333] transition-colors"
                >
                  <RefreshCw size={8} />REFRESH
                </button>
                {sectorBoards.selectedBoard && (
                  <>
                    <div className="h-3 w-px bg-[#333] mx-1" />
                    <button
                      onClick={() => sectorBoards.selectBoard(null)}
                      className="flex items-center gap-0.5 text-[9px] font-mono font-bold px-1.5 py-0.5 text-terminal-accent hover:text-yellow-300 transition-colors"
                    >
                      <ChevronLeft size={8} />BACK
                    </button>
                    <span className="text-[9px] font-mono text-white font-bold ml-1">
                      {sectorBoards.selectedBoard.name}
                    </span>
                  </>
                )}
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
              <SectorDetailPanel
                sector={selectedSector}
                marketMode={marketMode}
                isCustom={'isCustom' in selectedSector.def && (selectedSector.def as CustomSectorDef).isCustom}
                onClose={() => setSelectedSectorId(null)}
                onGoToSymbol={goToSymbol}
                onAddToWatchlist={addToWatchlist}
                onDeleteCustom={handleDeleteCustomSector}
              />
            )}
          </div>
        )}

        {/* ── BOARDS content (题材聚焦 / 题材轮动) ────────────────────── */}
        {mainTab === 'BOARDS' && (
          <div className="h-full overflow-auto custom-scrollbar">
            {sectorBoards.isLoading && sectorBoards.boards.length === 0 ? (
              <div className="flex items-center justify-center h-full text-gray-600 text-[10px] font-mono">
                <Loader size={12} className="animate-spin mr-2" />
                LOADING BOARD DATA…
              </div>
            ) : !sectorBoards.selectedBoard ? (
              /* ── Board list table ──────────────────────────────────── */
              <table className="w-full font-mono text-[10px] border-collapse">
                <thead className="sticky top-0 bg-[#0c0c0c] z-10">
                  <tr className="border-b border-terminal-border">
                    <th className="px-2 py-1.5 text-left text-gray-500 whitespace-nowrap">#</th>
                    <th className="px-2 py-1.5 text-left text-gray-500 whitespace-nowrap">BOARD NAME</th>
                    <th className="px-2 py-1.5 text-right text-gray-500 whitespace-nowrap">CHG%</th>
                    <th className="px-2 py-1.5 text-right text-gray-500 whitespace-nowrap">TURNOVER%</th>
                    <th className="px-2 py-1.5 text-center text-gray-500 whitespace-nowrap">↑/↓</th>
                    <th className="px-2 py-1.5 text-right text-gray-500 whitespace-nowrap">MAIN INFLOW</th>
                    <th className="px-2 py-1.5 text-left text-gray-500 whitespace-nowrap">LEADER</th>
                    <th className="px-2 py-1.5 text-right text-gray-500 whitespace-nowrap">LEADER CHG%</th>
                  </tr>
                </thead>
                <tbody>
                  {sectorBoards.boards.length === 0 ? (
                    <tr>
                      <td colSpan={8} className="text-center py-12 text-gray-600">
                        {marketMode === 'CRYPTO' ? 'BOARDS ONLY AVAILABLE FOR A-SHARE MARKET' : 'NO BOARD DATA AVAILABLE'}
                      </td>
                    </tr>
                  ) : (
                    sectorBoards.boards.map((board, idx) => {
                      const isPos = board.changePercent > 0;
                      const isNeg = board.changePercent < 0;
                      const inflowStr = formatCNY(board.mainNetInflow);
                      return (
                        <tr
                          key={board.code}
                          className="border-b border-[#1a1a1a] hover:bg-[#111] cursor-pointer group/row transition-colors"
                          onClick={() => sectorBoards.selectBoard(board)}
                        >
                          <td className="px-2 py-1.5 text-gray-600">{idx + 1}</td>
                          <td className="px-2 py-1.5 text-white font-bold">{board.name}</td>
                          <td className={`px-2 py-1.5 text-right tabular-nums font-bold ${isPos ? 'text-terminal-success' : isNeg ? 'text-terminal-error' : 'text-gray-400'}`}>
                            {isPos ? '+' : ''}{board.changePercent.toFixed(2)}%
                          </td>
                          <td className="px-2 py-1.5 text-right tabular-nums text-gray-400">
                            {board.turnoverRate.toFixed(2)}%
                          </td>
                          <td className="px-2 py-1.5 text-center whitespace-nowrap">
                            <span className="text-terminal-success">{board.advancing}</span>
                            <span className="text-gray-600 mx-0.5">/</span>
                            <span className="text-terminal-error">{board.declining}</span>
                          </td>
                          <td className={`px-2 py-1.5 text-right tabular-nums ${board.mainNetInflow > 0 ? 'text-terminal-success' : board.mainNetInflow < 0 ? 'text-terminal-error' : 'text-gray-400'}`}>
                            {board.mainNetInflow > 0 ? '+' : ''}{inflowStr}
                          </td>
                          <td className="px-2 py-1.5 text-gray-300 truncate max-w-[80px]">{board.leaderName}</td>
                          <td className={`px-2 py-1.5 text-right tabular-nums ${board.leaderChangePercent > 0 ? 'text-terminal-success' : board.leaderChangePercent < 0 ? 'text-terminal-error' : 'text-gray-400'}`}>
                            {board.leaderChangePercent > 0 ? '+' : ''}{board.leaderChangePercent.toFixed(2)}%
                          </td>
                        </tr>
                      );
                    })
                  )}
                </tbody>
              </table>
            ) : (
              /* ── Board detail: component stocks ────────────────────── */
              <table className="w-full font-mono text-[10px] border-collapse">
                <thead className="sticky top-0 bg-[#0c0c0c] z-10">
                  <tr className="border-b border-terminal-border">
                    <th className="px-2 py-1.5 text-left text-gray-500 whitespace-nowrap">SYMBOL</th>
                    <th className="px-2 py-1.5 text-left text-gray-500 whitespace-nowrap">NAME</th>
                    <th className="px-2 py-1.5 text-right text-gray-500 whitespace-nowrap">PRICE</th>
                    <th className="px-2 py-1.5 text-right text-gray-500 whitespace-nowrap">CHG%</th>
                    <th className="px-2 py-1.5 text-right text-gray-500 whitespace-nowrap">CHG</th>
                    <th className="px-2 py-1.5 text-right text-gray-500 whitespace-nowrap">VOLUME</th>
                    <th className="px-2 py-1.5 text-right text-gray-500 whitespace-nowrap">TURNOVER%</th>
                    <th className="px-2 py-1.5 text-right text-gray-600 w-8"></th>
                  </tr>
                </thead>
                <tbody>
                  {sectorBoards.isBoardStocksLoading && sectorBoards.boardStocks.length === 0 ? (
                    <tr>
                      <td colSpan={8} className="text-center py-12 text-gray-600">
                        <Loader size={12} className="animate-spin inline mr-2" />
                        LOADING STOCKS…
                      </td>
                    </tr>
                  ) : (
                    sectorBoards.boardStocks.map((stock) => {
                      const isPos = stock.changePercent > 0;
                      const isNeg = stock.changePercent < 0;
                      return (
                        <tr
                          key={stock.symbol}
                          className="border-b border-[#1a1a1a] hover:bg-[#111] cursor-pointer group/row transition-colors"
                          onClick={() => goToSymbol(stock.symbol)}
                        >
                          <td className="px-2 py-1.5 text-terminal-accent font-bold">{stock.symbol.replace(/^(sh|sz)/, '')}</td>
                          <td className="px-2 py-1.5 text-gray-300">{stock.name}</td>
                          <td className="px-2 py-1.5 text-right tabular-nums text-white">{stock.price.toFixed(2)}</td>
                          <td className={`px-2 py-1.5 text-right tabular-nums font-bold ${isPos ? 'text-terminal-success' : isNeg ? 'text-terminal-error' : 'text-gray-400'}`}>
                            {isPos ? '+' : ''}{stock.changePercent.toFixed(2)}%
                          </td>
                          <td className={`px-2 py-1.5 text-right tabular-nums ${isPos ? 'text-terminal-success' : isNeg ? 'text-terminal-error' : 'text-gray-400'}`}>
                            {isPos ? '+' : ''}{stock.change.toFixed(2)}
                          </td>
                          <td className="px-2 py-1.5 text-right tabular-nums text-gray-400">{fmtVol(stock.volume)}</td>
                          <td className="px-2 py-1.5 text-right tabular-nums text-gray-400">{stock.turnoverRate.toFixed(2)}%</td>
                          <td className="px-2 py-1.5 text-right">
                            <button
                              className="text-gray-700 group-hover/row:text-terminal-accent opacity-0 group-hover/row:opacity-100 transition-opacity"
                              title="Open chart"
                              onClick={(e) => { e.stopPropagation(); goToSymbol(stock.symbol); }}
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
            )}
          </div>
        )}
      </Panel>

      {/* ── Create custom sector modal ─────────────────────────────────────── */}
      <Modal
        isOpen={showCreateModal}
        onClose={() => setShowCreateModal(false)}
        title="NEW CONCEPT SECTOR"
        width="max-w-md"
      >
        <div className="space-y-3 font-mono text-[10px]">
          <div>
            <label className="block text-gray-500 mb-1 uppercase tracking-wider text-[9px]">Sector Name *</label>
            <input
              type="text"
              value={newSectorName}
              onChange={(e) => setNewSectorName(e.target.value)}
              placeholder="e.g. MLCC 概念"
              className="w-full bg-[#0d0d0d] border border-[#333] text-white text-[10px] font-mono px-2 py-1.5 focus:outline-none focus:border-terminal-accent placeholder-gray-700"
              autoFocus
            />
          </div>
          <div>
            <label className="block text-gray-500 mb-1 uppercase tracking-wider text-[9px]">English Name</label>
            <input
              type="text"
              value={newSectorNameEn}
              onChange={(e) => setNewSectorNameEn(e.target.value)}
              placeholder="e.g. MLCC"
              className="w-full bg-[#0d0d0d] border border-[#333] text-white text-[10px] font-mono px-2 py-1.5 focus:outline-none focus:border-terminal-accent placeholder-gray-700"
            />
          </div>
          <div>
            <label className="block text-gray-500 mb-1 uppercase tracking-wider text-[9px]">
              Symbols (comma or newline separated)
            </label>
            <textarea
              value={newSectorSymbols}
              onChange={(e) => setNewSectorSymbols(e.target.value)}
              placeholder={marketMode === 'CRYPTO'
                ? 'BTC-USDT\nETH-USDT\nSOL-USDT'
                : 'sh600563\nsz300510\nsz002812'}
              rows={6}
              className="w-full bg-[#0d0d0d] border border-[#333] text-white text-[10px] font-mono px-2 py-1.5 focus:outline-none focus:border-terminal-accent placeholder-gray-700 resize-none"
            />
            <p className="text-[8px] text-gray-600 mt-0.5">
              {marketMode === 'CRYPTO'
                ? 'Use Binance pairs like BTC-USDT, ETH-USDT'
                : 'Use A-share codes like sh600563, sz300510'}
            </p>
          </div>
          <div className="flex items-center justify-end gap-2 pt-1">
            <button
              onClick={() => setShowCreateModal(false)}
              className="flex items-center gap-1 text-[9px] font-mono font-bold px-3 py-1.5 text-gray-500 hover:text-gray-200 border border-[#333] hover:border-[#555] transition-colors"
            >
              <X size={8} />CANCEL
            </button>
            <button
              onClick={handleCreateSector}
              disabled={!newSectorName.trim()}
              className="flex items-center gap-1 text-[9px] font-mono font-bold px-3 py-1.5 bg-terminal-accent text-black hover:bg-yellow-400 disabled:opacity-30 disabled:cursor-not-allowed transition-colors"
            >
              <Plus size={8} />CREATE
            </button>
          </div>
        </div>
      </Modal>
    </div>
  );
};
