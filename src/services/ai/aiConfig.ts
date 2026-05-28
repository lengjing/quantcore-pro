import type { AIProvider, AISettings } from '../../types';

export const DEFAULT_FREE_CLAUDE_MODEL = 'deepseek/deepseek-chat';
export const DEFAULT_GEMINI_MODEL = 'gemini-2.5-flash';

export const DEFAULT_AI_SETTINGS: AISettings = {
  provider: 'free-claude-code',
  apiKey: '',
  model: DEFAULT_FREE_CLAUDE_MODEL,
};

export function getDefaultModel(provider: AIProvider): string {
  return provider === 'gemini' ? DEFAULT_GEMINI_MODEL : DEFAULT_FREE_CLAUDE_MODEL;
}

export function normalizeAiSettings(settings: AISettings): AISettings {
  return {
    provider: settings.provider,
    apiKey: settings.apiKey.trim(),
    model: settings.model.trim() || getDefaultModel(settings.provider),
  };
}

export function getProviderLabel(provider: AIProvider): string {
  return provider === 'gemini' ? 'Gemini' : 'free-claude-code';
}