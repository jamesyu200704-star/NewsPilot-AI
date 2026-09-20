import assert from 'node:assert/strict';
import test from 'node:test';
import { createMockGenerationContent } from '../../shared/mockGeneration.js';
import {
  createMockEditorialRevision,
  createMockVerificationReview,
} from '../../shared/mockAgents.js';
import type {
  EditorialRevision,
  GenerationContent,
  GenerationMode,
  PlanningContext,
  VerificationReview,
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

class IncompleteQwenEditorialProvider implements GenerationProvider {
  readonly name = 'qwen' as const;

  async generate(context: PlanningContext): Promise<GenerationContent> {
    return createMockGenerationContent(context);
  }

  async verify(
    context: PlanningContext,
    draft: GenerationContent,
  ): Promise<VerificationReview> {
    return createMockVerificationReview(context, draft);
  }

  async edit(
    context: PlanningContext,
    draft: GenerationContent,
    verification: VerificationReview,
  ): Promise<EditorialRevision> {
    const editorial = createMockEditorialRevision(
      context,
      draft,
      verification,
    );

    return {
      ...editorial,
      content: {
        ...editorial.content,
        verificationChecklist: [
          '普通核验任务一',
          '普通核验任务二',
          '普通核验任务三',
          '普通核验任务四',
        ],
        risks: ['普通风险一', '普通风险二', '普通风险三'],
      },
      decision: {
        ...editorial.decision,
        finalChecklist: [
          '普通终审任务一',
          '普通终审任务二',
          '普通终审任务三',
          '普通终审任务四',
        ],
      },
    };
  }
}

class InventedEvidenceQwenProvider extends IncompleteQwenEditorialProvider {
  override async verify(
    context: PlanningContext,
    draft: GenerationContent,
  ): Promise<VerificationReview> {
    const verification = await super.verify(context, draft);
    verification.factCheck.findings[0]!.evidenceIds.push(
      'risk:student-privacy',
    );
    return verification;
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

test('千问终审漏掉高风险项时由服务层确定性补齐且不降级 Mock', async () => {
  const service = new GeneratorService(
    new IncompleteQwenEditorialProvider(),
    new MockProvider(),
    silentLogger,
  );

  const result = await service.generate(sampleInput);
  const highActions = result.agentReview.verification.factCheck.findings
    .filter((finding) => finding.severity === 'high')
    .map((finding) => finding.requiredAction);
  const highRisks = result.agentReview.verification.riskReview.items.filter(
    (item) => item.severity === 'high',
  );

  assert.equal(result.mode, 'qwen');
  assert.ok(
    highActions.every(
      (action) =>
        result.verificationChecklist.includes(action) ||
        result.agentReview.editorial.finalChecklist.includes(action),
    ),
  );
  assert.ok(
    highRisks.every(
      (item) =>
        result.risks.includes(item.description) &&
        result.agentReview.editorial.finalChecklist.includes(item.mitigation),
    ),
  );
});

test('千问引用不存在的证据 ID 时剔除伪引用且不降级 Mock', async () => {
  const service = new GeneratorService(
    new InventedEvidenceQwenProvider(),
    new MockProvider(),
    silentLogger,
  );

  const result = await service.generate(sampleInput);
  const validEvidenceIds = new Set(
    result.retrievalContext.evidence.map((item) => item.id),
  );
  const citedEvidenceIds = result.agentReview.verification.factCheck.findings
    .flatMap((finding) => finding.evidenceIds);

  assert.equal(result.mode, 'qwen');
  assert.ok(citedEvidenceIds.every((id) => validEvidenceIds.has(id)));
  assert.ok(!citedEvidenceIds.includes('risk:student-privacy'));
});
