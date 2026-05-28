/**
 * aiChatService.ts
 *
 * Unified AI access layer that can route to the local free-claude-code proxy
 * or Gemini based on user settings.
 */

import type { AIAction, AISettings, ToolUseEvent } from '../../types';
import type { CustomSectorDef } from '../../data/sectors';
import { sendGeminiChatMessage, generateStrategyCode as generateGeminiStrategyCode } from './geminiService';

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
): Promise<ChatApiResponse> {
  if (settings?.provider === 'gemini') {
    const message = await sendGeminiChatMessage(messages, settings);
    return {
      message,
      actions: [],
      toolUse: [],
    };
  }

  if (window.electron?.chatWithFreeClaude) {
    const chat = await window.electron.chatWithFreeClaude({
      messages,
      config: {
        apiKey: settings?.apiKey,
        model: settings?.model || 'deepseek/deepseek-chat',
        port: Number(process.env.FREE_CLAUDE_PORT || process.env.PORT || 8082),
      },
      maxTokens: 1024,
      temperature: 0.2,
    });

    return {
      message: chat.message,
      actions: [],
      toolUse: [],
    };
  }

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

export async function generateStrategyCode(prompt: string, settings?: AISettings): Promise<string> {
  if (settings?.provider === 'gemini') {
    return generateGeminiStrategyCode(prompt, settings);
  }

  if (window.electron?.chatWithFreeClaude) {
    const chat = await window.electron.chatWithFreeClaude({
      messages: [{ role: 'user', content: prompt }],
      config: {
        apiKey: settings?.apiKey,
        model: settings?.model || 'deepseek/deepseek-chat',
        port: Number(process.env.FREE_CLAUDE_PORT || process.env.PORT || 8082),
      },
      maxTokens: 2048,
      temperature: 0.2,
    });

    return chat.message || '# Empty response from free-claude-code';
  }

  return generateGeminiStrategyCode(prompt, settings);
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
