/**
 * Shared HTTP fetch helper with error handling.
 *
 * Eliminates the duplicated try/catch + response.ok pattern across
 * service adapters.
 */

/**
 * Fetch JSON from a URL.  Throws on non-ok HTTP status.
 *
 * @param url     Absolute URL to fetch.
 * @param label   Human-readable context for error messages.
 * @returns       Parsed JSON response.
 */
export async function fetchJson<T>(url: string, label?: string): Promise<T> {
  const response = await fetch(url);
  if (!response.ok) {
    throw new Error(`HTTP ${response.status}${label ? ` (${label})` : ''}`);
  }
  return response.json() as Promise<T>;
}
