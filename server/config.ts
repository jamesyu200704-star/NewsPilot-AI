import { existsSync } from 'node:fs';

export type ServerProviderMode = 'mock' | 'ollama' | 'openai';

export interface ServerConfig {
  host: string;
  port: number;
  provider: ServerProviderMode;
  openAIApiKey?: string;
  openAIModel: string;
  openAITimeoutMs: number;
  ollamaBaseUrl: string;
  ollamaModel: string;
  ollamaTimeoutMs: number;
}

export const loadLocalEnvironment = () => {
  const environmentFile = ['.env.local', '.env'].find((path) => existsSync(path));

  if (environmentFile) {
    process.loadEnvFile(environmentFile);
  }
};

const toPositiveInteger = (value: string | undefined, fallback: number) => {
  const parsed = Number(value);
  return Number.isInteger(parsed) && parsed > 0 ? parsed : fallback;
};

const withoutTrailingSlash = (value: string) => value.replace(/\/+$/u, '');

export const readServerConfig = (
  environment: NodeJS.ProcessEnv = process.env,
): ServerConfig => {
  const rawProvider = (
    environment.GENERATION_MODE ??
    environment.GENERATION_PROVIDER
  )
    ?.trim()
    .toLowerCase();
  const provider: ServerProviderMode =
    rawProvider === 'ollama' || rawProvider === 'openai'
      ? rawProvider
      : 'mock';

  return {
    host: environment.SERVER_HOST?.trim() || '127.0.0.1',
    port: toPositiveInteger(environment.SERVER_PORT, 8787),
    provider,
    openAIApiKey: environment.OPENAI_API_KEY,
    openAIModel: environment.OPENAI_MODEL?.trim() || 'gpt-5.6-terra',
    openAITimeoutMs: toPositiveInteger(environment.OPENAI_TIMEOUT_MS, 30_000),
    ollamaBaseUrl: withoutTrailingSlash(
      environment.OLLAMA_BASE_URL?.trim() || 'http://localhost:11434',
    ),
    ollamaModel: environment.OLLAMA_MODEL?.trim() || 'qwen3:8b',
    ollamaTimeoutMs: toPositiveInteger(environment.OLLAMA_TIMEOUT_MS, 90_000),
  };
};
