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

loadLocalEnvironment();

const config = readServerConfig();
const mockProvider = new MockProvider();
const searchProvider =
  config.searchProvider === 'brave'
    ? new BraveSearchProvider({
        apiKey: config.braveSearchApiKey,
        timeoutMs: config.braveSearchTimeoutMs,
      })
    : new MockSearchProvider();
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
  new RetrievalService(searchProvider),
);
const server = createApiServer(generatorService);

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
