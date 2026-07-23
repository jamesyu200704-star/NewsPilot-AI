import assert from 'node:assert/strict';
import test from 'node:test';
import { createMockGenerationResult } from '../../shared/mockGeneration.js';
import type {
  BriefInput,
  GenerationMode,
  GenerationResult,
} from '../../shared/generation.js';
import type { GenerationProvider } from '../providers/GenerationProvider.js';
import { MockProvider } from '../providers/MockProvider.js';
import { OpenAIProvider } from '../providers/OpenAIProvider.js';
import { GeneratorService } from '../services/GeneratorService.js';
import { sampleInput } from './fixtures.js';

class StaticProvider implements GenerationProvider {
  constructor(
    readonly name: GenerationMode,
    private readonly result: GenerationResult | Error,
  ) {}

  async generate(_input: BriefInput): Promise<GenerationResult> {
    if (this.result instanceof Error) {
      throw this.result;
    }

    return this.result;
  }
}

const silentLogger = { warn: (_message: string) => undefined };

test('主 Provider 成功时直接返回 OpenAI 结果', async () => {
  const openAIResult: GenerationResult = {
    ...createMockGenerationResult(sampleInput),
    mode: 'openai',
  };
  const service = new GeneratorService(
    new StaticProvider('openai', openAIResult),
    new MockProvider(),
    silentLogger,
  );

  const result = await service.generate(sampleInput);
  assert.equal(result.mode, 'openai');
});

test('OpenAI 请求失败时自动降级到 MockProvider', async () => {
  const service = new GeneratorService(
    new StaticProvider('openai', new Error('上游不可用')),
    new MockProvider(),
    silentLogger,
  );

  const result = await service.generate(sampleInput);
  assert.equal(result.mode, 'mock');
  assert.equal(result.angles.length, 3);
});

test('OpenAI HTTP 请求返回非成功状态时自动降级到 MockProvider', async () => {
  const openAIProvider = new OpenAIProvider({
    apiKey: ['server', 'test', 'credential'].join('-'),
    model: 'test-model',
    fetchImplementation: async () =>
      new Response(null, {
        status: 429,
        headers: { 'x-request-id': 'request-test' },
      }),
  });
  const service = new GeneratorService(
    openAIProvider,
    new MockProvider(),
    silentLogger,
  );

  const result = await service.generate(sampleInput);
  assert.equal(result.mode, 'mock');
});

test('主 Provider 返回无效结构时同样降级到 MockProvider', async () => {
  const invalidResult = {
    topicSummary: '无效结果',
    angles: [],
    generatedAt: new Date().toISOString(),
    mode: 'openai',
  } as unknown as GenerationResult;
  const service = new GeneratorService(
    new StaticProvider('openai', invalidResult),
    new MockProvider(),
    silentLogger,
  );

  const result = await service.generate(sampleInput);
  assert.equal(result.mode, 'mock');
});
