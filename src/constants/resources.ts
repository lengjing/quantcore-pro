/**
 * Type-safe i18n resource key definitions.
 *
 * `ResourceKey` is the union of all translation keys used across
 * `src/i18n/en.ts` and `src/i18n/cn.ts`.  Components that accept a
 * `t()` function can type it as `(key: ResourceKey) => string` for
 * compile-time safety.
 *
 * `LangKey` represents the supported interface languages.
 */

import type en from '../i18n/en';

/** Union of every i18n translation key. */
export type ResourceKey = keyof typeof en;

/** Supported UI languages. */
export type LangKey = 'EN' | 'CN';
