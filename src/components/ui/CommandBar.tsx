import React, { useState, useEffect, forwardRef } from 'react';
import { Wifi } from 'lucide-react';
import type { MarketMode } from '../../types';

interface CommandBarProps {
  value: string;
  onChange: (v: string) => void;
  onSubmit: () => void;
  onHelp: () => void;
  onMenu: () => void;
  marketMode: MarketMode;
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
  ({ value, onChange, onSubmit, onHelp, onMenu, marketMode }, ref) => (
    <div className="h-8 bg-terminal-bg border-b border-terminal-border flex items-center px-2 space-x-2 shrink-0">
      <div className="text-terminal-accent font-bold text-xs select-none">CMD:</div>
      <div className="flex-1 relative">
        <input
          ref={ref}
          type="text"
          value={value}
          onChange={(e) => onChange(e.target.value)}
          onKeyDown={(e) => e.key === 'Enter' && onSubmit()}
          className="w-full bg-transparent border-none text-xs text-white font-mono focus:outline-none uppercase placeholder-gray-700"
          placeholder="ENTER COMMAND (e.g., 'BUY BTC', 'ADD ETH')..."
          autoFocus
          spellCheck={false}
        />
      </div>
      <div className="h-4 w-px bg-terminal-border mx-2"></div>
      <div className="flex items-center space-x-3 text-[10px] font-mono text-gray-400">
        <span className="text-gray-600">FEED:</span>
        <span className={`font-bold ${marketMode === 'CRYPTO' ? 'text-blue-400' : 'text-red-400'}`}>
          {marketMode === 'CRYPTO' ? 'BINANCE WSS' : 'TENCENT API'}
        </span>
      </div>
      <div className="h-4 w-px bg-terminal-border mx-2"></div>
      <div className="flex items-center space-x-2">
        <button onClick={onHelp} className="text-[10px] text-black bg-terminal-accent px-2 py-0.5 font-bold hover:bg-yellow-500">HELP</button>
        <button onClick={onMenu} className="text-[10px] text-black bg-gray-400 px-2 py-0.5 font-bold hover:bg-gray-300">MENU</button>
      </div>
      <div className="h-4 w-px bg-terminal-border mx-2"></div>
      <div className="flex items-center space-x-3 text-[10px] font-mono text-gray-400">
        <span className="flex items-center text-terminal-success"><Wifi size={10} className="mr-1" /> CNNCTD</span>
        <Clock />
      </div>
    </div>
  ),
);

CommandBar.displayName = 'CommandBar';
