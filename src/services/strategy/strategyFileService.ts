/**
 * Strategy File Service
 *
 * Communicates with the Python backend (port 5000) for filesystem-backed
 * strategy file management. Provides CRUD, rename, list, and execute operations.
 */

const API_BASE = 'http://localhost:5000/api/strategy';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface FileEntry {
  name: string;
  path: string;
  type: 'file' | 'directory';
  size?: number;
  children?: FileEntry[];
}

export interface ExecutionResult {
  success: boolean;
  stdout: string;
  stderr: string;
  variables: { name: string; type: string; value: string }[];
  duration?: number;
}

// ---------------------------------------------------------------------------
// API helpers
// ---------------------------------------------------------------------------

async function api<T>(url: string, init?: RequestInit): Promise<T> {
  const res = await fetch(url, init);
  if (!res.ok) {
    let errorMsg = `HTTP ${res.status}`;
    try {
      const body = await res.json();
      if (body.error) errorMsg = body.error;
    } catch {
      // Response body wasn't JSON — use status text
    }
    throw new Error(errorMsg);
  }
  return (await res.json()) as T;
}

const jsonHeaders = { 'Content-Type': 'application/json' };

// ---------------------------------------------------------------------------
// Public API
// ---------------------------------------------------------------------------

/** List workspace entries (flat + nested). */
export async function listFiles(): Promise<{ entries: FileEntry[]; workspace: string }> {
  return api(`${API_BASE}/files`);
}

/** Read a single file's content. */
export async function readFile(path: string): Promise<{ content: string; path: string; size: number }> {
  return api(`${API_BASE}/file?path=${encodeURIComponent(path)}`);
}

/** Create a new file or directory. */
export async function createFile(
  path: string,
  content: string = '',
  type: 'file' | 'directory' = 'file',
): Promise<{ success: boolean; path: string }> {
  return api(`${API_BASE}/file`, {
    method: 'POST',
    headers: jsonHeaders,
    body: JSON.stringify({ path, content, type }),
  });
}

/** Update an existing file. */
export async function updateFile(path: string, content: string): Promise<{ success: boolean }> {
  return api(`${API_BASE}/file`, {
    method: 'PUT',
    headers: jsonHeaders,
    body: JSON.stringify({ path, content }),
  });
}

/** Delete a file or directory. */
export async function deleteFile(path: string): Promise<{ success: boolean }> {
  return api(`${API_BASE}/file?path=${encodeURIComponent(path)}`, { method: 'DELETE' });
}

/** Rename / move a file or directory. */
export async function renameFile(oldPath: string, newPath: string): Promise<{ success: boolean }> {
  return api(`${API_BASE}/rename`, {
    method: 'POST',
    headers: jsonHeaders,
    body: JSON.stringify({ oldPath, newPath }),
  });
}

/** Execute Python code (inline or from file). */
export async function executeStrategy(
  opts: { code?: string; path?: string },
): Promise<ExecutionResult> {
  return api(`${API_BASE}/execute`, {
    method: 'POST',
    headers: jsonHeaders,
    body: JSON.stringify(opts),
  });
}
