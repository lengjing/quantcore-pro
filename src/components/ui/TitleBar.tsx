import React from 'react';
import { Minus, Square, X, Maximize2 } from 'lucide-react';
import type { ResourceKey } from '../../constants/resources';

interface TitleBarProps {
  t: (key: ResourceKey) => string;
}

/**
 * Custom titlebar component for Electron (replaces the default frame).
 *
 * Uses `-webkit-app-region: drag` so the bar itself acts as the
 * window drag handle, while the control buttons are marked `no-drag`.
 *
 * When running in a regular browser (no `window.electron`), the
 * component renders nothing.
 */
export const TitleBar = ({ t }: TitleBarProps) => {
  const isElectron = typeof window !== 'undefined' && !!window.electron;

  if (!isElectron) return null;

  const handleMinimize = () => window.electron?.windowMinimize();
  const handleMaximize = () => window.electron?.windowMaximize();
  const handleClose = () => window.electron?.windowClose();

  return (
    <div
      className="h-8 flex items-center justify-between bg-[#0a0a0a] border-b border-terminal-border select-none shrink-0"
      style={{ WebkitAppRegion: 'drag' } as React.CSSProperties}
    >
      {/* Left — logo + title */}
      <div className="flex items-center gap-2 pl-3">
        <img src="/logo.png" alt="logo" className="w-4 h-4" />
        <span className="text-[10px] font-mono font-bold text-gray-400 tracking-widest uppercase">
          {t('TITLEBAR_TITLE')}
        </span>
      </div>

      {/* Right — window controls */}
      <div
        className="flex items-center h-full"
        style={{ WebkitAppRegion: 'no-drag' } as React.CSSProperties}
      >
        <button
          onClick={handleMinimize}
          className="h-full px-3 text-gray-500 hover:text-white hover:bg-[#333] transition-colors"
          aria-label="Minimize"
        >
          <Minus size={12} />
        </button>
        <button
          onClick={handleMaximize}
          className="h-full px-3 text-gray-500 hover:text-white hover:bg-[#333] transition-colors"
          aria-label="Maximize"
        >
          <Square size={10} />
        </button>
        <button
          onClick={handleClose}
          className="h-full px-3 text-gray-500 hover:text-white hover:bg-red-700 transition-colors"
          aria-label="Close"
        >
          <X size={12} />
        </button>
      </div>
    </div>
  );
};
