/**
 * aiChatService.ts
 *
 * Unified AI access layer that routes to the local free-claude-code proxy.
 */

import type { AIAction, AISettings, ToolUseEvent } from '../../types';
import type { CustomSectorDef } from '../../data/sectors';
import { sendFreeClaudeChatMessage, generateStrategyCode as generateFreeClaudeStrategyCode } from './freeClaudeService';

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
  settings?: AISettings,
  signal?: AbortSignal,
  onDelta?: (delta: string, fullText: string) => void,
): Promise<ChatApiResponse> {
  const message = await sendFreeClaudeChatMessage(messages, settings, onDelta);
  return {
    message,
    actions: [],
    toolUse: [],
  };
}

export async function generateStrategyCode(prompt: string, settings?: AISettings): Promise<string> {
  return generateFreeClaudeStrategyCode(prompt, settings);
}

/**
 * Check backend / Claude readiness.
 */
export async function fetchBackendStatus(): Promise<{
  claude: boolean;
}> {
  if (window.electron?.controlFreeClaude) {
    const status = await window.electron.controlFreeClaude({ action: 'status' });
    return { claude: Boolean(status.running) };
  }

  const response = await fetch(`${BACKEND_URL}/api/ai/status`, {
    signal: AbortSignal.timeout(3000),
  });
  if (!response.ok) throw new Error('Backend unreachable');
  return response.json();
}
