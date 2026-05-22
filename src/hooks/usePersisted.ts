import { useState, useCallback } from 'react';
import { loadState, saveState } from '../utils/storage';

/**
 * Drop-in replacement for `useState` that automatically persists every write
 * to localStorage.  Reads the initial value from localStorage on mount so
 * state survives page reloads.
 *
 * @param key          Storage key (without namespace prefix).
 * @param defaultValue Returned when no persisted value exists yet.
 */
export function usePersisted<T>(
  key: string,
  defaultValue: T,
): [T, (value: T | ((prev: T) => T)) => void] {
  const [state, setState] = useState<T>(() => loadState(key, defaultValue));

  const setPersisted = useCallback(
    (value: T | ((prev: T) => T)) => {
      setState((prev) => {
        const next =
          typeof value === 'function' ? (value as (prev: T) => T)(prev) : value;
        saveState(key, next);
        return next;
      });
    },
    [key],
  );

  return [state, setPersisted];
}
