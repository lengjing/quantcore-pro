import type { AISettings, NewsItem } from '../../types';

const DEFAULT_MARKET_NEWS: NewsItem[] = [
  {
    id: 'news-1',
    headline: 'Free Claude runtime is active. Connect a provider to fetch live market headlines.',
    source: 'QuantCore',
    time: 'Just now',
    sentiment: 'NEUTRAL',
    relatedSymbols: [],
  },
];

export async function generateStrategyCode(prompt: string, settings?: Partial<AISettings>): Promise<string> {
  if (!window.electron?.controlFreeClaude) {
    return [
      'def strategy(data):',
      `    # ${prompt}`,
      '    return None',
    ].join('\n');
  }

  const baseUrl = await ensureRuntimeAndGetBaseUrl(settings);
  const requestBody = {
    model: settings?.model || 'deepseek/deepseek-chat',
    max_tokens: 2048,
    temperature: 0.2,
    stream: false,
    messages: [{ role: 'user', content: prompt }],
  };

  const message = await requestChatMessage(baseUrl, requestBody);
  return message || '# Empty response from free-claude-code';
}

export async function sendFreeClaudeChatMessage(
  messages: { role: 'user' | 'assistant'; content: string }[],
  settings?: Partial<AISettings>,
  onDelta?: (delta: string, fullText: string) => void,
): Promise<string> {
  if (!window.electron?.controlFreeClaude) {
    return '';
  }

  const baseUrl = await ensureRuntimeAndGetBaseUrl(settings);
  const requestBody = {
    model: settings?.model || 'deepseek/deepseek-chat',
    max_tokens: 1024,
    temperature: 0.2,
    stream: true,
    messages,
  };

  return requestChatMessageStream(baseUrl, requestBody, onDelta);
}

async function ensureRuntimeAndGetBaseUrl(settings?: Partial<AISettings>): Promise<string> {
  const status = await window.electron!.controlFreeClaude!({
    action: 'start',
    config: {
      provider: settings?.provider,
      apiKey: settings?.apiKey,
      model: settings?.model,
      port: Number(process.env.FREE_CLAUDE_PORT || process.env.PORT || 8082),
    },
  });

  if (!status?.ok || !status.baseUrl) {
    throw new Error(status?.error || 'free-claude runtime unavailable');
  }

  return status.baseUrl;
}

async function requestChatMessage(
  baseUrl: string,
  body: Record<string, unknown>,
): Promise<string> {
  const response = await fetch(`${baseUrl}/v1/messages`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'x-api-key': 'freecc',
      'anthropic-version': '2023-06-01',
    },
    body: JSON.stringify(body),
  });

  const raw = await response.text();
  if (!response.ok) {
    throw new Error(raw || `HTTP ${response.status}`);
  }

  return extractMessageText(raw);
}

async function requestChatMessageStream(
  baseUrl: string,
  body: Record<string, unknown>,
  onDelta?: (delta: string, fullText: string) => void,
): Promise<string> {
  const response = await fetch(`${baseUrl}/v1/messages`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'x-api-key': 'freecc',
      'anthropic-version': '2023-06-01',
    },
    body: JSON.stringify(body),
  });

  if (!response.ok) {
    const rawErr = await response.text();
    throw new Error(rawErr || `HTTP ${response.status}`);
  }

  if (!response.body) {
    const raw = await response.text();
    return extractMessageText(raw);
  }

  const reader = response.body.getReader();
  const decoder = new TextDecoder('utf-8');
  let buffer = '';
  let fullText = '';

  while (true) {
    const { done, value } = await reader.read();
    if (done) break;

    buffer += decoder.decode(value, { stream: true });
    const chunks = buffer.split(/\r?\n\r?\n/);
    buffer = chunks.pop() || '';

    for (const chunk of chunks) {
      const delta = extractDeltaFromSseChunk(chunk);
      if (!delta) continue;
      fullText += delta;
      onDelta?.(delta, fullText);
    }
  }

  return fullText.trim();
}

function extractMessageText(raw: string): string {
  try {
    const parsed = JSON.parse(raw) as {
      content?: Array<{ type?: string; text?: string }>;
      error?: { message?: string };
    };
    const parts = (parsed.content || [])
      .filter((part) => part.type === 'text')
      .map((part) => part.text || '')
      .join('')
      .trim();
    if (parts) {
      return parts;
    }
    if (parsed.error?.message) {
      throw new Error(parsed.error.message);
    }
  } catch {
    return extractSseText(raw);
  }

  return extractSseText(raw);
}

function extractSseText(raw: string): string {
  const lines = raw.split(/\r?\n/);
  let fullText = '';

  for (const line of lines) {
    const delta = extractDeltaFromSseChunk(line);
    if (delta) {
      fullText += delta;
    }
  }

  return fullText.trim();
}

function extractDeltaFromSseChunk(chunk: string): string {
  if (!chunk.startsWith('data:')) return '';
  const jsonPart = chunk.slice(5).trim();
  if (!jsonPart || jsonPart === '[DONE]') return '';

  try {
    const event = JSON.parse(jsonPart) as {
      type?: string;
      delta?: { type?: string; text?: string };
      content_block?: { type?: string; text?: string };
      message?: { content?: Array<{ type?: string; text?: string }> };
    };

    if (event.type === 'content_block_delta' && event.delta?.type === 'text_delta') {
      return event.delta.text || '';
    }

    if (event.type === 'content_block_start' && event.content_block?.type === 'text') {
      return event.content_block.text || '';
    }

    if (event.message?.content) {
      return event.message.content
        .filter((part) => part.type === 'text')
        .map((part) => part.text || '')
        .join('');
    }
  } catch {
    return '';
  }

  return '';
}

export async function fetchMarketNews(): Promise<{ items: NewsItem[]; groundingUrls: string[] }> {
  return { items: DEFAULT_MARKET_NEWS, groundingUrls: [] };
}