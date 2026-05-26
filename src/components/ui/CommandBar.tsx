import React, { useState, useEffect, forwardRef } from 'react';
import { useTranslation } from 'react-i18next';
import { Wifi, WifiOff, AlertTriangle, ChevronDown, Loader2 } from 'lucide-react';
import type { MarketMode, TradingMode } from '../../types';
import type { ConnectionStatus } from '../../hooks/useMarketData';

/**
 * Market mode options for the market selector.
 */
const MARKET_OPTIONS: { value: MarketMode; labelKey: string }[] = [
  { value: 'CRYPTO', labelKey: 'MARKET_CRYPTO' },
  { value: 'CN_STOCK', labelKey: 'MARKET_ASTOCK' },
];

interface CommandBarProps {
  value: string;
  onChange: (v: string) => void;
  onSubmit: () => void;
  onHelp: () => void;
  onMenu: () => void;
  marketMode: MarketMode;
  setMarketMode: (mode: MarketMode) => void;
  tradingMode: TradingMode;
  setTradingMode: (mode: TradingMode) => void;
  connectionStatus: ConnectionStatus;
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
      tradingMode,
      setTradingMode,
      connectionStatus,
    },
    ref,
  ) => {
    const { t } = useTranslation();

    return (
      <div className="h-8 bg-terminal-bg border-b border-terminal-border flex items-center px-2 gap-1 shrink-0 min-w-0">
        {/* Command input */}
        <div className="text-terminal-accent font-bold text-xs select-none shrink-0">{t('CMD_LABEL')}</div>
        <div className="w-44 shrink-0">
          <input
            ref={ref}
            type="text"
            value={value}
            onChange={(e) => onChange(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && onSubmit()}
            className="w-full bg-transparent border-none text-xs text-white font-mono focus:outline-none uppercase placeholder-gray-700"
            placeholder={t('CMD_PLACEHOLDER')}
            autoFocus
            spellCheck={false}
          />
        </div>

        <div className="h-4 w-px bg-terminal-border mx-1 shrink-0" />

        {/* ── Market selector ──────────────────────────────────────────── */}
        <div className="relative shrink-0">
          <div className="relative">
            <select
              value={marketMode}
              onChange={(e) => setMarketMode(e.target.value as MarketMode)}
              className={[
                'appearance-none bg-[#141414] border text-[10px] font-mono font-bold',
                'pl-2 pr-6 py-0.5 cursor-pointer focus:outline-none',
                'transition-colors hover:border-terminal-accent',
                marketMode === 'CRYPTO'
                  ? 'text-blue-400 border-blue-900/60'
                  : 'text-red-400 border-red-900/60',
              ].join(' ')}
              title="Select market"
            >
              {MARKET_OPTIONS.map((opt) => (
                <option key={opt.value} value={opt.value}>
                  {t(opt.labelKey)}
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

        <div className="h-4 w-px bg-terminal-border mx-1 shrink-0" />

        {/* Trading mode */}
        {tradingMode === 'LIVE' ? (
          <button
            onClick={() => setTradingMode('PAPER')}
            className="flex items-center gap-1 px-2 py-0.5 text-[9px] font-mono font-bold uppercase tracking-wider text-red-400 border border-red-700 bg-red-950/40 hover:bg-red-900/60 animate-pulse rounded-sm"
            title={t('LIVE_SWITCH_HINT')}
          >
            <AlertTriangle size={8} />
            {t('LIVE')}
          </button>
        ) : (
          <button
            onClick={() => setTradingMode('LIVE')}
            className="flex items-center gap-1 px-2 py-0.5 text-[9px] font-mono font-bold uppercase tracking-wider text-gray-400 border border-[#333] bg-[#181818] hover:border-red-700 hover:text-red-400 rounded-sm"
            title={t('PAPER_SWITCH_HINT')}
          >
            {t('PAPER')}
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
            {t('HELP')}
          </button>
          <button
            onClick={onMenu}
            className="text-[10px] text-black bg-gray-400 px-2 py-0.5 font-bold hover:bg-gray-300"
          >
            {t('MENU')}
          </button>
        </div>

        <div className="h-4 w-px bg-terminal-border mx-1 shrink-0" />

        {/* Connection status + clock */}
        <div className="flex items-center gap-3 text-[10px] font-mono text-gray-400 shrink-0">
          {connectionStatus === 'connected' && (
            <span className="flex items-center text-terminal-success">
              <Wifi size={10} className="mr-1" /> {t('CONNECTED')}
            </span>
          )}
          {connectionStatus === 'connecting' && (
            <span className="flex items-center text-yellow-400">
              <Loader2 size={10} className="mr-1 animate-spin" /> {t('CONNECTING')}
            </span>
          )}
          {connectionStatus === 'disconnected' && (
            <span className="flex items-center text-terminal-error">
              <WifiOff size={10} className="mr-1" /> {t('DISCONNECTED')}
            </span>
          )}
          <Clock />
        </div>
      </div>
    );
  },
);

CommandBar.displayName = 'CommandBar';
