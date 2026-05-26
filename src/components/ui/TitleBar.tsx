import React, { useState, useEffect, useRef, useCallback } from 'react';
import { Minus, Square, X, RefreshCw } from 'lucide-react';
import type { ResourceKey } from '../../constants/resources';
import logoImg from '../../../public/logo.png';

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

const buildMenus = (t: (key: ResourceKey) => string): MenuDef[] => {
  const e = window.electron;
  return [
    {
      label: t('MENU_FILE'),
      items: [
        { label: t('MENU_RELOAD'), shortcut: 'Ctrl+R', action: () => e?.reload() },
        { label: t('MENU_FORCE_RELOAD'), shortcut: 'Ctrl+Shift+R', action: () => e?.forceReload() },
        { label: '', separator: true },
        { label: t('MENU_EXIT'), shortcut: 'Alt+F4', action: () => e?.windowClose() },
      ],
    },
    {
      label: t('MENU_VIEW'),
      items: [
        { label: t('MENU_TOGGLE_FULLSCREEN'), shortcut: 'F11', action: () => e?.toggleFullscreen() },
        { label: '', separator: true },
        { label: t('MENU_ZOOM_IN'), shortcut: 'Ctrl++', action: () => e?.zoomIn() },
        { label: t('MENU_ZOOM_OUT'), shortcut: 'Ctrl+-', action: () => e?.zoomOut() },
        { label: t('MENU_RESET_ZOOM'), shortcut: 'Ctrl+0', action: () => e?.zoomReset() },
        { label: '', separator: true },
        { label: t('MENU_TOGGLE_DEVTOOLS'), shortcut: 'Ctrl+Shift+I', action: () => e?.openDevTools() },
      ],
    },
    {
      label: t('MENU_HELP'),
      items: [
        { label: t('MENU_CHECK_UPDATES'), action: () => e?.checkForUpdates() },
        { label: '', separator: true },
        { label: t('MENU_DOCUMENTATION'), action: () => e?.openExternal('https://github.com/lengjing/quantcore-pro') },
        { label: t('MENU_REPORT_ISSUE'), action: () => e?.openExternal('https://github.com/lengjing/quantcore-pro/issues') },
        { label: '', separator: true },
        { label: t('MENU_ABOUT'), action: () => {
          e?.showAbout();
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
          'px-2 h-full text-[12px] font-sans transition-colors leading-[30px]',
          isOpen
            ? 'bg-[#2d2d2d] text-white'
            : 'text-[#cccccc] hover:bg-[#2d2d2d] hover:text-white',
        ].join(' ')}
      >
        {menu.label}
      </button>

      {isOpen && (
        <div className="absolute top-full left-0 min-w-0 w-max bg-[#252526] border border-[#454545] shadow-[0_2px_8px_rgba(0,0,0,0.5)] z-[9999] py-1 rounded-[3px]">
          {menu.items.map((item, i) =>
            item.separator ? (
              <div key={i} className="h-px bg-[#454545] my-1" />
            ) : (
              <button
                key={i}
                onClick={() => {
                  item.action?.();
                  onClose();
                }}
                disabled={item.disabled}
                className="w-full text-left px-3 py-[3px] text-[12px] text-[#cccccc] hover:bg-[#094771] hover:text-white flex items-center justify-between gap-8 disabled:opacity-40 disabled:cursor-not-allowed whitespace-nowrap"
              >
                <span>{item.label}</span>
                {item.shortcut && (
                  <span className="text-[11px] text-[#888] ml-4">{item.shortcut}</span>
                )}
              </button>
            ),
          )}
        </div>
      )}
    </div>
  );
};

/* ── Update Status Banner ───────────────────────────────────────────────── */

type UpdateStatus = 'idle' | 'checking' | 'available' | 'not-available' | 'downloading' | 'downloaded' | 'error';

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
  const [updateStatus, setUpdateStatus] = useState<UpdateStatus>('idle');
  const [dismissedUpdate, setDismissedUpdate] = useState(false);
  const statusTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Listen for update status events from Electron main process
  useEffect(() => {
    if (!isElectronEnv) return;
    window.electron?.onUpdateStatus((data) => {
      const status = data.status as UpdateStatus;
      setUpdateStatus(status);

      // Auto-dismiss transient statuses after a delay
      if (statusTimerRef.current) clearTimeout(statusTimerRef.current);
      if (status === 'not-available' || status === 'error') {
        statusTimerRef.current = setTimeout(() => setUpdateStatus('idle'), 5000);
      }
      // When a new update is downloaded, make sure the banner is visible
      if (status === 'downloaded') {
        setDismissedUpdate(false);
      }
    });
  }, []);

  if (!isElectronEnv) return null;

  const menus = buildMenus(t);

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

  // Build update status message
  const getUpdateBanner = (): { text: string; showRestart: boolean } | null => {
    if (dismissedUpdate && updateStatus === 'downloaded') return null;
    switch (updateStatus) {
      case 'checking': return { text: t('UPDATE_CHECKING'), showRestart: false };
      case 'available': return { text: t('UPDATE_AVAILABLE'), showRestart: false };
      case 'not-available': return { text: t('UPDATE_NOT_AVAILABLE'), showRestart: false };
      case 'downloading': return { text: t('UPDATE_DOWNLOADING'), showRestart: false };
      case 'downloaded': return { text: t('UPDATE_READY'), showRestart: true };
      case 'error': return { text: t('UPDATE_ERROR'), showRestart: false };
      default: return null;
    }
  };

  const banner = getUpdateBanner();

  return (
    <div className="shrink-0">
      <div
        className="h-[30px] flex items-center justify-between bg-[#3c3c3c] select-none"
        style={{ WebkitAppRegion: 'drag' } as React.CSSProperties}
      >
        {/* Left — logo + menus */}
        <div
          ref={barRef}
          className="flex items-center h-full"
          style={{ WebkitAppRegion: 'no-drag' } as React.CSSProperties}
        >
          <div className="flex items-center justify-center w-[35px] h-full">
            <img src={logoImg} alt="logo" className="w-4 h-4" />
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
          <span className="text-[11px] font-sans text-[#cccccc]">
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
            className="w-[46px] h-full flex items-center justify-center text-[#cccccc] hover:bg-[#505050] transition-colors"
            aria-label="Minimize"
          >
            <Minus size={14} />
          </button>
          <button
            onClick={handleMaximize}
            className="w-[46px] h-full flex items-center justify-center text-[#cccccc] hover:bg-[#505050] transition-colors"
            aria-label="Maximize"
          >
            <Square size={10} />
          </button>
          <button
            onClick={handleClose}
            className="w-[46px] h-full flex items-center justify-center text-[#cccccc] hover:bg-[#e81123] transition-colors"
            aria-label="Close"
          >
            <X size={14} />
          </button>
        </div>
      </div>

      {/* Update status banner (VSCode-style) */}
      {banner && (
        <div className="h-6 bg-[#007acc] flex items-center justify-center gap-3 text-white text-[11px] select-none shrink-0">
          {updateStatus === 'checking' || updateStatus === 'downloading' ? (
            <RefreshCw size={12} className="animate-spin" />
          ) : null}
          <span>{banner.text}</span>
          {banner.showRestart && (
            <button
              onClick={() => {
                window.electron?.restartToUpdate();
              }}
              className="px-2 py-0.5 bg-white text-[#007acc] text-[10px] font-bold rounded hover:bg-gray-100 transition-colors"
            >
              {t('UPDATE_RESTART')}
            </button>
          )}
          {(updateStatus === 'not-available' || updateStatus === 'error' || updateStatus === 'downloaded') && (
            <button
              onClick={() => {
                if (updateStatus === 'downloaded') {
                  setDismissedUpdate(true);
                } else {
                  setUpdateStatus('idle');
                }
              }}
              className="text-white/80 hover:text-white ml-1"
            >
              <X size={12} />
            </button>
          )}
        </div>
      )}
    </div>
  );
};
