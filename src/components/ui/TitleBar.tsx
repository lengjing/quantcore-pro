import React, { useState, useEffect, useRef, useCallback } from 'react';
import { useTranslation } from 'react-i18next';
import { Minus, Square, X } from 'lucide-react';
import logoImg from '../../../public/logo.png';

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

const buildMenus = (t: (key: string) => string): MenuDef[] => {
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
        } },
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

export const TitleBar = () => {
  const { t } = useTranslation();
  const [openMenuIdx, setOpenMenuIdx] = useState<number | null>(null);
  const [anyMenuOpened, setAnyMenuOpened] = useState(false);
  const barRef = useRef<HTMLDivElement>(null);

  if (!isElectronEnv) return null;

  const menus = buildMenus(t);

  const handleMinimize = () => window.electron?.windowMinimize();
  const handleMaximize = () => window.electron?.windowMaximize();
  const handleClose = () => window.electron?.windowClose();

  const closeMenus = useCallback(() => {
    setOpenMenuIdx(null);
    setAnyMenuOpened(false);
  }, []);

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
    <div className="shrink-0">
      <div
        className="h-[30px] flex items-center justify-between bg-[#3c3c3c] select-none"
        style={{ WebkitAppRegion: 'drag' } as React.CSSProperties}
      >
        <div
          ref={barRef}
          className="flex items-center h-full"
          style={{ WebkitAppRegion: 'no-drag' } as React.CSSProperties}
        >
          <div className="flex items-center justify-center w-[35px] h-full">
            <img src={logoImg} alt="logo" className="w-4 h-4" />
          </div>

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

        <div className="absolute left-1/2 -translate-x-1/2 pointer-events-none">
          <span className="text-[11px] font-sans text-[#cccccc]">
            {t('TITLEBAR_TITLE')}
          </span>
        </div>

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
    </div>
  );
};
