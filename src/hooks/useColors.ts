import { useMemo } from 'react';
import type { ColorScheme } from '../types';

/**
 * Color palette resolved from the color scheme preference.
 *
 * Provides both Tailwind class names and raw hex values for recharts / inline
 * styles. The `up` color is used for positive change, `down` for negative.
 */
export interface ResolvedColors {
  /** Tailwind class for positive values (e.g. 'text-terminal-success') */
  upClass: string;
  /** Tailwind class for negative values */
  downClass: string;
  /** Tailwind bg class for positive values */
  upBg: string;
  /** Tailwind bg class for negative values */
  downBg: string;
  /** Raw hex for positive change (for recharts / inline styles) */
  upHex: string;
  /** Raw hex for negative change */
  downHex: string;
  /** Resolve a CSS class based on value sign */
  cls: (value: number) => string;
  /** Resolve a bold CSS class based on value sign */
  clsBold: (value: number) => string;
  /** Resolve raw hex based on value sign */
  hex: (value: number) => string;
  /** Map change% to heatmap background, respecting color scheme */
  heatBg: (pct: number) => string;
}

export function useColors(colorScheme: ColorScheme): ResolvedColors {
  return useMemo((): ResolvedColors => {
    const isGreenUp = colorScheme === 'greenUp';

    const upClass = isGreenUp ? 'text-terminal-success' : 'text-terminal-error';
    const downClass = isGreenUp ? 'text-terminal-error' : 'text-terminal-success';
    const upBg = isGreenUp ? 'bg-terminal-success' : 'bg-terminal-error';
    const downBg = isGreenUp ? 'bg-terminal-error' : 'bg-terminal-success';
    const upHex = isGreenUp ? '#00cc66' : '#ff3333';
    const downHex = isGreenUp ? '#ff3333' : '#00cc66';

    const cls = (v: number) => (v >= 0 ? upClass : downClass);
    const clsBold = (v: number) => `${v >= 0 ? upClass : downClass} font-bold`;
    const hex = (v: number) => (v >= 0 ? upHex : downHex);

    const heatBg = (pct: number): string => {
      const clamped = Math.max(-5, Math.min(5, pct));
      if (clamped >= 0) {
        const intensity = Math.min(1, clamped / 5);
        if (isGreenUp) {
          const g = Math.round(80 + intensity * 120);
          return `rgba(0,${g},50,${0.25 + intensity * 0.55})`;
        } else {
          const r = Math.round(80 + intensity * 120);
          return `rgba(${r},0,20,${0.25 + intensity * 0.55})`;
        }
      } else {
        const intensity = Math.min(1, -clamped / 5);
        if (isGreenUp) {
          const r = Math.round(80 + intensity * 120);
          return `rgba(${r},0,20,${0.25 + intensity * 0.55})`;
        } else {
          const g = Math.round(80 + intensity * 120);
          return `rgba(0,${g},50,${0.25 + intensity * 0.55})`;
        }
      }
    };

    return { upClass, downClass, upBg, downBg, upHex, downHex, cls, clsBold, hex, heatBg };
  }, [colorScheme]);
}
