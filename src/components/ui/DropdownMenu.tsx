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

  const closeAll = useCallback(() => {
    setOpenIdx(null);
    setAnyOpened(false);
  }, []);

  useEffect(() => {
    if (openIdx === null) return;
    const handleClick = (e: MouseEvent) => {
      if (barRef.current && !barRef.current.contains(e.target as Node)) {
        closeAll();
      }
    };
    document.addEventListener('mousedown', handleClick);
    return () => document.removeEventListener('mousedown', handleClick);
  }, [openIdx, closeAll]);

  return (
    <div ref={barRef} className="flex items-center h-full">
      {menus.map((menu, i) => (
        <DropdownMenu
          key={menu.label}
          menu={menu}
          isOpen={openIdx === i}
          onOpen={() => {
            setOpenIdx(i);
            setAnyOpened(true);
          }}
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
