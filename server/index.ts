import { createApiServer } from './app.js';
import { loadLocalEnvironment, readServerConfig } from './config.js';
import type { GenerationProvider } from './providers/GenerationProvider.js';
import { MockProvider } from './providers/MockProvider.js';
import { OllamaProvider } from './providers/OllamaProvider.js';
import { OpenAIProvider } from './providers/OpenAIProvider.js';
import { QwenProvider } from './providers/QwenProvider.js';
import { BraveSearchProvider } from './search/BraveSearchProvider.js';
import { MockSearchProvider } from './search/MockSearchProvider.js';
import { GeneratorService } from './services/generator.js';
import { RetrievalService } from './services/检索服务.js';
import { ManualSourceProvider } from './search/p1/ManualSourceProvider.js';
import { MockSearchProvider as P1MockSearchProvider } from './search/p1/MockSearchProvider.js';
import { SearXNGProvider } from './search/p1/SearXNGProvider.js';
import { EvidenceSearchService } from './services/证据搜索服务.js';
import { SourceFetcher } from './sources/SourceFetcher.js';
import { LocalWhisperProvider } from './transcription/LocalWhisperProvider.js';

loadLocalEnvironment();

const config = readServerConfig();
const mockProvider = new MockProvider();
const legacySearchProvider =
  config.searchProvider === 'brave'
    ? new BraveSearchProvider({
        apiKey: config.braveSearchApiKey,
        timeoutMs: config.braveSearchTimeoutMs,
      })
    : new MockSearchProvider();
const manualSourceProvider = new ManualSourceProvider();
const p1SearchProvider = config.searchProvider === 'searxng'
  ? new SearXNGProvider({
      baseUrl: config.searxngBaseUrl,
      timeoutMs: config.searchTimeoutMs,
      defaultLimit: config.searchResultLimit,
      allowLocalBaseUrl: /^https?:\/\/(?:localhost|127\.0\.0\.1|\[::1\])(?::\d+)?/iu.test(config.searxngBaseUrl),
    })
  : config.searchProvider === 'mock'
    ? new P1MockSearchProvider()
    : manualSourceProvider;
const createPrimaryProvider = (): GenerationProvider => {
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

const generatorService = new GeneratorService(
  createPrimaryProvider(),
  mockProvider,
  console,
  new RetrievalService(legacySearchProvider),
);
const transcriptionProvider = config.transcriptionProvider === 'local_whisper'
  ? new LocalWhisperProvider(config.localWhisperBaseUrl)
  : undefined;
const server = createApiServer(generatorService, {
  evidenceSearchService: new EvidenceSearchService(p1SearchProvider, manualSourceProvider),
  sourceFetcher: config.searchProvider === 'searxng' ? new SourceFetcher({ timeoutMs: config.searchTimeoutMs }) : undefined,
  evidenceMaxRequestsPerWindow: config.searchRateLimitPerMinute,
  evidenceMaxConcurrentFetches: config.searchMaxConcurrentFetches,
  transcriptionProvider,
  transcriptionMaxFileMb: config.transcriptionMaxFileMb,
});

server.listen(config.port, config.host, () => {
  console.log(
    '[NewsPilot] Generator Service 已启动：http://' +
      config.host +
      ':' +
      config.port +
      '（provider: ' +
      config.provider +
      '，fallback: mock）',
  );
});

const closeServer = () => {
  server.close(() => process.exit(0));
};

process.once('SIGINT', closeServer);
process.once('SIGTERM', closeServer);
