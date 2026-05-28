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
  if (!window.electron?.chatWithFreeClaude) {
    return [
      'def strategy(data):',
      `    # ${prompt}`,
      '    return None',
    ].join('\n');
  }

  const chat = await window.electron.chatWithFreeClaude({
    provider: settings?.provider,
    messages: [{ role: 'user', content: prompt }],
    config: {
      provider: settings?.provider,
      apiKey: settings?.apiKey,
      model: settings?.model,
      port: Number(process.env.FREE_CLAUDE_PORT || process.env.PORT || 8082),
    },
    maxTokens: 2048,
    temperature: 0.2,
  });

  return chat.message || '# Empty response from free-claude-code';
}

export async function sendFreeClaudeChatMessage(
  messages: { role: 'user' | 'assistant'; content: string }[],
  settings?: Partial<AISettings>,
  onDelta?: (delta: string, fullText: string) => void,
): Promise<string> {
  if (!window.electron?.chatWithFreeClaudeStream) {
    const chat = await window.electron?.chatWithFreeClaude?.({
      provider: settings?.provider,
      messages,
      config: {
        provider: settings?.provider,
        apiKey: settings?.apiKey,
        model: settings?.model,
        port: Number(process.env.FREE_CLAUDE_PORT || process.env.PORT || 8082),
      },
      maxTokens: 1024,
      temperature: 0.2,
    });
    return chat?.message ?? '';
  }

  const chat = await window.electron.chatWithFreeClaudeStream(
    {
      provider: settings?.provider,
      messages,
      config: {
        provider: settings?.provider,
        apiKey: settings?.apiKey,
        model: settings?.model,
        port: Number(process.env.FREE_CLAUDE_PORT || process.env.PORT || 8082),
      },
      maxTokens: 1024,
      temperature: 0.2,
    },
    { onDelta },
  );

  return chat.message;
}

export async function fetchMarketNews(): Promise<{ items: NewsItem[]; groundingUrls: string[] }> {
  return { items: DEFAULT_MARKET_NEWS, groundingUrls: [] };
}