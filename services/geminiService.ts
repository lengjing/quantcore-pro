import { GoogleGenAI } from "@google/genai";
import { NewsItem } from "../types";

// Note: In a real app, strict error handling for missing keys is needed.
// Here we fail gracefully if no key is present to allow UI demo.
const apiKey = process.env.API_KEY || ''; 
let ai: GoogleGenAI | null = null;

if (apiKey) {
  ai = new GoogleGenAI({ apiKey });
}

export const generateStrategyCode = async (prompt: string): Promise<string> => {
  if (!ai) {
    return `# Mock Response: API Key not found.\n# Please add REACT_APP_GEMINI_API_KEY to your env.\n\ndef strategy(data):\n    # User asked: ${prompt}\n    if data.close > data.ma_20:\n        return Order.BUY\n    return Order.HOLD`;
  }

  try {
    const model = 'gemini-2.5-flash';
    const systemInstruction = `You are an expert Quantitative Developer. 
    Convert the user's trading idea into professional Python code using a standard backtesting library structure (like Backtrader or Zipline). 
    Focus on clear logic, risk management parameters, and comments. 
    Return ONLY the code block, no markdown formatting.`;

    const response = await ai.models.generateContent({
      model,
      contents: prompt,
      config: {
        systemInstruction,
        temperature: 0.2, // Low temperature for code precision
      }
    });

    return response.text || '# No code generated.';
  } catch (error) {
    console.error("Gemini API Error:", error);
    return `# Error generating strategy: ${error instanceof Error ? error.message : 'Unknown error'}`;
  }
};

export const explainStrategyMetrics = async (metrics: any): Promise<string> => {
  if (!ai) return "AI Insights unavailable without API Key.";

  try {
    const model = 'gemini-2.5-flash';
    const prompt = `Analyze these backtest metrics and provide a 2-sentence executive summary for a portfolio manager: ${JSON.stringify(metrics)}`;
    
    const response = await ai.models.generateContent({
      model,
      contents: prompt,
    });

    return response.text || 'No analysis available.';
  } catch (error) {
    return "Analysis failed.";
  }
};

export const fetchMarketNews = async (): Promise<{ items: NewsItem[], groundingUrls: string[] }> => {
  if (!ai) {
    throw new Error("API Key not configured");
  }

  const model = 'gemini-2.5-flash';
  const prompt = `Find the latest top 10 financial and crypto market news headlines from major sources (Bloomberg, Reuters, CoinDesk, CNBC) happening right now.
  
  Strictly format the output as a list where each line follows this pipe-delimited format:
  HEADLINE|SOURCE|TIME_AGO|SENTIMENT|URL
  
  - SENTIMENT must be POSITIVE, NEGATIVE, or NEUTRAL.
  - TIME_AGO should be short (e.g. "10m ago", "1h ago").
  - URL should be the direct link if found, otherwise "N/A".
  - Do not use Markdown formatting (no bold, no italics).
  - Do not number the lines.
  `;

  try {
    const response = await ai.models.generateContent({
      model,
      contents: prompt,
      config: {
        tools: [{ googleSearch: {} }],
      }
    });

    const text = response.text || '';
    const lines = text.split('\n').filter(l => l.includes('|'));
    
    const items: NewsItem[] = lines.map(line => {
      const parts = line.split('|');
      return {
        id: Math.random().toString(36).substr(2, 9),
        headline: parts[0]?.trim() || 'Unknown Headline',
        source: parts[1]?.trim() || 'MarketWire',
        time: parts[2]?.trim() || 'Just now',
        sentiment: (parts[3]?.trim() as any) || 'NEUTRAL',
        relatedSymbols: [], // Model doesn't always reliably return this in strict format, can be inferred later
        url: parts[4]?.trim() !== 'N/A' ? parts[4]?.trim() : undefined
      };
    });

    // Extract grounding URLs if available to satisfy requirements
    const groundingUrls: string[] = [];
    response.candidates?.[0]?.groundingMetadata?.groundingChunks?.forEach((chunk: any) => {
      if (chunk.web?.uri) {
        groundingUrls.push(chunk.web.uri);
      }
    });

    return { items, groundingUrls };
  } catch (error) {
    console.error("News Fetch Error:", error);
    throw error;
  }
};