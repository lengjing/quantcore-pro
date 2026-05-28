import type { AIProvider, AISettings } from '../../types';

export interface FreeClaudeProviderOption {
  id: AIProvider;
  label: string;
  credentialEnv?: string;
  defaultModel: string;
  modelHints: string[];
  local?: boolean;
}

export const FREE_CLAUDE_PROVIDER_OPTIONS: FreeClaudeProviderOption[] = [
  {
    id: 'nvidia_nim',
    label: 'NVIDIA NIM',
    credentialEnv: 'NVIDIA_NIM_API_KEY',
    defaultModel: 'z-ai/glm4.7',
    modelHints: ['z-ai/glm5.1', 'moonshotai/kimi-k2.5', 'minimaxai/minimax-m2.5'],
  },
  {
    id: 'open_router',
    label: 'OpenRouter',
    credentialEnv: 'OPENROUTER_API_KEY',
    defaultModel: 'anthropic/claude-sonnet-4',
    modelHints: ['stepfun/step-3.5-flash:free', 'openai/gpt-4.1-mini', 'deepseek/deepseek-r1'],
  },
  {
    id: 'deepseek',
    label: 'DeepSeek',
    credentialEnv: 'DEEPSEEK_API_KEY',
    defaultModel: 'deepseek-chat',
    modelHints: ['deepseek-chat', 'deepseek-reasoner'],
  },
  {
    id: 'mistral',
    label: 'Mistral La Plateforme',
    credentialEnv: 'MISTRAL_API_KEY',
    defaultModel: 'mistral-small-latest',
    modelHints: ['mistral-small-latest', 'devstral-small-latest'],
  },
  {
    id: 'mistral_codestral',
    label: 'Mistral Codestral',
    credentialEnv: 'CODESTRAL_API_KEY',
    defaultModel: 'codestral-latest',
    modelHints: ['codestral-latest'],
  },
  {
    id: 'opencode',
    label: 'OpenCode Zen',
    credentialEnv: 'OPENCODE_API_KEY',
    defaultModel: 'gpt-5.3-codex',
    modelHints: ['claude-sonnet-4', 'deepseek-v4-flash-free', 'gemini-3-flash', 'big-pickle'],
  },
  {
    id: 'opencode_go',
    label: 'OpenCode Go',
    credentialEnv: 'OPENCODE_API_KEY',
    defaultModel: 'minimax-m2.7',
    modelHints: ['minimax-m2.7'],
  },
  {
    id: 'wafer',
    label: 'Wafer',
    credentialEnv: 'WAFER_API_KEY',
    defaultModel: 'DeepSeek-V4-Pro',
    modelHints: ['DeepSeek-V4-Pro', 'MiniMax-M2.7', 'Qwen3.5-397B-A17B', 'GLM-5.1'],
  },
  {
    id: 'kimi',
    label: 'Kimi',
    credentialEnv: 'KIMI_API_KEY',
    defaultModel: 'kimi-k2.5',
    modelHints: ['kimi-k2.5'],
  },
  {
    id: 'cerebras',
    label: 'Cerebras Inference',
    credentialEnv: 'CEREBRAS_API_KEY',
    defaultModel: 'llama3.1-8b',
    modelHints: ['llama3.1-8b', 'gpt-oss-120b'],
  },
  {
    id: 'groq',
    label: 'Groq',
    credentialEnv: 'GROQ_API_KEY',
    defaultModel: 'llama-3.3-70b-versatile',
    modelHints: ['llama-3.3-70b-versatile', 'qwen/qwen3-32b'],
  },
  {
    id: 'fireworks',
    label: 'Fireworks AI',
    credentialEnv: 'FIREWORKS_API_KEY',
    defaultModel: 'accounts/fireworks/models/llama-v3p3-70b-instruct',
    modelHints: ['accounts/fireworks/models/llama-v3p3-70b-instruct'],
  },
  {
    id: 'zai',
    label: 'Z.ai',
    credentialEnv: 'ZAI_API_KEY',
    defaultModel: 'glm-4.6',
    modelHints: ['glm-4.6', 'glm-4.5-air'],
  },
  {
    id: 'lmstudio',
    label: 'LM Studio',
    defaultModel: 'local-model',
    modelHints: ['local-model'],
    local: true,
  },
  {
    id: 'llamacpp',
    label: 'llama.cpp',
    defaultModel: 'local-model',
    modelHints: ['local-model'],
    local: true,
  },
  {
    id: 'ollama',
    label: 'Ollama',
    defaultModel: 'llama3.2',
    modelHints: ['llama3.2', 'qwen2.5-coder'],
    local: true,
  },
];

export const DEFAULT_AI_PROVIDER: AIProvider = 'deepseek';

export const DEFAULT_AI_SETTINGS: AISettings = {
  provider: DEFAULT_AI_PROVIDER,
  apiKey: '',
  model: 'deepseek-chat',
};

export function getProviderOption(provider: AIProvider): FreeClaudeProviderOption {
  return FREE_CLAUDE_PROVIDER_OPTIONS.find((option) => option.id === provider) ?? FREE_CLAUDE_PROVIDER_OPTIONS[0];
}

export function getDefaultModel(provider: AIProvider): string {
  return getProviderOption(provider).defaultModel;
}

export function getProviderLabel(provider: AIProvider): string {
  return getProviderOption(provider).label;
}

export function getProviderModelHints(provider: AIProvider): string[] {
  return getProviderOption(provider).modelHints;
}

export function normalizeAiSettings(settings: AISettings): AISettings {
  const provider = getProviderOption(settings.provider as AIProvider).id;
  const trimmedModel = settings.model.trim();
  return {
    provider,
    apiKey: settings.apiKey.trim(),
    model: trimmedModel || getDefaultModel(provider),
  };
}