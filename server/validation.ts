import { Ajv, type ErrorObject, type ValidateFunction } from 'ajv';
import {
  briefInputJsonSchema,
  editorialRevisionJsonSchema,
  generationContentJsonSchema,
  generationResultJsonSchema,
  verificationReviewJsonSchema,
  type BriefInput,
  type EditorialRevision,
  type GenerationContent,
  type GenerationResult,
  type RetrievalContext,
  type VerificationReview,
} from '../shared/generation.js';
import {
  editorialTaskRequestJsonSchema,
  editorialTaskResultJsonSchema,
  interviewPlanJsonSchema,
  type EditorialTaskRequest,
  type EditorialTaskResult,
  type InterviewPlan,
} from '../shared/编辑任务模型.js';

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
const validateVerificationReview = ajv.compile(
  verificationReviewJsonSchema,
) as ValidateFunction<VerificationReview>;
const validateEditorialRevision = ajv.compile(
  editorialRevisionJsonSchema,
) as ValidateFunction<EditorialRevision>;
const validateEditorialTaskRequest = ajv.compile(
  editorialTaskRequestJsonSchema,
) as ValidateFunction<EditorialTaskRequest>;
const validateEditorialTaskResult = ajv.compile(
  editorialTaskResultJsonSchema,
) as ValidateFunction<EditorialTaskResult>;
const validateInterviewPlan = ajv.compile(
  interviewPlanJsonSchema,
) as ValidateFunction<InterviewPlan>;

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

export function assertEditorialTaskRequest(
  value: unknown,
): asserts value is EditorialTaskRequest {
  if (!validateEditorialTaskRequest(value)) {
    throw new SchemaValidationError('编辑任务输入', validateEditorialTaskRequest.errors);
  }
}

export function assertEditorialTaskResult(
  value: unknown,
): asserts value is EditorialTaskResult {
  if (!validateEditorialTaskResult(value)) {
    throw new SchemaValidationError('编辑任务结果', validateEditorialTaskResult.errors);
  }
}

export function assertInterviewPlan(value: unknown): asserts value is InterviewPlan {
  if (!validateInterviewPlan(value)) {
    throw new SchemaValidationError('采访计划', validateInterviewPlan.errors);
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

const assertNewsValueAssessment = (result: GenerationResult) => {
  const expectedIds = [
    'timeliness',
    'significance',
    'proximity',
    'conflict',
    'humanInterest',
    'interest',
  ];
  const validOrder = result.newsValueAssessment.dimensions.every(
    (dimension, index) => dimension.id === expectedIds[index],
  );
  const calculatedScore = Number(
    (
      result.newsValueAssessment.dimensions.reduce(
        (total, dimension) => total + dimension.score * dimension.weight,
        0,
      ) * 2
    ).toFixed(1),
  );

  if (
    !validOrder ||
    calculatedScore !== result.newsValueAssessment.overallScore
  ) {
    throw new SchemaValidationError('生成结果', [
      {
        instancePath: '/newsValueAssessment',
        schemaPath: '#/properties/newsValueAssessment',
        keyword: 'methodology',
        params: {},
        message: '六维评分顺序或综合分计算不正确',
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
  assertNewsValueAssessment(value);
}

export function assertVerificationReview(
  value: unknown,
): asserts value is VerificationReview {
  if (!validateVerificationReview(value)) {
    throw new SchemaValidationError(
      '事实核查结果',
      validateVerificationReview.errors,
    );
  }
}

export function assertEditorialRevision(
  value: unknown,
): asserts value is EditorialRevision {
  if (!validateEditorialRevision(value)) {
    throw new SchemaValidationError(
      '编辑终审结果',
      validateEditorialRevision.errors,
    );
  }

  assertAngleOrder(value.content);
}

const throwSemanticValidationError = (
  subject: string,
  instancePath: string,
  message: string,
): never => {
  throw new SchemaValidationError(subject, [
    {
      instancePath,
      schemaPath: '#/semantic-invariants',
      keyword: 'semantic',
      params: {},
      message,
    },
  ]);
};

export const assertVerificationEvidence = (
  review: VerificationReview,
  retrievalContext: RetrievalContext,
) => {
  const validEvidenceIds = new Set(
    retrievalContext.evidence.map((item) => item.id),
  );
  const inventedId = review.factCheck.findings
    .flatMap((finding) => finding.evidenceIds)
    .find((id) => !validEvidenceIds.has(id));

  if (inventedId) {
    throwSemanticValidationError(
      '事实核查结果',
      '/factCheck/findings/evidenceIds',
      `引用了不存在的证据 ID：${inventedId}`,
    );
  }
};

export const assertEditorialResolvesVerification = (
  editorial: EditorialRevision,
  verification: VerificationReview,
) => {
  const finalTasks = new Set([
    ...editorial.content.verificationChecklist,
    ...editorial.decision.finalChecklist,
  ]);
  const missingAction = verification.factCheck.findings
    .filter((finding) => finding.severity === 'high')
    .map((finding) => finding.requiredAction)
    .find((action) => !finalTasks.has(action));

  if (missingAction) {
    throwSemanticValidationError(
      '编辑终审结果',
      '/decision/finalChecklist',
      '遗漏高风险事实核验任务',
    );
  }

  const highRisks = verification.riskReview.items.filter(
    (item) => item.severity === 'high',
  );
  const missingRisk = highRisks.find(
    (item) =>
      !editorial.content.risks.includes(item.description) ||
      !editorial.decision.finalChecklist.includes(item.mitigation),
  );

  if (missingRisk) {
    throwSemanticValidationError(
      '编辑终审结果',
      '/content/risks',
      '遗漏高风险描述或缓解措施',
    );
  }
};
