import { createApiServer } from './app.js';
import { loadLocalEnvironment, readServerConfig } from './config.js';
import type { GenerationProvider } from './providers/GenerationProvider.js';
import { MockProvider } from './providers/MockProvider.js';
import { OpenAIProvider } from './providers/OpenAIProvider.js';
import { GeneratorService } from './services/GeneratorService.js';

loadLocalEnvironment();

const config = readServerConfig();
const mockProvider = new MockProvider();
const primaryProvider: GenerationProvider =
  config.provider === 'openai'
    ? new OpenAIProvider({
        apiKey: config.openAIApiKey,
        model: config.openAIModel,
        timeoutMs: config.openAITimeoutMs,
      })
    : mockProvider;

const generatorService = new GeneratorService(primaryProvider, mockProvider);
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
