import React, { useState, useMemo, useRef, useCallback } from 'react';
import { useTranslation } from 'react-i18next';
import { Plus, X, Play, BookmarkPlus, ExternalLink } from 'lucide-react';
import type { MarketMode, MarketTicker } from '../types';
import { ViewState } from '../types';
import { Panel } from '../components/ui/Panel';

// ── Types ──────────────────────────────────────────────────────────────────────

type ConditionField = 'changePercent' | 'change' | 'price' | 'volume' | 'spread';
type ConditionOp = 'gte' | 'lte' | 'gt' | 'lt';

interface Condition {
  id: string;
  field: ConditionField;
  op: ConditionOp;
  value: string;
}

interface Preset {
  name: string;
  color: string;
  conditions: Array<{ field: ConditionField; op: ConditionOp; value: string }>;
}

// ── Constants ──────────────────────────────────────────────────────────────────

const FIELD_LABELS: Record<ConditionField, string> = {
  changePercent: 'CHG%',
  change: 'CHG',
  price: 'PRICE',
  volume: 'VOLUME',
  spread: 'SPREAD%',
};

const OP_LABELS: Record<ConditionOp, string> = {
  gte: '≥',
  lte: '≤',
  gt: '>',
  lt: '<',
};

const PRESETS: Preset[] = [
  {
    name: 'BREAKOUT',
    color: 'text-terminal-success border-terminal-success/40',
    conditions: [{ field: 'changePercent', op: 'gte', value: '3' }],
  },
  {
    name: 'MOMENTUM',
    color: 'text-green-400 border-green-400/40',
    conditions: [{ field: 'changePercent', op: 'gte', value: '1.5' }],
  },
  {
    name: 'DIP',
    color: 'text-orange-400 border-orange-400/40',
    conditions: [{ field: 'changePercent', op: 'lte', value: '-2' }],
  },
  {
    name: 'DEEP DIP',
    color: 'text-terminal-error border-terminal-error/40',
    conditions: [{ field: 'changePercent', op: 'lte', value: '-5' }],
  },
  {
    name: 'HIGH VOL',
    color: 'text-blue-400 border-blue-400/40',
    conditions: [{ field: 'volume', op: 'gte', value: '1000000' }],
  },
  {
    name: 'TIGHT SPREAD',
    color: 'text-cyan-400 border-cyan-400/40',
    conditions: [{ field: 'spread', op: 'lte', value: '0.1' }],
  },
];

const FIELDS: ConditionField[] = ['changePercent', 'change', 'price', 'volume', 'spread'];
const OPS: ConditionOp[] = ['gte', 'lte', 'gt', 'lt'];

// ── Helpers ────────────────────────────────────────────────────────────────────

const fmtVol = (v: number): string => {
  if (v >= 1e9) return `${(v / 1e9).toFixed(2)}B`;
  if (v >= 1e6) return `${(v / 1e6).toFixed(2)}M`;
  if (v >= 1e3) return `${(v / 1e3).toFixed(1)}K`;
  return v.toFixed(0);
};

const getFieldValue = (ticker: MarketTicker, field: ConditionField): number => {
  if (field === 'spread') {
    return ticker.ask && ticker.bid ? ((ticker.ask - ticker.bid) / ticker.ask) * 100 : 0;
  }
  return (ticker[field] as number) ?? 0;
};

const applyOp = (v: number, op: ConditionOp, threshold: number): boolean => {
  if (op === 'gte') return v >= threshold;
  if (op === 'lte') return v <= threshold;
  if (op === 'gt') return v > threshold;
  return v < threshold;
};

// ── Props ──────────────────────────────────────────────────────────────────────

interface ScannerViewProps {
  marketMode: MarketMode;
  marketTickers: MarketTicker[];
  isScannerLoading: boolean;
  updateMarketData: () => void;
  addToWatchlist: (symbol: string) => void;
  setActiveSymbol: (symbol: string) => void;
  setView: (view: ViewState) => void;
}

// ── Main component ─────────────────────────────────────────────────────────────

export const ScannerView = ({
  marketMode,
  marketTickers,
  isScannerLoading,
  updateMarketData,
  addToWatchlist,
  setActiveSymbol,
  setView,
}: ScannerViewProps) => {
  const { t } = useTranslation();
  const [conditions, setConditions] = useState<Condition[]>([]);
  const idRef = useRef(0);
  const nextId = () => String(++idRef.current);

  // ── Condition management ──────────────────────────────────────────────────

  const addCondition = useCallback(() => {
    setConditions((prev) => [
      ...prev,
      { id: nextId(), field: 'changePercent', op: 'gte', value: '' },
    ]);
  }, []);

  const removeCondition = useCallback((id: string) => {
    setConditions((prev) => prev.filter((c) => c.id !== id));
  }, []);

  const updateCondition = useCallback(
    (id: string, patch: Partial<Omit<Condition, 'id'>>) => {
      setConditions((prev) =>
        prev.map((c) => (c.id === id ? { ...c, ...patch } : c)),
      );
    },
    [],
  );

  const applyPreset = useCallback((preset: Preset) => {
    setConditions(
      preset.conditions.map((c) => ({ ...c, id: nextId() })),
    );
  }, []);

  // ── Filtering ─────────────────────────────────────────────────────────────

  const results = useMemo(() => {
    if (conditions.length === 0) return [];
    const valid = conditions.filter((c) => c.value.trim() !== '' && !isNaN(parseFloat(c.value)));
    if (valid.length === 0) return [];

    return [...marketTickers]
      .filter((ticker) =>
        valid.every((cond) =>
          applyOp(getFieldValue(ticker, cond.field), cond.op, parseFloat(cond.value)),
        ),
      )
      .sort((a, b) => b.changePercent - a.changePercent);
  }, [marketTickers, conditions]);

  const shortName = (sym: string) =>
    sym.replace('-USDT', '').replace('sh', '').replace('sz', '');

  const hasConditions = conditions.length > 0;

  return (
    <div className="flex h-full gap-1 min-h-0">

      {/* ── Left: builder panel ──────────────────────────────────────── */}
      <div className="w-64 shrink-0 flex flex-col gap-1 min-h-0">

        {/* Presets */}
        <Panel title={t('PRESETS')} className="shrink-0">
          <div className="p-2 grid grid-cols-2 gap-1">
            {PRESETS.map((p) => (
              <button
                key={p.name}
                onClick={() => applyPreset(p)}
                className={`text-[9px] font-mono font-bold px-2 py-1.5 border uppercase tracking-wider hover:bg-white/5 transition-colors ${p.color}`}
              >
                {p.name}
              </button>
            ))}
          </div>
        </Panel>

        {/* Conditions */}
        <Panel
          title={t('CONDITIONS')}
          className="flex-1 overflow-hidden"
          tools={
            <button
              onClick={addCondition}
              className="flex items-center gap-0.5 text-[9px] font-mono text-terminal-accent hover:text-white mr-1"
            >
              <Plus size={9} />
              {t('ADD')}
            </button>
          }
        >
          <div className="p-2 space-y-1.5 overflow-y-auto h-full custom-scrollbar">
            {conditions.length === 0 ? (
              <div className="text-center py-6 text-[9px] font-mono text-gray-600">
                <div className="mb-1 text-lg">⊘</div>
                {t('NO_CONDITIONS_SET')}<br />
                <span className="text-gray-700">{t('SELECT_PRESET_HINT')}</span>
              </div>
            ) : (
              conditions.map((cond) => (
                <div key={cond.id} className="flex items-center gap-1 bg-[#111] border border-[#1e1e1e] p-1.5">
                  {/* field */}
                  <select
                    value={cond.field}
                    onChange={(e) => updateCondition(cond.id, { field: e.target.value as ConditionField })}
                    className="bg-transparent text-[9px] font-mono text-terminal-accent border-none outline-none flex-1 min-w-0 cursor-pointer"
                  >
                    {FIELDS.map((f) => (
                      <option key={f} value={f} className="bg-[#1a1a1a]">
                        {FIELD_LABELS[f]}
                      </option>
                    ))}
                  </select>
                  {/* op */}
                  <select
                    value={cond.op}
                    onChange={(e) => updateCondition(cond.id, { op: e.target.value as ConditionOp })}
                    className="bg-transparent text-[9px] font-mono text-gray-300 border-none outline-none w-6 text-center cursor-pointer"
                  >
                    {OPS.map((op) => (
                      <option key={op} value={op} className="bg-[#1a1a1a]">
                        {OP_LABELS[op]}
                      </option>
                    ))}
                  </select>
                  {/* value */}
                  <input
                    type="number"
                    value={cond.value}
                    onChange={(e) => updateCondition(cond.id, { value: e.target.value })}
                    placeholder="0"
                    className="bg-[#0d0d0d] border border-[#2a2a2a] text-[9px] font-mono text-white w-14 px-1 py-0.5 text-right focus:outline-none focus:border-terminal-accent"
                  />
                  {/* remove */}
                  <button
                    onClick={() => removeCondition(cond.id)}
                    className="text-gray-700 hover:text-terminal-error ml-0.5"
                  >
                    <X size={9} />
                  </button>
                </div>
              ))
            )}
          </div>
        </Panel>

        {/* Run info */}
        {hasConditions && (
          <div className="px-2 py-1.5 bg-terminal-panel border border-terminal-border font-mono text-[9px] flex items-center justify-between text-gray-500">
            <span className="flex items-center gap-1">
              <Play size={7} className="text-terminal-accent" />
              LIVE · {marketMode === 'CRYPTO' ? 'CRYPTO' : 'A-SHARE'}
            </span>
            <span>
              {isScannerLoading ? (
                <span className="text-yellow-600 animate-pulse">{t('LOADING')}</span>
              ) : (
                <span className="text-terminal-success">{results.length} {t('HITS')}</span>
              )}
            </span>
          </div>
        )}
      </div>

      {/* ── Right: results panel ─────────────────────────────────────── */}
      <Panel
        title={t('SCAN_RESULTS')}
        className="flex-1 min-w-0"
        onRefresh={updateMarketData}
      >
        {!hasConditions ? (
          <div className="flex flex-col items-center justify-center h-full text-center font-mono">
            <div className="text-4xl text-gray-700 mb-3">⊙</div>
            <div className="text-[11px] text-gray-500 font-bold tracking-widest">{t('SCANNER_IDLE')}</div>
            <div className="text-[9px] text-gray-700 mt-1">
              {t('SET_CONDITIONS_HINT')}
            </div>
          </div>
        ) : results.length === 0 ? (
          <div className="flex flex-col items-center justify-center h-full text-center font-mono">
            <div className="text-4xl text-gray-700 mb-3">⊘</div>
            <div className="text-[11px] text-gray-500 font-bold tracking-widest">{t('NO_MATCHES')}</div>
            <div className="text-[9px] text-gray-700 mt-1">
              {isScannerLoading ? t('LOADING_MARKET_DATA') : t('NO_INSTRUMENTS_PASS')}
            </div>
          </div>
        ) : (
          <div className="overflow-auto h-full custom-scrollbar">
            <table className="w-full font-mono text-[10px] border-collapse">
              <thead className="sticky top-0 bg-[#0c0c0c] z-10">
                <tr className="border-b border-terminal-border text-gray-500">
                  <th className="px-2 py-1.5 text-left w-6">#</th>
                  <th className="px-2 py-1.5 text-left">SYMBOL</th>
                  {marketMode === 'CN_STOCK' && (
                    <th className="px-2 py-1.5 text-left">NAME</th>
                  )}
                  <th className="px-2 py-1.5 text-right">LAST</th>
                  <th className="px-2 py-1.5 text-right">CHG%</th>
                  <th className="px-2 py-1.5 text-right">CHG</th>
                  <th className="px-2 py-1.5 text-right">VOLUME</th>
                  <th className="px-2 py-1.5 text-right">SPREAD%</th>
                  <th className="px-2 py-1.5 w-10"></th>
                </tr>
              </thead>
              <tbody>
                {results.map((ticker, idx) => {
                  const isUp = ticker.changePercent >= 0;
                  const spread =
                    ticker.ask && ticker.bid
                      ? ((ticker.ask - ticker.bid) / ticker.ask) * 100
                      : null;
                  return (
                    <tr
                      key={ticker.symbol}
                      className="border-b border-[#0f0f0f] hover:bg-[#141414] cursor-pointer group/row"
                      onClick={() => {
                        setActiveSymbol(ticker.symbol);
                        setView(ViewState.DASHBOARD);
                      }}
                    >
                      <td className="px-2 py-1 text-gray-700 tabular-nums">{idx + 1}</td>
                      <td className="px-2 py-1 text-left">
                        <span className="font-bold text-terminal-accent">
                          {shortName(ticker.symbol)}
                        </span>
                        {marketMode === 'CRYPTO' && (
                          <span className="text-gray-700 text-[8px] ml-0.5">USDT</span>
                        )}
                      </td>
                      {marketMode === 'CN_STOCK' && (
                        <td className="px-2 py-1 text-left text-gray-400 max-w-[80px] truncate">
                          {ticker.name ?? '—'}
                        </td>
                      )}
                      <td className="px-2 py-1 text-right text-white font-bold tabular-nums">
                        {ticker.price.toFixed(ticker.price >= 1 ? 2 : 6)}
                      </td>
                      <td className={`px-2 py-1 text-right font-bold tabular-nums ${isUp ? 'text-terminal-success' : 'text-terminal-error'}`}>
                        {isUp ? '+' : ''}{ticker.changePercent.toFixed(2)}%
                      </td>
                      <td className={`px-2 py-1 text-right tabular-nums ${isUp ? 'text-terminal-success' : 'text-terminal-error'}`}>
                        {ticker.change >= 0 ? '+' : ''}{ticker.change.toFixed(2)}
                      </td>
                      <td className="px-2 py-1 text-right text-gray-300 tabular-nums">
                        {fmtVol(ticker.volume)}
                      </td>
                      <td className={`px-2 py-1 text-right tabular-nums ${spread !== null ? (spread > 0.1 ? 'text-yellow-600' : 'text-gray-500') : 'text-gray-700'}`}>
                        {spread !== null ? `${spread.toFixed(3)}%` : '—'}
                      </td>
                      <td className="px-2 py-1 text-right">
                        <div className="flex items-center justify-end gap-1 opacity-0 group-hover/row:opacity-100 transition-opacity">
                          <button
                            title="Add to watchlist"
                            onClick={(e) => { e.stopPropagation(); addToWatchlist(ticker.symbol); }}
                            className="text-gray-600 hover:text-terminal-accent"
                          >
                            <BookmarkPlus size={9} />
                          </button>
                          <button
                            title="Open chart"
                            onClick={(e) => { e.stopPropagation(); setActiveSymbol(ticker.symbol); setView(ViewState.DASHBOARD); }}
                            className="text-gray-600 hover:text-terminal-accent"
                          >
                            <ExternalLink size={9} />
                          </button>
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </Panel>
    </div>
  );
};
