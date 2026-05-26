import React from 'react';
import { useTranslation } from 'react-i18next';
import { Minus, Square, X } from 'lucide-react';
import logoImg from '../../../public/logo.png';
import { MenuBar } from './DropdownMenu';
import type { MenuDef } from './DropdownMenu';

/* ── Helpers ────────────────────────────────────────────────────────────── */

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
        { label: t('MENU_ABOUT'), action: () => { e?.showAbout(); } },
      ],
    },
  ];
};

/* ── TitleBar ──────────────────────────────────────────────────────────── */

export const TitleBar = () => {
  const { t } = useTranslation();

  if (!isElectronEnv) return null;

  const menus = buildMenus(t);

  const handleMinimize = () => window.electron?.windowMinimize();
  const handleMaximize = () => window.electron?.windowMaximize();
  const handleClose = () => window.electron?.windowClose();

  return (
    <div className="shrink-0">
      <div
        className="h-[30px] flex items-center justify-between bg-[#3c3c3c] select-none"
        style={{ WebkitAppRegion: 'drag' } as React.CSSProperties}
      >
        <div
          className="flex items-center h-full"
          style={{ WebkitAppRegion: 'no-drag' } as React.CSSProperties}
        >
          <div className="flex items-center justify-center w-[35px] h-full">
            <img src={logoImg} alt="logo" className="w-4 h-4" />
          </div>

          <MenuBar menus={menus} />
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
