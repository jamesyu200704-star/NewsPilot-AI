import { existsSync } from 'node:fs';

export type ServerProviderMode = 'mock' | 'ollama' | 'qwen' | 'openai';
export type SearchProviderMode = 'manual' | 'mock' | 'searxng' | 'brave';
export type TranscriptionProviderMode = 'manual' | 'local_whisper';

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
  searchProvider: SearchProviderMode;
  braveSearchApiKey?: string;
  braveSearchTimeoutMs: number;
  searxngBaseUrl: string;
  searchResultLimit: number;
  searchTimeoutMs: number;
  searchRateLimitPerMinute: number;
  searchMaxConcurrentFetches: number;
  uploadMaxFileMb: number;
  uploadMaxProjectMb: number;
  transcriptionProvider: TranscriptionProviderMode;
  localWhisperBaseUrl: string;
  transcriptionMaxFileMb: number;
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
    rawProvider === 'ollama' || rawProvider === 'qwen' || rawProvider === 'openai'
      ? rawProvider
      : 'mock';
  const rawSearchProvider = (environment.SEARCH_PROVIDER || environment.SEARCH_MODE || 'mock').trim().toLowerCase();
  const searchProvider: SearchProviderMode =
    rawSearchProvider === 'searxng' || rawSearchProvider === 'manual' || rawSearchProvider === 'brave'
      ? rawSearchProvider
      : 'mock';
  const transcriptionProvider: TranscriptionProviderMode =
    environment.TRANSCRIPTION_PROVIDER?.trim().toLowerCase() === 'local_whisper'
      ? 'local_whisper'
      : 'manual';

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
    ollamaModel: environment.OLLAMA_MODEL?.trim() || 'qwen2.5:1.5b',
    ollamaTimeoutMs: toPositiveInteger(environment.OLLAMA_TIMEOUT_MS, 90_000),
    searchProvider,
    braveSearchApiKey: environment.BRAVE_SEARCH_API_KEY,
    braveSearchTimeoutMs: toPositiveInteger(
      environment.BRAVE_SEARCH_TIMEOUT_MS,
      10_000,
    ),
    searxngBaseUrl: withoutTrailingSlash(environment.SEARXNG_BASE_URL?.trim() || 'http://localhost:8080'),
    searchResultLimit: Math.min(20, toPositiveInteger(environment.SEARCH_RESULT_LIMIT, 10)),
    searchTimeoutMs: toPositiveInteger(environment.SEARCH_TIMEOUT_MS, 10_000),
    searchRateLimitPerMinute: toPositiveInteger(environment.SEARCH_RATE_LIMIT_PER_MINUTE, 10),
    searchMaxConcurrentFetches: Math.min(10, toPositiveInteger(environment.SEARCH_MAX_CONCURRENT_FETCHES, 3)),
    uploadMaxFileMb: toPositiveInteger(environment.UPLOAD_MAX_FILE_MB, 10),
    uploadMaxProjectMb: toPositiveInteger(environment.UPLOAD_MAX_PROJECT_MB, 50),
    transcriptionProvider,
    localWhisperBaseUrl: withoutTrailingSlash(
      environment.LOCAL_WHISPER_BASE_URL?.trim() || 'http://localhost:9000',
    ),
    transcriptionMaxFileMb: Math.min(
      100,
      toPositiveInteger(environment.TRANSCRIPTION_MAX_FILE_MB, 100),
    ),
  };
};
