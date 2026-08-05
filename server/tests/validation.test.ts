import assert from 'node:assert/strict';
import test from 'node:test';
import { generationContentJsonSchema } from '../../shared/generation.js';
import { createMockGenerationResult } from '../../shared/mockGeneration.js';
import {
  createMockEditorialRevision,
  createMockVerificationReview,
} from '../../shared/mockAgents.js';
import { createMockGenerationContent } from '../../shared/mockGeneration.js';
import { assertRuntimeGenerationResult } from '../../shared/runtimeGenerationValidation.js';
import { buildPlanningContext } from '../../shared/新闻方法论.js';
import {
  assertBriefInput,
  assertEditorialResolvesVerification,
  assertGenerationResult,
  assertVerificationEvidence,
  SchemaValidationError,
} from '../validation.js';
import { sampleInput } from './fixtures.js';

const collectPatterns = (value: unknown, patterns: string[] = []) => {
  if (Array.isArray(value)) {
    value.forEach((item) => collectPatterns(item, patterns));
    return patterns;
  }

  if (typeof value !== 'object' || value === null) {
    return patterns;
  }

  for (const [key, item] of Object.entries(value)) {
    if (key === 'pattern' && typeof item === 'string') {
      patterns.push(item);
    } else {
      collectPatterns(item, patterns);
    }
  }

  return patterns;
};

test('Ollama 使用的 JSON Schema 正则全部带有首尾锚点', () => {
  const patterns = collectPatterns(generationContentJsonSchema);

  assert.ok(patterns.length > 0);
  assert.deepEqual(
    patterns.filter(
      (pattern) => !pattern.startsWith('^') || !pattern.endsWith('$'),
    ),
    [],
  );
});

test('事实核查只能引用检索上下文中存在的证据 ID', () => {
  const context = buildPlanningContext(sampleInput);
  const draft = createMockGenerationContent(context);
  const verification = createMockVerificationReview(context, draft);
  verification.factCheck.findings[0]!.evidenceIds = ['invented-evidence-id'];

  assert.throws(
    () => assertVerificationEvidence(verification, context.retrievalContext),
    (error) => error instanceof SchemaValidationError,
  );
});

test('新闻编辑终审不能遗漏高风险核验任务', () => {
  const context = buildPlanningContext(sampleInput);
  const draft = createMockGenerationContent(context);
  const verification = createMockVerificationReview(context, draft);
  const editorial = createMockEditorialRevision(context, draft, verification);
  editorial.decision.finalChecklist = [
    '一般检查一',
    '一般检查二',
    '一般检查三',
    '一般检查四',
  ];

  assert.throws(
    () => assertEditorialResolvesVerification(editorial, verification),
    (error) => error instanceof SchemaValidationError,
  );
});

test('合法输入与 Mock 结果通过 JSON Schema 校验', () => {
  assert.doesNotThrow(() => assertBriefInput(sampleInput));
  const mockResult = createMockGenerationResult(sampleInput);
  assert.doesNotThrow(() => assertGenerationResult(mockResult));
  assert.doesNotThrow(() => assertRuntimeGenerationResult(mockResult));
});

test('必填输入和 AI 文本只有空白字符时校验失败', () => {
  assert.throws(
    () => assertBriefInput({ ...sampleInput, topic: '   ' }),
    (error) => error instanceof SchemaValidationError,
  );

  const result = createMockGenerationResult(sampleInput);
  result.topicSummary = '   ';
  assert.throws(
    () => assertGenerationResult(result),
    (error) => error instanceof SchemaValidationError,
  );
  assert.throws(() => assertRuntimeGenerationResult(result));
});

test('输入包含额外字段时拒绝请求', () => {
  const invalidInput = { ...sampleInput, apiKey: '不应出现在请求中' };

  assert.throws(
    () => assertBriefInput(invalidInput),
    (error) => error instanceof SchemaValidationError,
  );
});

test('生成结果缺失下一步行动时校验失败', () => {
  const result = createMockGenerationResult(sampleInput);
  const invalidResult = structuredClone(result) as unknown as {
    angles: Array<Record<string, unknown>>;
  };
  delete invalidResult.angles[0].nextActions;

  assert.throws(
    () => assertGenerationResult(invalidResult),
    (error) => error instanceof SchemaValidationError,
  );
});
