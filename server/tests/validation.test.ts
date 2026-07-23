import assert from 'node:assert/strict';
import test from 'node:test';
import { createMockGenerationResult } from '../../shared/mockGeneration.js';
import { assertRuntimeGenerationResult } from '../../shared/runtimeGenerationValidation.js';
import {
  assertBriefInput,
  assertGenerationResult,
  SchemaValidationError,
} from '../validation.js';
import { sampleInput } from './fixtures.js';

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
