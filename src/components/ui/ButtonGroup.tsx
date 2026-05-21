import React from 'react';

export interface ButtonGroupOption<T extends string> {
  value: T;
  label: string;
  icon?: React.ReactNode;
  /**
   * Tailwind text-color class for the active state, e.g. 'text-blue-400'.
   * Falls back to terminal-accent when omitted.
   */
  activeColor?: string;
}

interface ButtonGroupProps<T extends string> {
  options: ButtonGroupOption<T>[];
  value: T;
  onChange: (value: T) => void;
  /**
   * 'pill'  — filled rounded pill (default, used for market-mode toggles)
   * 'tab'   — flat underline-style tabs (used for timeframes, sort buttons)
   * 'ghost' — minimal, only text color changes (used in dense panel headers)
   */
  variant?: 'pill' | 'tab' | 'ghost';
  size?: 'xs' | 'sm';
}

/**
 * Unified segmented button group.
 *
 * variant="pill"  → dark capsule with filled active highlight (market mode, language)
 * variant="tab"   → transparent tabs with amber bottom-border indicator (timeframes, sorts)
 * variant="ghost" → no wrapper, colored text only (space-tight contexts)
 */
export function ButtonGroup<T extends string>({
  options,
  value,
  onChange,
  variant = 'pill',
  size = 'xs',
}: ButtonGroupProps<T>) {
  const px = size === 'xs' ? 'px-2 py-0.5' : 'px-3 py-1';
  const text = size === 'xs' ? 'text-[9px]' : 'text-[11px]';
  const tracking = 'tracking-wider uppercase';

  if (variant === 'tab') {
    return (
      <div className="flex items-end gap-px">
        {options.map((opt) => {
          const isActive = opt.value === value;
          const color = opt.activeColor ?? 'text-terminal-accent';
          return (
            <button
              key={opt.value}
              onClick={() => onChange(opt.value)}
              className={[
                px, text, tracking,
                'font-mono font-bold transition-colors border-b-2 flex items-center gap-1 pb-0.5',
                isActive
                  ? `${color} border-current`
                  : 'text-gray-500 border-transparent hover:text-gray-300',
              ].join(' ')}
            >
              {opt.icon}
              {opt.label}
            </button>
          );
        })}
      </div>
    );
  }

  if (variant === 'ghost') {
    return (
      <div className="flex items-center gap-3">
        {options.map((opt) => {
          const isActive = opt.value === value;
          const color = opt.activeColor ?? 'text-terminal-accent';
          return (
            <button
              key={opt.value}
              onClick={() => onChange(opt.value)}
              className={[
                px, text, tracking,
                'font-mono font-bold transition-colors flex items-center gap-1',
                isActive ? color : 'text-gray-500 hover:text-gray-300',
              ].join(' ')}
            >
              {opt.icon}
              {opt.label}
            </button>
          );
        })}
      </div>
    );
  }

  // variant === 'pill' (default)
  return (
    <div className="flex bg-[#181818] border border-[#333] rounded-sm p-px gap-px">
      {options.map((opt) => {
        const isActive = opt.value === value;
        const color = opt.activeColor ?? 'text-terminal-accent';
        return (
          <button
            key={opt.value}
            onClick={() => onChange(opt.value)}
            className={[
              px, text, tracking,
              'rounded-sm font-mono font-bold transition-all flex items-center gap-1',
              isActive
                ? `bg-[#2a2a2a] ${color} border border-[#444] shadow-sm`
                : 'text-gray-500 border border-transparent hover:text-gray-300',
            ].join(' ')}
          >
            {opt.icon}
            {opt.label}
          </button>
        );
      })}
    </div>
  );
}
