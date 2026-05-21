/**
 * Type-safe localStorage helpers.
 * All keys are namespaced under the `qcp:` prefix to avoid collisions.
 */

const PREFIX = 'qcp:';

export function loadState<T>(key: string, defaultValue: T): T {
  try {
    const raw = localStorage.getItem(PREFIX + key);
    if (raw == null) return defaultValue;
    return JSON.parse(raw) as T;
  } catch {
    return defaultValue;
  }
}

export function saveState<T>(key: string, value: T): void {
  try {
    localStorage.setItem(PREFIX + key, JSON.stringify(value));
  } catch {
    // Quota exceeded or private-browsing restriction — fail silently.
  }
}

export function clearAllState(): void {
  const keys = Object.keys(localStorage).filter((k) => k.startsWith(PREFIX));
  keys.forEach((k) => localStorage.removeItem(k));
}
