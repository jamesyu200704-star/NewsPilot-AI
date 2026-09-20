import type { Express } from 'express';
import { createApiApp } from './app.js';
import { readServerConfig, type ServerConfig } from './config.js';
import type { GenerationProvider } from './providers/GenerationProvider.js';
import { MockProvider } from './providers/MockProvider.js';
import { OllamaProvider } from './providers/OllamaProvider.js';
import { OpenAIProvider } from './providers/OpenAIProvider.js';
import { QwenProvider } from './providers/QwenProvider.js';
import { BraveSearchProvider } from './search/BraveSearchProvider.js';
import { MockSearchProvider } from './search/MockSearchProvider.js';
import { ManualSourceProvider } from './search/p1/ManualSourceProvider.js';
import { MockSearchProvider as P1MockSearchProvider } from './search/p1/MockSearchProvider.js';
import { SearXNGProvider } from './search/p1/SearXNGProvider.js';
import { BingNewsSearchProvider } from './search/p1/BingNewsSearchProvider.js';
import { GeneratorService } from './services/generator.js';
import { EvidenceSearchService } from './services/证据搜索服务.js';
import { RetrievalService } from './services/检索服务.js';
import { SourceFetcher } from './sources/SourceFetcher.js';
import { LocalWhisperProvider } from './transcription/LocalWhisperProvider.js';

export interface ConfiguredApiRuntime {
  app: Express;
  config: ServerConfig;
}

const createPrimaryProvider = (
  config: ServerConfig,
  mockProvider: MockProvider,
): GenerationProvider => {
  if (config.provider === 'ollama') {
    return new OllamaProvider({
      baseUrl: config.ollamaBaseUrl,
      model: config.ollamaModel,
      timeoutMs: config.ollamaTimeoutMs,
    });
  }

  if (config.provider === 'openai') {
    return new OpenAIProvider({
      apiKey: config.openAIApiKey,
      model: config.openAIModel,
      timeoutMs: config.openAITimeoutMs,
    });
  }

  if (config.provider === 'qwen') {
    return new QwenProvider({
      baseUrl: config.ollamaBaseUrl,
      model: config.ollamaModel,
      timeoutMs: config.ollamaTimeoutMs,
    });
  }

  return mockProvider;
};

export const createConfiguredApiRuntime = (
  environment: NodeJS.ProcessEnv = process.env,
): ConfiguredApiRuntime => {
  const config = readServerConfig(environment);
  const mockProvider = new MockProvider();
  const legacySearchProvider =
    config.searchProvider === 'brave'
      ? new BraveSearchProvider({
          apiKey: config.braveSearchApiKey,
          timeoutMs: config.braveSearchTimeoutMs,
        })
      : new MockSearchProvider();
  const manualSourceProvider = new ManualSourceProvider();
  const p1SearchProvider =
    config.searchProvider === 'bing_news'
      ? new BingNewsSearchProvider({ timeoutMs: config.searchTimeoutMs })
      : config.searchProvider === 'searxng'
      ? new SearXNGProvider({
          baseUrl: config.searxngBaseUrl,
          timeoutMs: config.searchTimeoutMs,
          defaultLimit: config.searchResultLimit,
          allowLocalBaseUrl: /^https?:\/\/(?:localhost|127\.0\.0\.1|\[::1\])(?::\d+)?/iu.test(
            config.searxngBaseUrl,
          ),
        })
      : config.searchProvider === 'mock'
        ? new P1MockSearchProvider()
        : manualSourceProvider;
  const generatorService = new GeneratorService(
    createPrimaryProvider(config, mockProvider),
    mockProvider,
    console,
    new RetrievalService(legacySearchProvider),
  );
  const transcriptionProvider =
    config.transcriptionProvider === 'local_whisper'
      ? new LocalWhisperProvider(config.localWhisperBaseUrl)
      : undefined;

  return {
    config,
    app: createApiApp(generatorService, {
      evidenceSearchService: new EvidenceSearchService(
        p1SearchProvider,
        manualSourceProvider,
      ),
      sourceFetcher:
        config.searchProvider === 'searxng'
          ? new SourceFetcher({ timeoutMs: config.searchTimeoutMs })
          : undefined,
      evidenceMaxRequestsPerWindow: config.searchRateLimitPerMinute,
      evidenceMaxConcurrentFetches: config.searchMaxConcurrentFetches,
      transcriptionProvider,
      transcriptionMaxFileMb: config.transcriptionMaxFileMb,
    }),
  };
};

export const createConfiguredApiApp = (
  environment: NodeJS.ProcessEnv = process.env,
) => createConfiguredApiRuntime(environment).app;
