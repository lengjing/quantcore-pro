import React, { useState, useEffect, useCallback, forwardRef } from 'react';
import { Wifi, AlertTriangle, ChevronDown } from 'lucide-react';
import type { MarketMode, TradingMode } from '../../types';

/**
 * Combined data-source value that encodes both market mode and adapter
 * so a single <select> controls everything.
 */
type DataSource =
  | 'crypto-binance'
  | 'stock-eastmoney'
  | 'stock-tencent'
  | 'stock-sina';

const DATA_SOURCE_OPTIONS: { value: DataSource; label: string; group: string }[] = [
  { value: 'crypto-binance',   label: 'CRYPTO  ·  BINANCE WSS',    group: 'CRYPTO' },
  { value: 'stock-eastmoney',  label: 'A-SHARE ·  EASTMONEY (东财)', group: 'A-SHARE' },
  { value: 'stock-tencent',    label: 'A-SHARE ·  TENCENT  (腾讯)',  group: 'A-SHARE' },
  { value: 'stock-sina',       label: 'A-SHARE ·  SINA     (新浪)',  group: 'A-SHARE' },
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
  ) => {
    // Derive the combined dropdown value from the two separate state pieces.
    const dataSource: DataSource =
      marketMode === 'CRYPTO' ? 'crypto-binance' : (`stock-${stockAdapterId}` as DataSource);

    const handleDataSourceChange = useCallback(
      (ds: DataSource) => {
        if (ds === 'crypto-binance') {
          setMarketMode('CRYPTO');
        } else {
          setMarketMode('CN_STOCK');
          setStockAdapter(ds.replace('stock-', ''));
        }
      },
      [setMarketMode, setStockAdapter],
    );

    const current = DATA_SOURCE_OPTIONS.find((o) => o.value === dataSource);

    return (
      <div className="h-8 bg-terminal-bg border-b border-terminal-border flex items-center px-2 gap-1 shrink-0 min-w-0">
        {/* Command input */}
        <div className="text-terminal-accent font-bold text-xs select-none shrink-0">CMD:</div>
        <div className="w-44 shrink-0">
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

        {/* ── Data source dropdown ─────────────────────────────────────── */}
        <div className="relative shrink-0">
          <div className="flex items-center">
            <span className="text-[9px] font-mono text-gray-500 mr-1 select-none">SRC:</span>
            <div className="relative">
              <select
                value={dataSource}
                onChange={(e) => handleDataSourceChange(e.target.value as DataSource)}
                className={[
                  'appearance-none bg-[#141414] border text-[10px] font-mono font-bold',
                  'pl-2 pr-6 py-0.5 cursor-pointer focus:outline-none',
                  'transition-colors hover:border-terminal-accent',
                  marketMode === 'CRYPTO'
                    ? 'text-blue-400 border-blue-900/60'
                    : 'text-red-400 border-red-900/60',
                ].join(' ')}
                title="Select data source"
              >
                {DATA_SOURCE_OPTIONS.map((opt) => (
                  <option key={opt.value} value={opt.value}>
                    {opt.label}
                  </option>
                ))}
              </select>
              {/* Custom chevron overlay */}
              <ChevronDown
                size={9}
                className={[
                  'pointer-events-none absolute right-1.5 top-1/2 -translate-y-1/2',
                  marketMode === 'CRYPTO' ? 'text-blue-500' : 'text-red-500',
                ].join(' ')}
              />
            </div>
          </div>
        </div>

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
    );
  },
);

CommandBar.displayName = 'CommandBar';
