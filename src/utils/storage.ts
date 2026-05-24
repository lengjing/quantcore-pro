/**
 * Versioned localStorage system for QuantCore Pro.
 *
 * Goals:
 * - Keep persisted system data stable across app upgrades.
 * - Support optional TTL expiration for ephemeral state.
 * - Preserve backward compatibility with legacy plain JSON values.
 * - Keep a minimal, type-safe API for hooks (loadState/saveState).
 */

const PREFIX = 'qcp:';
const STORAGE_VERSION = 1;

interface PersistedEnvelope<T> {
  v: number;
  updatedAt: number;
  expiresAt?: number;
  data: T;
}

function now(): number {
  return Date.now();
}

function isObjectLike(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null;
}

function isEnvelope<T>(value: unknown): value is PersistedEnvelope<T> {
  return (
    isObjectLike(value) &&
    typeof value.v === 'number' &&
    typeof value.updatedAt === 'number' &&
    'data' in value
  );
}

function keyOf(key: string): string {
  return PREFIX + key;
}

function removeByFullKey(fullKey: string): void {
  try {
    localStorage.removeItem(fullKey);
  } catch {
    // Ignore storage access failures.
  }
}

function parseStored<T>(raw: string): PersistedEnvelope<T> | null {
  try {
    const parsed = JSON.parse(raw) as unknown;

    // New format
    if (isEnvelope<T>(parsed)) {
      return parsed;
    }

    // Legacy format migration: raw data only.
    return {
      v: 0,
      updatedAt: now(),
      data: parsed as T,
    };
  } catch {
    return null;
  }
}

function shouldExpire<T>(envelope: PersistedEnvelope<T>): boolean {
  return typeof envelope.expiresAt === 'number' && envelope.expiresAt <= now();
}

function writeEnvelope<T>(key: string, envelope: PersistedEnvelope<T>): void {
  try {
    localStorage.setItem(keyOf(key), JSON.stringify(envelope));
  } catch {
    // Quota exceeded or private-browsing restriction — fail silently.
  }
}

function readEnvelope<T>(key: string): PersistedEnvelope<T> | null {
  const fullKey = keyOf(key);
  const raw = localStorage.getItem(fullKey);
  if (raw == null) return null;

  const parsed = parseStored<T>(raw);
  if (!parsed) {
    removeByFullKey(fullKey);
    return null;
  }

  if (shouldExpire(parsed)) {
    removeByFullKey(fullKey);
    return null;
  }

  // Auto-upgrade legacy or old-version records in place.
  if (parsed.v !== STORAGE_VERSION) {
    writeEnvelope(key, {
      ...parsed,
      v: STORAGE_VERSION,
      updatedAt: now(),
    });
  }

  return parsed;
}

export function loadState<T>(key: string, defaultValue: T): T {
  try {
    const envelope = readEnvelope<T>(key);
    if (!envelope) return defaultValue;
    return envelope.data;
  } catch {
    return defaultValue;
  }
}

export function saveState<T>(key: string, value: T): void {
  writeEnvelope(key, {
    v: STORAGE_VERSION,
    updatedAt: now(),
    data: value,
  });
}

export function saveStateWithTTL<T>(key: string, value: T, ttlMs: number): void {
  const expiresAt = now() + Math.max(0, ttlMs);
  writeEnvelope(key, {
    v: STORAGE_VERSION,
    updatedAt: now(),
    expiresAt,
    data: value,
  });
}

export function removeState(key: string): void {
  removeByFullKey(keyOf(key));
}

export function exportAllState(): Record<string, unknown> {
  const dump: Record<string, unknown> = {};
  for (const fullKey of Object.keys(localStorage)) {
    if (!fullKey.startsWith(PREFIX)) continue;
    const shortKey = fullKey.slice(PREFIX.length);
    const raw = localStorage.getItem(fullKey);
    if (raw == null) continue;
    const parsed = parseStored<unknown>(raw);
    if (!parsed || shouldExpire(parsed)) continue;
    dump[shortKey] = parsed.data;
  }
  return dump;
}

export function importAllState(data: Record<string, unknown>): void {
  for (const [key, value] of Object.entries(data)) {
    saveState(key, value);
  }
}

export function getStorageStats(): {
  entries: number;
  approxBytes: number;
} {
  let entries = 0;
  let approxBytes = 0;

  for (const fullKey of Object.keys(localStorage)) {
    if (!fullKey.startsWith(PREFIX)) continue;
    const raw = localStorage.getItem(fullKey);
    if (raw == null) continue;
    entries += 1;
    approxBytes += fullKey.length + raw.length;
  }

  return { entries, approxBytes };
}

export function clearAllState(): void {
  const keys = Object.keys(localStorage).filter((k) => k.startsWith(PREFIX));
  keys.forEach((k) => localStorage.removeItem(k));
}
