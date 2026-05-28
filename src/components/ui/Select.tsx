import React, { useState, useRef, useEffect, useCallback } from 'react';

// ── Types ──────────────────────────────────────────────────────────────────────

export interface SelectOption<T extends string = string> {
  value: T;
  label: string;
  /** Optional color class applied when selected. */
  activeColor?: string;
}

interface SelectProps<T extends string = string> {
  options: SelectOption<T>[];
  value: T;
  onChange: (value: T) => void;
  /** Placeholder text when nothing is selected. */
  placeholder?: string;
  /** Additional className for the trigger button. */
  className?: string;
  /** Size variant. */
  size?: 'xs' | 'sm' | 'md';
}

// ── Component ──────────────────────────────────────────────────────────────────

/**
 * Custom select dropdown styled for the terminal UI.
 * Replaces native `<select>` with keyboard navigation, dark theme, and
 * accent-colored selection highlight.
 */
export function Select<T extends string = string>({
  options,
  value,
  onChange,
  placeholder = 'Select…',
  className = '',
  size = 'sm',
}: SelectProps<T>) {
  const [isOpen, setIsOpen] = useState(false);
  const [focusedIndex, setFocusedIndex] = useState(-1);
  const containerRef = useRef<HTMLDivElement>(null);
  const listRef = useRef<HTMLDivElement>(null);

  const selectedOption = options.find((o) => o.value === value);

  // Close on outside click
  useEffect(() => {
    if (!isOpen) return;
    const handleOutside = (e: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setIsOpen(false);
      }
    };
    document.addEventListener('mousedown', handleOutside);
    return () => document.removeEventListener('mousedown', handleOutside);
  }, [isOpen]);

  // Reset focus index when opening
  useEffect(() => {
    if (isOpen) {
      const idx = options.findIndex((o) => o.value === value);
      setFocusedIndex(idx >= 0 ? idx : 0);
    }
  }, [isOpen, options, value]);

  // Scroll focused item into view
  useEffect(() => {
    if (!isOpen || focusedIndex < 0 || !listRef.current) return;
    const items = listRef.current.children;
    if (items[focusedIndex]) {
      (items[focusedIndex] as HTMLElement).scrollIntoView({ block: 'nearest' });
    }
  }, [focusedIndex, isOpen]);

  const handleKeyDown = useCallback(
    (e: React.KeyboardEvent) => {
      if (!isOpen) {
        if (e.key === 'Enter' || e.key === ' ' || e.key === 'ArrowDown') {
          e.preventDefault();
          setIsOpen(true);
        }
        return;
      }

      switch (e.key) {
        case 'ArrowDown':
          e.preventDefault();
          setFocusedIndex((prev) => Math.min(prev + 1, options.length - 1));
          break;
        case 'ArrowUp':
          e.preventDefault();
          setFocusedIndex((prev) => Math.max(prev - 1, 0));
          break;
        case 'Enter':
        case ' ':
          e.preventDefault();
          if (focusedIndex >= 0 && focusedIndex < options.length) {
            onChange(options[focusedIndex].value);
            setIsOpen(false);
          }
          break;
        case 'Escape':
          e.preventDefault();
          setIsOpen(false);
          break;
      }
    },
    [isOpen, focusedIndex, options, onChange],
  );

  const sizeClasses = {
    xs: 'text-[10px] px-1.5 py-0.5',
    sm: 'text-xs px-2 py-1',
    md: 'text-sm px-3 py-1.5',
  };

  const itemSizeClasses = {
    xs: 'text-[10px] px-1.5 py-0.5',
    sm: 'text-xs px-2 py-1',
    md: 'text-sm px-3 py-1.5',
  };

  return (
    <div ref={containerRef} className={`relative inline-block ${className}`}>
      {/* Trigger */}
      <button
        type="button"
        className={`flex items-center justify-between gap-2 font-mono border border-[#333] bg-[#111] text-gray-300 hover:border-[#555] hover:text-white transition-colors outline-none focus:border-terminal-accent ${sizeClasses[size]}`}
        onClick={() => setIsOpen((prev) => !prev)}
        onKeyDown={handleKeyDown}
      >
        <span className={selectedOption?.activeColor ?? ''}>
          {selectedOption?.label ?? placeholder}
        </span>
        <svg
          className={`w-3 h-3 text-gray-500 transition-transform ${isOpen ? 'rotate-180' : ''}`}
          fill="none"
          viewBox="0 0 24 24"
          stroke="currentColor"
          strokeWidth={2}
        >
          <path strokeLinecap="round" strokeLinejoin="round" d="M19 9l-7 7-7-7" />
        </svg>
      </button>

      {/* Dropdown */}
      {isOpen && (
        <div
          ref={listRef}
          className="absolute z-50 mt-0.5 left-0 min-w-full border border-[#333] bg-[#111] shadow-lg max-h-48 overflow-y-auto"
          role="listbox"
        >
          {options.map((opt, idx) => {
            const isSelected = opt.value === value;
            const isFocused = idx === focusedIndex;
            return (
              <div
                key={opt.value}
                role="option"
                aria-selected={isSelected}
                className={`cursor-pointer font-mono transition-colors ${itemSizeClasses[size]} ${
                  isFocused
                    ? 'bg-[#094771] text-white'
                    : isSelected
                      ? 'bg-[#1a1a2e] text-terminal-accent'
                      : 'text-gray-300 hover:bg-[#1a1a1a]'
                }`}
                onMouseEnter={() => setFocusedIndex(idx)}
                onMouseDown={(e) => {
                  e.preventDefault();
                  onChange(opt.value);
                  setIsOpen(false);
                }}
              >
                {opt.label}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
