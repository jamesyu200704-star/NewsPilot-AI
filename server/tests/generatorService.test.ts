import assert from 'node:assert/strict';
import test from 'node:test';
import { createMockGenerationContent } from '../../shared/mockGeneration.js';
import type {
  GenerationContent,
  GenerationMode,
  PlanningContext,
} from '../../shared/generation.js';
import { buildPlanningContext } from '../../shared/新闻方法论.js';
import type { GenerationProvider } from '../providers/GenerationProvider.js';
import { MockProvider } from '../providers/MockProvider.js';
import { OpenAIProvider } from '../providers/OpenAIProvider.js';
import { GeneratorService } from '../services/generator.js';
import {
  OllamaConnectionError,
  OllamaModelNotFoundError,
} from '../services/ollama.js';
import { sampleInput } from './fixtures.js';

class StaticProvider implements GenerationProvider {
  constructor(
    readonly name: GenerationMode,
    private readonly result: GenerationContent | Error,
  ) {}

  async generate(_context: PlanningContext): Promise<GenerationContent> {
    if (this.result instanceof Error) {
      throw this.result;
    }

    return this.result;
  }
}

const silentLogger = { warn: (_message: string) => undefined };

test('主 Provider 成功时直接返回 OpenAI 结果', async () => {
  const openAIContent = createMockGenerationContent(
    buildPlanningContext(sampleInput),
  );
  const service = new GeneratorService(
    new StaticProvider('openai', openAIContent),
    new MockProvider(),
    silentLogger,
  );

  const result = await service.generate(sampleInput);
  assert.equal(result.mode, 'openai');
});

test('生成服务先执行新闻方法论，再返回完整新闻策划报告', async () => {
  const mockProvider = new MockProvider();
  const service = new GeneratorService(mockProvider, mockProvider, silentLogger);

  const result = await service.generate(sampleInput);

  assert.equal(result.topicAnalysis.category, 'education');
  assert.equal(result.newsValueAssessment.dimensions.length, 6);
  assert.ok(result.newsValueAssessment.overallScore > 0);
  assert.ok(result.ruleDecision.matches.length > 0);
  assert.ok(result.dataNeeds.length >= 4);
  assert.ok(result.verificationChecklist.length >= 4);
  assert.ok(result.risks.length >= 3);
  assert.ok(result.nextActions.length >= 3);
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
  assert.equal(
    result.fallbackNotice,
    'OpenAI 生成暂时不可用，已自动切换到 Demo 模式。',
  );
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
  const invalidContent = {
    topicSummary: '无效结果',
    angles: [],
  } as unknown as GenerationContent;
  const service = new GeneratorService(
    new StaticProvider('openai', invalidContent),
    new MockProvider(),
    silentLogger,
  );

  const result = await service.generate(sampleInput);
  assert.equal(result.mode, 'mock');
});

test('Ollama 未启动时降级到 Mock 并返回启动提示', async () => {
  const service = new GeneratorService(
    new StaticProvider('ollama', new OllamaConnectionError()),
    new MockProvider(),
    silentLogger,
  );

  const result = await service.generate(sampleInput);

  assert.equal(result.mode, 'mock');
  assert.equal(
    result.fallbackNotice,
    '请启动 Ollama 服务。已自动切换到 Demo 模式。',
  );
});

test('Ollama 模型不存在时降级到 Mock 并返回下载提示', async () => {
  const service = new GeneratorService(
    new StaticProvider('ollama', new OllamaModelNotFoundError()),
    new MockProvider(),
    silentLogger,
  );

  const result = await service.generate(sampleInput);

  assert.equal(result.mode, 'mock');
  assert.equal(
    result.fallbackNotice,
    '请下载对应模型。已自动切换到 Demo 模式。',
  );
});
