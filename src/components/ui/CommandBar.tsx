import React, { useState, useEffect, forwardRef } from 'react';
import { Wifi, AlertTriangle } from 'lucide-react';
import type { MarketMode, TradingMode } from '../../types';
import { ButtonGroup } from './ButtonGroup';

const STOCK_ADAPTERS = [
  { value: 'eastmoney', label: 'EM' },
  { value: 'tencent', label: 'TX' },
  { value: 'sina', label: 'SINA' },
];

interface CommandBarProps {
  value: string;
  onChange: (v: string) => void;
  onSubmit: () => void;
  onHelp: () => void;
  onMenu: () => void;
  marketMode: MarketMode;
  setMarketMode: (mode: MarketMode) => void;
  stockAdapterId: string;
  setStockAdapter: (id: string) => void;
  tradingMode: TradingMode;
  setTradingMode: (mode: TradingMode) => void;
}

const Clock = () => {
  const [time, setTime] = useState(new Date());
  useEffect(() => {
    const timer = setInterval(() => setTime(new Date()), 1000);
    return () => clearInterval(timer);
  }, []);
  return <span>{time.toLocaleTimeString('en-US', { hour12: false })}</span>;
};

export const CommandBar = forwardRef<HTMLInputElement, CommandBarProps>(
  (
    {
      value,
      onChange,
      onSubmit,
      onHelp,
      onMenu,
      marketMode,
      setMarketMode,
      stockAdapterId,
      setStockAdapter,
      tradingMode,
      setTradingMode,
    },
    ref,
  ) => (
    <div className="h-8 bg-terminal-bg border-b border-terminal-border flex items-center px-2 gap-1 shrink-0 min-w-0">
      {/* Command input */}
      <div className="text-terminal-accent font-bold text-xs select-none shrink-0">CMD:</div>
      <div className="w-48 shrink-0">
        <input
          ref={ref}
          type="text"
          value={value}
          onChange={(e) => onChange(e.target.value)}
          onKeyDown={(e) => e.key === 'Enter' && onSubmit()}
          className="w-full bg-transparent border-none text-xs text-white font-mono focus:outline-none uppercase placeholder-gray-700"
          placeholder="BUY BTC / ADD ETH…"
          autoFocus
          spellCheck={false}
        />
      </div>

      <div className="h-4 w-px bg-terminal-border mx-1 shrink-0" />

      {/* Market mode */}
      <ButtonGroup
        options={[
          { value: 'CRYPTO', label: 'CRYPTO', activeColor: 'text-blue-400' },
          { value: 'CN_STOCK', label: 'A-SHARE', activeColor: 'text-red-400' },
        ]}
        value={marketMode}
        onChange={setMarketMode}
        size="xs"
      />

      {/* Adapter picker — only in A-share mode */}
      {marketMode === 'CN_STOCK' && (
        <>
          <div className="h-4 w-px bg-terminal-border mx-1 shrink-0" />
          <ButtonGroup
            options={STOCK_ADAPTERS}
            value={stockAdapterId}
            onChange={setStockAdapter}
            variant="ghost"
            size="xs"
          />
        </>
      )}

      <div className="h-4 w-px bg-terminal-border mx-1 shrink-0" />

      {/* Trading mode */}
      {tradingMode === 'LIVE' ? (
        <button
          onClick={() => setTradingMode('PAPER')}
          className="flex items-center gap-1 px-2 py-0.5 text-[9px] font-mono font-bold uppercase tracking-wider text-red-400 border border-red-700 bg-red-950/40 hover:bg-red-900/60 animate-pulse rounded-sm"
          title="Click to switch to Paper mode"
        >
          <AlertTriangle size={8} />
          LIVE
        </button>
      ) : (
        <button
          onClick={() => setTradingMode('LIVE')}
          className="flex items-center gap-1 px-2 py-0.5 text-[9px] font-mono font-bold uppercase tracking-wider text-gray-400 border border-[#333] bg-[#181818] hover:border-red-700 hover:text-red-400 rounded-sm"
          title="Switch to Live trading (real funds)"
        >
          PAPER
        </button>
      )}

      {/* Spacer */}
      <div className="flex-1" />

      {/* Action buttons */}
      <div className="flex items-center gap-1 shrink-0">
        <button
          onClick={onHelp}
          className="text-[10px] text-black bg-terminal-accent px-2 py-0.5 font-bold hover:bg-yellow-500"
        >
          HELP
        </button>
        <button
          onClick={onMenu}
          className="text-[10px] text-black bg-gray-400 px-2 py-0.5 font-bold hover:bg-gray-300"
        >
          MENU
        </button>
      </div>

      <div className="h-4 w-px bg-terminal-border mx-1 shrink-0" />

      {/* Connection status + clock */}
      <div className="flex items-center gap-3 text-[10px] font-mono text-gray-400 shrink-0">
        <span className="flex items-center text-terminal-success">
          <Wifi size={10} className="mr-1" /> CNNCTD
        </span>
        <Clock />
      </div>
    </div>
  ),
);

CommandBar.displayName = 'CommandBar';
