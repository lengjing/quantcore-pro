import React, { useState, useCallback } from 'react';
import { MoreVertical, Maximize2, Minimize2, RefreshCcw, Loader } from 'lucide-react';
import type { ResourceKey } from '../../constants/resources';

interface PanelProps {
  title: string;
  children?: React.ReactNode;
  className?: string;
  tools?: React.ReactNode;
  onRefresh?: () => void;
  onScroll?: (e: React.UIEvent<HTMLDivElement>) => void;
  t?: (key: ResourceKey) => string;
}

export const Panel = ({ title, children, className = '', tools, onRefresh, onScroll, t }: PanelProps) => {
  const [isMenuOpen, setIsMenuOpen] = useState(false);
  const [isMaximized, setIsMaximized] = useState(false);
  const [isRefreshing, setIsRefreshing] = useState(false);

  const handleRefresh = useCallback(async () => {
    if (!onRefresh || isRefreshing) return;
    setIsRefreshing(true);
    try {
      await Promise.resolve(onRefresh());
      // Keep spinner visible briefly so user sees the feedback
      await new Promise((r) => setTimeout(r, 600));
    } finally {
      setIsRefreshing(false);
    }
  }, [onRefresh, isRefreshing]);

  const label = (en: string, key?: ResourceKey) => (t && key ? t(key) : en);

  const containerClass = isMaximized
    ? 'fixed inset-2 z-40 bg-terminal-bg border border-terminal-accent'
    : `flex flex-col bg-terminal-panel border border-terminal-border relative group ${className}`;

  return (
    <div className={containerClass}>
      <div className="flex items-center justify-between px-2 py-1 bg-[#1a1a1a] border-b border-terminal-border select-none shrink-0 h-7">
        <div className="flex items-center space-x-2">
          <div className={`w-1 h-3 ${isMaximized ? 'bg-terminal-success' : 'bg-terminal-accent'}`}></div>
          <span className="text-[10px] font-bold tracking-wider text-gray-300 uppercase truncate">{title}</span>
          {isRefreshing && <Loader size={10} className="animate-spin text-terminal-accent" />}
        </div>
        <div className="flex items-center space-x-2 text-gray-500">
          {tools}
          <div className="relative">
            <MoreVertical
              size={12}
              className="cursor-pointer hover:text-white"
              onClick={() => setIsMenuOpen(!isMenuOpen)}
            />
            {isMenuOpen && (
              <div className="absolute right-0 top-4 w-32 bg-[#222] border border-terminal-border shadow-xl z-50 py-1">
                <div
                  className="px-3 py-1 text-[10px] text-gray-400 hover:bg-terminal-accent hover:text-black cursor-pointer flex items-center gap-2"
                  onClick={() => { setIsMaximized(!isMaximized); setIsMenuOpen(false); }}
                >
                  {isMaximized ? <Minimize2 size={10} /> : <Maximize2 size={10} />}
                  {label(isMaximized ? 'RESTORE' : 'MAXIMIZE', isMaximized ? 'RESTORE' : 'MAXIMIZE')}
                </div>
                <div
                  className={`px-3 py-1 text-[10px] text-gray-400 hover:bg-terminal-accent hover:text-black cursor-pointer flex items-center gap-2 ${isRefreshing ? 'opacity-50 pointer-events-none' : ''}`}
                  onClick={() => { handleRefresh(); setIsMenuOpen(false); }}
                >
                  {isRefreshing ? <Loader size={10} className="animate-spin" /> : <RefreshCcw size={10} />}
                  {isRefreshing ? label('REFRESHING…', 'REFRESHING') : label('REFRESH', 'BTN_REFRESH')}
                </div>
                <div className="h-px bg-[#333] my-1"></div>
                <div className="px-3 py-1 text-[10px] text-terminal-error hover:bg-red-900/50 cursor-pointer">
                  {label('CLOSE PANEL', 'CLOSE_PANEL')}
                </div>
              </div>
            )}
            {isMenuOpen && <div className="fixed inset-0 z-40" onClick={() => setIsMenuOpen(false)}></div>}
          </div>
        </div>
      </div>
      <div className="flex-1 relative overflow-hidden flex flex-col" onScroll={onScroll}>
        {children}
      </div>
    </div>
  );
};
