import React, { useRef, useEffect, useState, useCallback } from 'react';

/* ── Types ──────────────────────────────────────────────────────────────── */

export interface MenuAction {
  label: string;
  shortcut?: string;
  action?: () => void;
  separator?: boolean;
  disabled?: boolean;
}

export interface MenuDef {
  label: string;
  items: MenuAction[];
}

/* ── Single Dropdown ───────────────────────────────────────────────────── */

interface DropdownMenuProps {
  menu: MenuDef;
  isOpen: boolean;
  onOpen: () => void;
  onClose: () => void;
  onHover: () => void;
}

export const DropdownMenu = ({ menu, isOpen, onOpen, onClose, onHover }: DropdownMenuProps) => {
  const ref = useRef<HTMLDivElement>(null);

  return (
    <div ref={ref} className="relative">
      <button
        onClick={() => (isOpen ? onClose() : onOpen())}
        onMouseEnter={onHover}
        className={[
          'px-2.5 h-full text-[12px] font-mono tracking-wide transition-colors leading-7.5 border-b border-transparent',
          isOpen
            ? 'bg-[#17120a] text-terminal-accent border-terminal-accent'
            : 'text-[#cfcfcf] hover:bg-[#17120a] hover:text-terminal-accent hover:border-terminal-accent/60',
        ].join(' ')}
      >
        {menu.label}
      </button>

      {isOpen && (
        <div className="absolute top-full left-0 min-w-0 w-max bg-[#090909] border border-[#2e2e2e] shadow-[0_14px_30px_rgba(0,0,0,0.68)] z-9999 py-1 rounded-[3px]">
          {menu.items.map((item, i) =>
            item.separator ? (
              <div key={i} className="h-px bg-[#2a2a2a] my-1" />
            ) : (
              <button
                key={i}
                onClick={() => {
                  item.action?.();
                  onClose();
                }}
                disabled={item.disabled}
                className="w-full text-left px-3.5 py-1 text-[12px] font-mono text-[#d0d0d0] hover:bg-terminal-accent/15 hover:text-terminal-accent focus:bg-terminal-accent/15 focus:text-terminal-accent border-l-2 border-transparent hover:border-terminal-accent focus:border-terminal-accent flex items-center justify-between gap-8 disabled:opacity-40 disabled:cursor-not-allowed whitespace-nowrap transition-colors"
              >
                <span>{item.label}</span>
                {item.shortcut && (
                  <span className="text-[10px] text-[#8a8a8a] ml-4">{item.shortcut}</span>
                )}
              </button>
            ),
          )}
        </div>
      )}
    </div>
  );
};

/* ── Menu Bar (manages open state for a set of dropdowns) ──────────────── */

interface MenuBarProps {
  menus: MenuDef[];
}

/**
 * A horizontal menu bar that renders multiple DropdownMenu items.
 * Handles open/close state, hover-to-switch behavior, and outside-click dismissal.
 */
export const MenuBar = ({ menus }: MenuBarProps) => {
  const [openIdx, setOpenIdx] = useState<number | null>(null);
  const [anyOpened, setAnyOpened] = useState(false);
  const barRef = useRef<HTMLDivElement>(null);
  const closedByOutsideRef = useRef(false);

  const closeAll = useCallback(() => {
    setOpenIdx(null);
    setAnyOpened(false);
  }, []);

  useEffect(() => {
    if (openIdx === null) return;
    const handleMouseDown = (e: MouseEvent) => {
      if (barRef.current && !barRef.current.contains(e.target as Node)) {
        closedByOutsideRef.current = true;
        closeAll();
      }
    };
    document.addEventListener('mousedown', handleMouseDown);
    return () => document.removeEventListener('mousedown', handleMouseDown);
  }, [openIdx, closeAll]);

  const handleOpen = useCallback((idx: number) => {
    // If just closed by outside click, skip reopening
    if (closedByOutsideRef.current) {
      closedByOutsideRef.current = false;
      return;
    }
    setOpenIdx(idx);
    setAnyOpened(true);
  }, []);

  return (
    <div ref={barRef} className="flex items-center h-full">
      {menus.map((menu, i) => (
        <DropdownMenu
          key={menu.label}
          menu={menu}
          isOpen={openIdx === i}
          onOpen={() => handleOpen(i)}
          onClose={closeAll}
          onHover={() => {
            if (anyOpened && openIdx !== null) {
              setOpenIdx(i);
            }
          }}
        />
      ))}
    </div>
  );
};
