import React from 'react';

export interface ButtonGroupOption<T extends string> {
  value: T;
  label: string;
  icon?: React.ReactNode;
  /** Tailwind bg class applied when this option is active, e.g. 'bg-blue-600' */
  activeClass?: string;
}

interface ButtonGroupProps<T extends string> {
  options: ButtonGroupOption<T>[];
  value: T;
  onChange: (value: T) => void;
  /** 'accent' uses terminal amber; 'default' inherits activeClass per option */
  variant?: 'accent' | 'default';
  size?: 'xs' | 'sm';
}

/**
 * Reusable segmented button group (pill-style).
 * Used for: CRYPTO/STOCK market mode, GAINERS/LOSERS/VOLUME sort, EN/CN lang, etc.
 */
export function ButtonGroup<T extends string>({
  options,
  value,
  onChange,
  variant = 'default',
  size = 'xs',
}: ButtonGroupProps<T>) {
  const px = size === 'xs' ? 'px-2 py-0.5' : 'px-3 py-1';
  const text = size === 'xs' ? 'text-[9px]' : 'text-xs';

  return (
    <div className="flex bg-[#222] rounded p-0.5 gap-px">
      {options.map((opt) => {
        const isActive = opt.value === value;
        const activeClass =
          variant === 'accent'
            ? 'bg-terminal-accent text-black font-bold'
            : opt.activeClass
            ? `${opt.activeClass} text-white font-bold`
            : 'bg-[#444] text-white font-bold';

        return (
          <button
            key={opt.value}
            onClick={() => onChange(opt.value)}
            className={`${px} ${text} rounded-sm transition-colors flex items-center gap-1 ${
              isActive ? activeClass : 'text-gray-400 hover:text-gray-200'
            }`}
          >
            {opt.icon}
            {opt.label}
          </button>
        );
      })}
    </div>
  );
}
