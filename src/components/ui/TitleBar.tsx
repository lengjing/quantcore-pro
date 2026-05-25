import React, { useState, useEffect, useRef, useCallback } from 'react';
import { Minus, Square, X, ChevronDown } from 'lucide-react';
import type { ResourceKey } from '../../constants/resources';

interface TitleBarProps {
  t: (key: ResourceKey) => string;
}

/* ── Menu Data Structure ────────────────────────────────────────────────── */

interface MenuAction {
  label: string;
  shortcut?: string;
  action?: () => void;
  separator?: boolean;
  disabled?: boolean;
}

interface MenuDef {
  label: string;
  items: MenuAction[];
}

const isElectronEnv = typeof window !== 'undefined' && !!window.electron;

const buildMenus = (): MenuDef[] => {
  const e = window.electron;
  return [
    {
      label: 'File',
      items: [
        { label: 'Reload', shortcut: 'Ctrl+R', action: () => e?.reload() },
        { label: 'Force Reload', shortcut: 'Ctrl+Shift+R', action: () => e?.forceReload() },
        { label: '', separator: true },
        { label: 'Exit', shortcut: 'Alt+F4', action: () => e?.windowClose() },
      ],
    },
    {
      label: 'View',
      items: [
        { label: 'Toggle Full Screen', shortcut: 'F11', action: () => e?.toggleFullscreen() },
        { label: '', separator: true },
        { label: 'Zoom In', shortcut: 'Ctrl++', action: () => e?.zoomIn() },
        { label: 'Zoom Out', shortcut: 'Ctrl+-', action: () => e?.zoomOut() },
        { label: 'Reset Zoom', shortcut: 'Ctrl+0', action: () => e?.zoomReset() },
        { label: '', separator: true },
        { label: 'Toggle Developer Tools', shortcut: 'Ctrl+Shift+I', action: () => e?.openDevTools() },
      ],
    },
    {
      label: 'Help',
      items: [
        { label: 'Check for Updates…', action: () => e?.checkForUpdates() },
        { label: '', separator: true },
        { label: 'Documentation', action: () => e?.openExternal('https://github.com/lengjing/quantcore-pro') },
        { label: 'Report Issue', action: () => e?.openExternal('https://github.com/lengjing/quantcore-pro/issues') },
        { label: '', separator: true },
        { label: 'About QuantCore Pro', action: () => {
          e?.getVersion().then((ver: string) => {
            alert(`QuantCore Pro v${ver}\n\nProfessional Quantitative Trading Terminal`);
          });
        }},
      ],
    },
  ];
};

/* ── Menu Dropdown Component ────────────────────────────────────────────── */

const MenuDropdown = ({
  menu,
  isOpen,
  onOpen,
  onClose,
  onHover,
}: {
  menu: MenuDef;
  isOpen: boolean;
  onOpen: () => void;
  onClose: () => void;
  onHover: () => void;
}) => {
  const ref = useRef<HTMLDivElement>(null);

  return (
    <div ref={ref} className="relative">
      <button
        onClick={() => (isOpen ? onClose() : onOpen())}
        onMouseEnter={onHover}
        className={[
          'px-2.5 py-1 text-[11px] font-sans transition-colors',
          isOpen
            ? 'bg-[#333] text-white'
            : 'text-gray-400 hover:text-white hover:bg-[#222]',
        ].join(' ')}
      >
        {menu.label}
      </button>

      {isOpen && (
        <div className="absolute top-full left-0 mt-px min-w-[220px] bg-[#1e1e1e] border border-[#444] shadow-xl z-[9999] py-1">
          {menu.items.map((item, i) =>
            item.separator ? (
              <div key={i} className="h-px bg-[#444] my-1 mx-2" />
            ) : (
              <button
                key={i}
                onClick={() => {
                  item.action?.();
                  onClose();
                }}
                disabled={item.disabled}
                className="w-full text-left px-3 py-1.5 text-[11px] text-gray-300 hover:bg-[#094771] hover:text-white flex justify-between items-center disabled:opacity-40 disabled:cursor-not-allowed"
              >
                <span>{item.label}</span>
                {item.shortcut && (
                  <span className="text-[10px] text-gray-500 ml-6">{item.shortcut}</span>
                )}
              </button>
            ),
          )}
        </div>
      )}
    </div>
  );
};

/**
 * Custom titlebar component for Electron (replaces the default frame).
 *
 * Includes a professional menu bar (File, View, Help) with dropdown menus,
 * auto-update integration, and window controls.
 *
 * When running in a regular browser (no `window.electron`), the
 * component renders nothing.
 */
export const TitleBar = ({ t }: TitleBarProps) => {
  const [openMenuIdx, setOpenMenuIdx] = useState<number | null>(null);
  const [anyMenuOpened, setAnyMenuOpened] = useState(false);
  const barRef = useRef<HTMLDivElement>(null);

  if (!isElectronEnv) return null;

  const menus = buildMenus();

  const handleMinimize = () => window.electron?.windowMinimize();
  const handleMaximize = () => window.electron?.windowMaximize();
  const handleClose = () => window.electron?.windowClose();

  const closeMenus = useCallback(() => {
    setOpenMenuIdx(null);
    setAnyMenuOpened(false);
  }, []);

  // Close menus on outside click
  useEffect(() => {
    const handleClick = (e: MouseEvent) => {
      if (barRef.current && !barRef.current.contains(e.target as Node)) {
        closeMenus();
      }
    };
    if (openMenuIdx !== null) {
      document.addEventListener('mousedown', handleClick);
      return () => document.removeEventListener('mousedown', handleClick);
    }
  }, [openMenuIdx, closeMenus]);

  return (
    <div
      className="h-8 flex items-center justify-between bg-[#0a0a0a] border-b border-terminal-border select-none shrink-0"
      style={{ WebkitAppRegion: 'drag' } as React.CSSProperties}
    >
      {/* Left — logo + menus */}
      <div
        ref={barRef}
        className="flex items-center h-full"
        style={{ WebkitAppRegion: 'no-drag' } as React.CSSProperties}
      >
        <div className="flex items-center gap-2 pl-3 pr-2">
          <img src="/logo.png" alt="logo" className="w-4 h-4" />
        </div>

        {/* Menu bar */}
        <div className="flex items-center h-full">
          {menus.map((menu, i) => (
            <MenuDropdown
              key={menu.label}
              menu={menu}
              isOpen={openMenuIdx === i}
              onOpen={() => {
                setOpenMenuIdx(i);
                setAnyMenuOpened(true);
              }}
              onClose={closeMenus}
              onHover={() => {
                if (anyMenuOpened && openMenuIdx !== null) {
                  setOpenMenuIdx(i);
                }
              }}
            />
          ))}
        </div>
      </div>

      {/* Center — title */}
      <div className="absolute left-1/2 -translate-x-1/2 pointer-events-none">
        <span className="text-[10px] font-mono font-bold text-gray-500 tracking-widest uppercase">
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
