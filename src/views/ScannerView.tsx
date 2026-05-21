import React, { useState } from 'react';
import { ArrowUp, ArrowDown, Activity } from 'lucide-react';
import type { MarketMode, MarketTicker, ScannerSort } from '../types';
import { ViewState } from '../types';
import type { ResourceKey } from '../constants/resources';
import { Panel } from '../components/ui/Panel';
import { ButtonGroup } from '../components/ui/ButtonGroup';

interface ScannerViewProps {
  marketMode: MarketMode;
  setMarketMode: (mode: MarketMode) => void;
  marketTickers: MarketTicker[];
  isScannerLoading: boolean;
  updateMarketData: () => void;
  addToWatchlist: (symbol: string) => void;
  setActiveSymbol: (symbol: string) => void;
  setView: (view: ViewState) => void;
  t: (key: ResourceKey) => string;
}

export const ScannerView = ({
  marketMode,
  setMarketMode,
  marketTickers,
  isScannerLoading,
  updateMarketData,
  addToWatchlist,
  setActiveSymbol,
  setView,
  t,
}: ScannerViewProps) => {
  const [scannerSort, setScannerSort] = useState<ScannerSort>('CHANGE_DESC');

  const sorted = [...marketTickers].sort((a, b) => {
    if (scannerSort === 'CHANGE_DESC') return b.changePercent - a.changePercent;
    if (scannerSort === 'CHANGE_ASC') return a.changePercent - b.changePercent;
    return b.volume - a.volume;
  });

  return (
    <Panel
      title={t('PNL_SCANNER')}
      className="h-full"
      onRefresh={updateMarketData}
      tools={
        <div className="flex items-center gap-3 mr-2">
          <ButtonGroup
            options={[
              { value: 'CRYPTO', label: 'CRYPTO', activeColor: 'text-blue-400' },
              { value: 'CN_STOCK', label: 'CN STOCKS', activeColor: 'text-red-400' },
            ]}
            value={marketMode}
            onChange={setMarketMode}
            size="xs"
          />
          <div className="w-px h-3 bg-gray-600" />
          <ButtonGroup
            options={[
              { value: 'CHANGE_DESC', label: 'GAINERS', icon: <ArrowUp size={9} /> },
              { value: 'CHANGE_ASC', label: 'LOSERS', icon: <ArrowDown size={9} /> },
              { value: 'VOL_DESC', label: 'VOLUME', icon: <Activity size={9} /> },
            ]}
            value={scannerSort}
            onChange={setScannerSort}
            variant="ghost"
            size="xs"
          />
        </div>
      }
    >
      <div className="overflow-auto h-full">
        <table className="w-full text-right font-mono text-xs">
          <thead className="bg-[#111] text-gray-500 sticky top-0 z-10">
            <tr>
              <th className="p-2 text-left">SYMBOL</th>
              <th className="p-2">PRICE</th>
              <th className="p-2">CHANGE %</th>
              <th className="p-2 text-center w-24">TREND</th>
              <th className="p-2">HIGH</th>
              <th className="p-2">LOW</th>
              <th className="p-2">VOLUME</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-[#222]">
            {sorted.map((ticker, i) => (
              <tr
                key={i}
                className="hover:bg-[#222] cursor-pointer"
                onClick={() => { setActiveSymbol(ticker.symbol); setView(ViewState.MARKET); }}
                onContextMenu={(e) => { e.preventDefault(); addToWatchlist(ticker.symbol); }}
              >
                <td className="p-2 text-left font-bold text-terminal-accent">
                  {ticker.symbol}
                  <div className="text-[9px] text-gray-500 font-normal">{ticker.name || ticker.symbol.replace('sh', '').replace('sz', '')}</div>
                </td>
                <td className="p-2 text-white">{ticker.price.toFixed(2)}</td>
                <td className={`p-2 font-bold ${ticker.changePercent > 0 ? 'text-terminal-success' : 'text-terminal-error'}`}>
                  {ticker.changePercent > 0 ? '+' : ''}{ticker.changePercent.toFixed(2)}%
                </td>
                <td className="p-2">
                  <div className="h-1.5 w-full bg-[#111] rounded overflow-hidden flex">
                    <div
                      className={`h-full ${ticker.changePercent >= 0 ? 'bg-terminal-success' : 'bg-terminal-error'}`}
                      style={{ width: `${Math.min(Math.abs(ticker.changePercent) * 5, 100)}%` }}
                    ></div>
                  </div>
                </td>
                <td className="p-2 text-gray-400">{ticker.high}</td>
                <td className="p-2 text-gray-400">{ticker.low}</td>
                <td className="p-2 text-gray-300 relative">
                  <div
                    className="absolute inset-y-1 right-0 bg-[#222] -z-10"
                    style={{ width: `${Math.min((ticker.volume / (sorted[0]?.volume || 1)) * 100, 100)}%` }}
                  ></div>
                  <span className="z-10 relative">{ticker.volume.toLocaleString()}</span>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </Panel>
  );
};
