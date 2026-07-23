import { existsSync } from 'node:fs';

export type ServerProviderMode = 'mock' | 'openai';

export interface ServerConfig {
  host: string;
  port: number;
  provider: ServerProviderMode;
  openAIApiKey?: string;
  openAIModel: string;
  openAITimeoutMs: number;
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

export const readServerConfig = (): ServerConfig => {
  const rawProvider = process.env.GENERATION_PROVIDER?.trim().toLowerCase();
  const provider: ServerProviderMode = rawProvider === 'openai' ? 'openai' : 'mock';

  return {
    host: process.env.SERVER_HOST?.trim() || '127.0.0.1',
    port: toPositiveInteger(process.env.SERVER_PORT, 8787),
    provider,
    openAIApiKey: process.env.OPENAI_API_KEY,
    openAIModel: process.env.OPENAI_MODEL?.trim() || 'gpt-5.6-terra',
    openAITimeoutMs: toPositiveInteger(process.env.OPENAI_TIMEOUT_MS, 30_000),
  };
};
