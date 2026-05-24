/**
 * aiChatService.ts
 *
 * Frontend service that communicates with the QuantCore Python backend's
 * Claude-powered AI agent endpoint (`POST /api/ai/chat`).
 *
 * The backend runs the full agentic loop (multi-turn Claude tool calls) and returns:
 *   - `message`  — Claude's final text reply
 *   - `actions`  — Mutations the frontend must apply (ADD_SECTOR, ADD_TO_WATCHLIST)
 *   - `toolUse`  — Tool-call log for the UI to display
 */

import type { AIAction, ToolUseEvent } from '../../types';
import type { CustomSectorDef } from '../../data/sectors';

const BACKEND_URL = 'http://localhost:5000';

// ---------------------------------------------------------------------------
// Public types
// ---------------------------------------------------------------------------

export interface ChatApiResponse {
  message: string;
  actions: AIAction[];
  toolUse: ToolUseEvent[];
  error?: string;
}

export interface ChatContext {
  customSectors: CustomSectorDef[];
  stockWatchlist: string[];
}

// ---------------------------------------------------------------------------
// API calls
// ---------------------------------------------------------------------------

/**
 * Send a message to the Claude AI agent.
 *
 * @param messages  Full conversation history (role / content pairs).
 * @param context   Current app state passed to the agent as extra context.
 */
export async function sendAIMessage(
  messages: { role: 'user' | 'assistant'; content: string }[],
  context: ChatContext,
  signal?: AbortSignal,
): Promise<ChatApiResponse> {
  const response = await fetch(`${BACKEND_URL}/api/ai/chat`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ messages, context }),
    signal,
  });

  if (!response.ok) {
    const text = await response.text().catch(() => `HTTP ${response.status}`);
    let parsed: { message?: string } | null = null;
    try {
      parsed = JSON.parse(text);
    } catch {
      /* ignore */
    }
    throw new Error(parsed?.message ?? text);
  }

  return response.json() as Promise<ChatApiResponse>;
}

/**
 * Check backend / Claude readiness.
 */
export async function fetchBackendStatus(): Promise<{
  claude: boolean;
}> {
  const response = await fetch(`${BACKEND_URL}/api/ai/status`, {
    signal: AbortSignal.timeout(3000),
  });
  if (!response.ok) throw new Error('Backend unreachable');
  return response.json();
}
