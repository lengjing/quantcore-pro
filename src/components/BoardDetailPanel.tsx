/**
 * BoardDetailPanel
 *
 * Drill-down panel for a selected board (概念板块/行业板块).
 * Shows board summary, component stocks sorted by change%, and actions.
 */

import React from 'react';
import { ExternalLink, BookmarkPlus, Loader } from 'lucide-react';
import type { BoardItem, BoardStock } from '../services/stock/sectorBoardService';
import type { ColorScheme } from '../types';
import type { LangKey, ResourceKey } from '../constants/resources';
import { RESOURCES } from '../constants/resources';
import { useColors } from '../hooks/useColors';

// ── Helpers ────────────────────────────────────────────────────────────────────

const fmtVol = (v: number): string => {
  if (v >= 1e9) return `${(v / 1e9).toFixed(1)}B`;
  if (v >= 1e6) return `${(v / 1e6).toFixed(1)}M`;
  if (v >= 1e3) return `${(v / 1e3).toFixed(1)}K`;
  return v.toFixed(0);
};

const fmtCNY = (v: number, lang: LangKey): string => {
  const abs = Math.abs(v);
  const yi = RESOURCES[lang].FMT_YI;
  const wan = RESOURCES[lang].FMT_WAN;
  if (abs >= 1e8) return `${(v / 1e8).toFixed(2)}${yi}`;
  if (abs >= 1e4) return `${(v / 1e4).toFixed(0)}${wan}`;
  return v.toFixed(0);
};

// ── Props ──────────────────────────────────────────────────────────────────────

interface BoardDetailPanelProps {
  board: BoardItem;
  stocks: BoardStock[];
  isLoading: boolean;
  onClose: () => void;
  onGoToSymbol: (symbol: string) => void;
  onAddToWatchlist?: (symbol: string) => void;
  colorScheme: ColorScheme;
  lang: LangKey;
}

// ── Component ──────────────────────────────────────────────────────────────────

export const BoardDetailPanel: React.FC<BoardDetailPanelProps> = ({
  board,
  stocks,
  isLoading,
  onClose,
  onGoToSymbol,
  onAddToWatchlist,
  colorScheme,
  lang,
}) => {
  const colors = useColors(colorScheme);
  const t = (key: ResourceKey): string => RESOURCES[lang][key];
  const isUp = board.changePercent >= 0;

  return (
    <div className="w-80 shrink-0 flex flex-col bg-terminal-panel border border-terminal-border min-h-0">

      {/* ── Header ─────────────────────────────────────────────────────────── */}
      <div className="px-2 py-1.5 border-b border-terminal-border flex items-center justify-between shrink-0">
        <div className="flex items-center gap-1.5 min-w-0">
          <div className="w-2 h-2 rounded-sm shrink-0 bg-terminal-accent" />
          <span className="text-[10px] font-bold font-mono text-gray-200 truncate">{board.name}</span>
          <span className="text-[8px] text-gray-600 truncate">{board.code}</span>
        </div>
        <button onClick={onClose} className="text-gray-600 hover:text-gray-300 text-[10px] font-mono ml-1 shrink-0">✕</button>
      </div>

      {/* ── Summary bar ────────────────────────────────────────────────────── */}
      <div className="px-2 py-1 border-b border-[#1a1a1a] shrink-0 font-mono text-[9px] flex gap-3 items-center flex-wrap">
        <span className={`${colors.clsBold(board.changePercent)}`}>
          {isUp ? '+' : ''}{board.changePercent.toFixed(2)}%
        </span>
        <span className="text-gray-600">|</span>
        <span className={colors.upClass}>{board.advancing}↑</span>
        <span className={colors.downClass}>{board.declining}↓</span>
        <span className="text-gray-600">|</span>
        <span className={`${board.mainNetInflow > 0 ? colors.upClass : board.mainNetInflow < 0 ? colors.downClass : 'text-gray-500'}`}>
          {t('MAIN_INFLOW')} {board.mainNetInflow > 0 ? '+' : ''}{fmtCNY(board.mainNetInflow, lang)}
        </span>
        <span className="text-gray-600">|</span>
        <span className="text-gray-500">{t('TURNOVER')} {board.turnoverRate.toFixed(2)}%</span>
      </div>

      {/* ── Leader info ────────────────────────────────────────────────────── */}
      {board.leaderName && (
        <div className="px-2 py-1 border-b border-[#1a1a1a] shrink-0 font-mono text-[9px] flex items-center gap-2">
          <span className="text-gray-600">{t('LEADER')}</span>
          <span className="text-white font-bold">{board.leaderName}</span>
          <span className={colors.cls(board.leaderChangePercent)}>
            {board.leaderChangePercent >= 0 ? '+' : ''}{board.leaderChangePercent.toFixed(2)}%
          </span>
        </div>
      )}

      {/* ── Component stocks table ──────────────────────────────────────────── */}
      <div className="flex-1 overflow-y-auto custom-scrollbar min-h-0">
        {isLoading && stocks.length === 0 ? (
          <div className="flex items-center justify-center py-12 text-gray-600 text-[9px] font-mono">
            <Loader size={10} className="animate-spin mr-2" />
            {t('LOADING_STOCKS')}
          </div>
        ) : stocks.length === 0 ? (
          <div className="text-center py-6 text-[9px] font-mono text-gray-600">
            {t('NO_COMPONENT_STOCKS')}
          </div>
        ) : (
          <table className="w-full font-mono text-[9px]">
            <thead className="sticky top-0 bg-[#111]">
              <tr className="text-gray-600 border-b border-[#1a1a1a]">
                <th className="px-2 py-1 text-left">{t('TH_SYMBOL')}</th>
                <th className="px-2 py-1 text-right">{t('TH_LAST')}</th>
                <th className="px-2 py-1 text-right">{t('TH_CHG')}</th>
                <th className="px-2 py-1 text-right">{t('TH_VOL')}</th>
                <th className="px-2 py-1 w-8"></th>
              </tr>
            </thead>
            <tbody>
              {[...stocks]
                .sort((a, b) => b.changePercent - a.changePercent)
                .map((stock) => {
                  const stockUp = stock.changePercent >= 0;
                  return (
                    <tr
                      key={stock.symbol}
                      className="border-b border-[#0f0f0f] hover:bg-[#141414] cursor-pointer group/row"
                      onClick={() => onGoToSymbol(stock.symbol)}
                    >
                      <td className="px-2 py-1 text-left">
                        <span className="font-bold text-terminal-accent">
                          {stock.symbol.replace(/^(sh|sz)/, '')}
                        </span>
                        {stock.name && (
                          <div className="text-[8px] text-gray-600 truncate max-w-[80px]">{stock.name}</div>
                        )}
                      </td>
                      <td className="px-2 py-1 text-right text-white tabular-nums">
                        {stock.price.toFixed(2)}
                      </td>
                      <td className={`px-2 py-1 text-right font-bold tabular-nums ${colors.clsBold(stock.changePercent)}`}>
                        {stockUp ? '+' : ''}{stock.changePercent.toFixed(2)}%
                      </td>
                      <td className="px-2 py-1 text-right text-gray-400 tabular-nums">
                        {fmtVol(stock.volume)}
                      </td>
                      <td className="px-2 py-1 text-right">
                        <div className="flex items-center justify-end gap-0.5 opacity-0 group-hover/row:opacity-100">
                          <button
                            title="Add to watchlist"
                            onClick={(e) => { e.stopPropagation(); onAddToWatchlist?.(stock.symbol); }}
                            className="text-gray-600 hover:text-terminal-accent"
                          >
                            <BookmarkPlus size={8} />
                          </button>
                          <button
                            title="Open chart"
                            onClick={(e) => { e.stopPropagation(); onGoToSymbol(stock.symbol); }}
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
