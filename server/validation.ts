import { Ajv, type ErrorObject, type ValidateFunction } from 'ajv';
import {
  briefInputJsonSchema,
  generationContentJsonSchema,
  generationResultJsonSchema,
  type BriefInput,
  type GenerationContent,
  type GenerationResult,
} from '../shared/generation.js';

const ajv = new Ajv({ allErrors: true, strict: true });

const validateBriefInput = ajv.compile(
  briefInputJsonSchema,
) as ValidateFunction<BriefInput>;
const validateGenerationContent = ajv.compile(
  generationContentJsonSchema,
) as ValidateFunction<GenerationContent>;
const validateGenerationResult = ajv.compile(
  generationResultJsonSchema,
) as ValidateFunction<GenerationResult>;

const formatErrors = (errors: ErrorObject[] | null | undefined) =>
  (errors ?? []).map((error) => {
    const path = error.instancePath || '/';
    return path + ' ' + (error.message ?? error.keyword);
  });

export class SchemaValidationError extends Error {
  readonly issues: string[];

  constructor(subject: string, errors: ErrorObject[] | null | undefined) {
    const issues = formatErrors(errors);
    super(subject + '未通过 JSON Schema 校验：' + issues.join('；'));
    this.name = 'SchemaValidationError';
    this.issues = issues;
  }
}

export function assertBriefInput(value: unknown): asserts value is BriefInput {
  if (!validateBriefInput(value)) {
    throw new SchemaValidationError('用户输入', validateBriefInput.errors);
  }
}

const assertAngleOrder = (content: GenerationContent) => {
  const expectedIds = ['people', 'system', 'trend'];
  const validOrder = content.angles.every(
    (angle, index) => angle.id === expectedIds[index],
  );

  if (!validOrder) {
    throw new SchemaValidationError('生成内容', [
      {
        instancePath: '/angles',
        schemaPath: '#/properties/angles',
        keyword: 'order',
        params: {},
        message: '必须依次包含 people、system、trend 三个角度',
      },
    ]);
  }
};

export function assertGenerationContent(
  value: unknown,
): asserts value is GenerationContent {
  if (!validateGenerationContent(value)) {
    throw new SchemaValidationError('AI 返回内容', validateGenerationContent.errors);
  }

  assertAngleOrder(value);
}

export function assertGenerationResult(
  value: unknown,
): asserts value is GenerationResult {
  if (!validateGenerationResult(value)) {
    throw new SchemaValidationError('生成结果', validateGenerationResult.errors);
  }

  if (Number.isNaN(Date.parse(value.generatedAt))) {
    throw new SchemaValidationError('生成结果', [
      {
        instancePath: '/generatedAt',
        schemaPath: '#/properties/generatedAt',
        keyword: 'format',
        params: {},
        message: '必须是有效时间',
      },
    ]);
  }

  assertAngleOrder(value);
}
