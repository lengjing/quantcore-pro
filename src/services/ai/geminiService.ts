import { GoogleGenAI } from '@google/genai';
import type { AISettings, NewsItem } from '../../types';
import { DEFAULT_GEMINI_MODEL } from './aiConfig';

function createGeminiClient(apiKey?: string): GoogleGenAI | null {
  const key = (apiKey || process.env.API_KEY || process.env.GEMINI_API_KEY || '').trim();
  if (!key) {
    return null;
  }
  return new GoogleGenAI({ apiKey: key });
}

/** Generate quantitative strategy Python code from a natural-language prompt. */
export const generateStrategyCode = async (prompt: string, settings?: Partial<AISettings>): Promise<string> => {
  const ai = createGeminiClient(settings?.apiKey);
  if (!ai) {
    return [
      '# Mock Response: GEMINI_API_KEY not configured.',
      '# Add GEMINI_API_KEY=your_key to .env.local to enable AI generation.',
      '',
      'def strategy(data):',
      `    # User asked: ${prompt}`,
      '    if data.close > data.ma_20:',
      '        return Order.BUY',
      '    return Order.HOLD',
    ].join('\n');
  }

  try {
    const response = await ai.models.generateContent({
      model: settings?.model?.trim() || DEFAULT_GEMINI_MODEL,
      contents: prompt,
      config: {
        systemInstruction: [
          'You are an expert Quantitative Developer.',
          'Convert the user\'s trading idea into professional Python code using a standard backtesting',
          'library structure (e.g. Backtrader or Zipline).',
          'Focus on clear logic, risk management parameters, and explanatory comments.',
          'Return ONLY the code block — no markdown fences, no prose.',
        ].join(' '),
        temperature: 0.2,
      },
    });

    return response.text ?? '# No code generated.';
  } catch (error) {
    console.error('Gemini generateStrategyCode error:', error);
    return `# Error generating strategy: ${error instanceof Error ? error.message : 'Unknown error'}`;
  }
};

export async function sendGeminiChatMessage(
  messages: { role: 'user' | 'assistant'; content: string }[],
  settings?: Partial<AISettings>,
): Promise<string> {
  const ai = createGeminiClient(settings?.apiKey);
  if (!ai) {
    throw new Error('Gemini API key is not configured');
  }

  const prompt = messages.map((message) => `${message.role.toUpperCase()}: ${message.content}`).join('\n\n');
  const response = await ai.models.generateContent({
    model: settings?.model?.trim() || DEFAULT_GEMINI_MODEL,
    contents: prompt,
    config: {
      temperature: 0.2,
      systemInstruction: 'You are a concise quantitative trading assistant. Reply in plain text only.',
    },
  });

  return response.text ?? '';
}

/** Summarise backtest metrics in plain English for a portfolio manager. */
export const explainStrategyMetrics = async (metrics: unknown, settings?: Partial<AISettings>): Promise<string> => {
  const ai = createGeminiClient(settings?.apiKey);
  if (!ai) return 'AI Insights unavailable — Gemini API key not configured.';

  try {
    const response = await ai.models.generateContent({
      model: settings?.model?.trim() || DEFAULT_GEMINI_MODEL,
      contents: `Analyze these backtest metrics and give a 2-sentence executive summary for a portfolio manager: ${JSON.stringify(metrics)}`,
    });

    return response.text ?? 'No analysis available.';
  } catch {
    return 'Analysis failed.';
  }
};

/** Fetch latest market & crypto news items via Gemini with Google Search grounding. */
export const fetchMarketNews = async (settings?: Partial<AISettings>): Promise<{ items: NewsItem[]; groundingUrls: string[] }> => {
  const ai = createGeminiClient(settings?.apiKey);
  if (!ai) {
    throw new Error('GEMINI_API_KEY not configured');
  }

  const prompt = [
    'Find the latest top 10 financial and crypto market news headlines from major sources',
    '(Bloomberg, Reuters, CoinDesk, CNBC) happening right now.',
    '',
    'Strictly format the output as a list where each line follows this pipe-delimited format:',
    'HEADLINE|SOURCE|TIME_AGO|SENTIMENT|URL',
    '',
    '- SENTIMENT must be POSITIVE, NEGATIVE, or NEUTRAL.',
    '- TIME_AGO should be short (e.g. "10m ago", "1h ago").',
    '- URL should be the direct link if found, otherwise "N/A".',
    '- Do not use Markdown formatting (no bold, no italics).',
    '- Do not number the lines.',
  ].join('\n');

  try {
    const response = await ai.models.generateContent({
      model: settings?.model?.trim() || DEFAULT_GEMINI_MODEL,
      contents: prompt,
      config: {
        tools: [{ googleSearch: {} }],
      },
    });

    const text = response.text ?? '';
    const items: NewsItem[] = text
      .split('\n')
      .filter((line) => line.includes('|'))
      .map((line) => {
        const [headline, source, time, sentiment, url] = line.split('|').map((p) => p.trim());
        return {
          id: Math.random().toString(36).slice(2, 11),
          headline: headline || 'Unknown Headline',
          source: source || 'MarketWire',
          time: time || 'Just now',
          sentiment: (['POSITIVE', 'NEGATIVE', 'NEUTRAL'].includes(sentiment)
            ? sentiment
            : 'NEUTRAL') as NewsItem['sentiment'],
          relatedSymbols: [],
          url: url && url !== 'N/A' ? url : undefined,
        };
      });

    const groundingUrls: string[] = [];
    response.candidates?.[0]?.groundingMetadata?.groundingChunks?.forEach((chunk: any) => {
      if (chunk.web?.uri) groundingUrls.push(chunk.web.uri);
    });

    return { items, groundingUrls };
  } catch (error) {
    console.error('Gemini fetchMarketNews error:', error);
    throw error;
  }
};
