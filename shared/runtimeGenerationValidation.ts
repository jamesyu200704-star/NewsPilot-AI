import type { GenerationResult, StoryAngle, StoryAngleId } from './generation.js';

type JsonRecord = Record<string, unknown>;

const angleKeys = new Set([
  'id',
  'title',
  'perspective',
  'newsValueScore',
  'whyWorthReporting',
  'newsValue',
  'interviewees',
  'interviewQuestions',
  'verificationChecklist',
  'risks',
  'nextActions',
]);
const resultKeys = new Set(['topicSummary', 'angles', 'generatedAt', 'mode']);
const angleIds: StoryAngleId[] = ['people', 'system', 'trend'];

const isRecord = (value: unknown): value is JsonRecord =>
  typeof value === 'object' && value !== null && !Array.isArray(value);

const hasExactKeys = (value: JsonRecord, expectedKeys: Set<string>) => {
  const keys = Object.keys(value);
  return (
    keys.length === expectedKeys.size &&
    keys.every((key) => expectedKeys.has(key))
  );
};

const isBoundedText = (value: unknown, maxLength: number) =>
  typeof value === 'string' &&
  value.length <= maxLength &&
  /\S/u.test(value);

const isFixedTextArray = (value: unknown, size: number) =>
  Array.isArray(value) &&
  value.length === size &&
  value.every((item) => isBoundedText(item, 1600));

const isStoryAngle = (value: unknown, expectedId: StoryAngleId): value is StoryAngle => {
  if (!isRecord(value) || !hasExactKeys(value, angleKeys)) {
    return false;
  }

  return (
    value.id === expectedId &&
    isBoundedText(value.title, 240) &&
    isBoundedText(value.perspective, 1600) &&
    typeof value.newsValueScore === 'number' &&
    Number.isFinite(value.newsValueScore) &&
    value.newsValueScore >= 0 &&
    value.newsValueScore <= 5 &&
    isBoundedText(value.whyWorthReporting, 1600) &&
    isFixedTextArray(value.newsValue, 3) &&
    isFixedTextArray(value.interviewees, 4) &&
    isFixedTextArray(value.interviewQuestions, 6) &&
    isFixedTextArray(value.verificationChecklist, 4) &&
    isFixedTextArray(value.risks, 3) &&
    isFixedTextArray(value.nextActions, 3)
  );
};

export const isRuntimeGenerationResult = (
  value: unknown,
): value is GenerationResult => {
  if (!isRecord(value) || !hasExactKeys(value, resultKeys)) {
    return false;
  }

  return (
    isBoundedText(value.topicSummary, 800) &&
    Array.isArray(value.angles) &&
    value.angles.length === angleIds.length &&
    value.angles.every((angle, index) => isStoryAngle(angle, angleIds[index])) &&
    typeof value.generatedAt === 'string' &&
    !Number.isNaN(Date.parse(value.generatedAt)) &&
    (value.mode === 'mock' || value.mode === 'openai')
  );
};

export function assertRuntimeGenerationResult(
  value: unknown,
): asserts value is GenerationResult {
  if (!isRuntimeGenerationResult(value)) {
    throw new Error('API 返回内容不符合 GenerationResult 结构。');
  }
}
