import type {
  GenerationResult,
  NewsValueDimensionId,
  StoryAngle,
  StoryAngleId,
} from './generation.js';

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
const topicAnalysisKeys = new Set([
  'category',
  'summary',
  'coreConflict',
  'stakeholders',
  'evidenceGaps',
]);
const dimensionKeys = new Set(['id', 'label', 'score', 'weight', 'rationale']);
const assessmentKeys = new Set([
  'dimensions',
  'overallScore',
  'confidence',
  'summary',
]);
const ruleMatchKeys = new Set(['id', 'title', 'reason']);
const ruleDecisionKeys = new Set([
  'matches',
  'requiredInterviewees',
  'requiredSources',
  'verificationPriorities',
  'riskFlags',
]);
const retrievalEvidenceRequiredKeys = new Set([
  'id',
  'origin',
  'sourceType',
  'title',
  'summary',
  'relevanceScore',
]);
const retrievalEvidenceAllowedKeys = new Set([
  ...retrievalEvidenceRequiredKeys,
  'query',
  'sourceName',
  'sourceUrl',
  'publishedAt',
]);
const retrievalRequiredKeys = new Set([
  'queries',
  'evidence',
  'searchProvider',
  'searchStatus',
  'retrievedAt',
]);
const retrievalAllowedKeys = new Set([...retrievalRequiredKeys, 'notice']);
const factFindingKeys = new Set([
  'id',
  'severity',
  'category',
  'claim',
  'status',
  'assessment',
  'requiredAction',
  'evidenceIds',
]);
const factCheckKeys = new Set([
  'summary',
  'findings',
  'unsupportedClaims',
  'ethicsNotes',
]);
const riskItemKeys = new Set([
  'id',
  'severity',
  'category',
  'description',
  'mitigation',
]);
const riskReviewKeys = new Set(['overallRisk', 'releaseGate', 'items']);
const verificationKeys = new Set(['factCheck', 'riskReview']);
const editorialKeys = new Set([
  'disposition',
  'priorityAngleId',
  'rationale',
  'changes',
  'finalChecklist',
]);
const traceKeys = new Set(['agent', 'status', 'mode', 'summary']);
const agentReviewKeys = new Set([
  'workflowVersion',
  'verification',
  'editorial',
  'trace',
]);
const contentKeys = new Set([
  'topicSummary',
  'angles',
  'dataNeeds',
  'verificationChecklist',
  'risks',
  'nextActions',
]);
const requiredResultKeys = new Set([
  ...contentKeys,
  'topicAnalysis',
  'newsValueAssessment',
  'ruleDecision',
  'retrievalContext',
  'agentReview',
  'generatedAt',
  'mode',
]);
const allowedResultKeys = new Set([...requiredResultKeys, 'fallbackNotice']);
const angleIds: StoryAngleId[] = ['people', 'system', 'trend'];
const dimensionIds: NewsValueDimensionId[] = [
  'timeliness',
  'significance',
  'proximity',
  'conflict',
  'humanInterest',
  'interest',
];

const isRecord = (value: unknown): value is JsonRecord =>
  typeof value === 'object' && value !== null && !Array.isArray(value);

const hasExactKeys = (value: JsonRecord, expectedKeys: Set<string>) => {
  const keys = Object.keys(value);
  return (
    keys.length === expectedKeys.size &&
    keys.every((key) => expectedKeys.has(key))
  );
};

const hasAllowedAndRequiredKeys = (
  value: JsonRecord,
  allowedKeys: Set<string>,
  requiredKeys: Set<string>,
) => {
  const keys = Object.keys(value);
  return (
    keys.every((key) => allowedKeys.has(key)) &&
    [...requiredKeys].every((key) => Object.hasOwn(value, key))
  );
};

const isBoundedText = (value: unknown, maxLength = 1600) =>
  typeof value === 'string' &&
  value.length <= maxLength &&
  /\S/u.test(value);

const isTextArray = (
  value: unknown,
  minimum: number,
  maximum: number,
) =>
  Array.isArray(value) &&
  value.length >= minimum &&
  value.length <= maximum &&
  value.every((item) => isBoundedText(item));

const isStoryAngle = (value: unknown, expectedId: StoryAngleId): value is StoryAngle => {
  if (!isRecord(value) || !hasExactKeys(value, angleKeys)) {
    return false;
  }

  return (
    value.id === expectedId &&
    isBoundedText(value.title, 240) &&
    isBoundedText(value.perspective) &&
    typeof value.newsValueScore === 'number' &&
    Number.isFinite(value.newsValueScore) &&
    value.newsValueScore >= 0 &&
    value.newsValueScore <= 5 &&
    isBoundedText(value.whyWorthReporting) &&
    isTextArray(value.newsValue, 3, 3) &&
    isTextArray(value.interviewees, 4, 4) &&
    isTextArray(value.interviewQuestions, 6, 6) &&
    isTextArray(value.verificationChecklist, 4, 4) &&
    isTextArray(value.risks, 3, 3) &&
    isTextArray(value.nextActions, 3, 3)
  );
};

const isTopicAnalysis = (value: unknown) =>
  isRecord(value) &&
  hasExactKeys(value, topicAnalysisKeys) &&
  ['education', 'policy', 'consumer', 'technology', 'general'].includes(
    String(value.category),
  ) &&
  isBoundedText(value.summary) &&
  isBoundedText(value.coreConflict) &&
  isTextArray(value.stakeholders, 3, 24) &&
  isTextArray(value.evidenceGaps, 2, 16);

const isNewsValueDimension = (
  value: unknown,
  expectedId: NewsValueDimensionId,
) =>
  isRecord(value) &&
  hasExactKeys(value, dimensionKeys) &&
  value.id === expectedId &&
  isBoundedText(value.label) &&
  typeof value.score === 'number' &&
  Number.isFinite(value.score) &&
  value.score >= 0 &&
  value.score <= 5 &&
  typeof value.weight === 'number' &&
  Number.isFinite(value.weight) &&
  value.weight >= 0 &&
  value.weight <= 1 &&
  isBoundedText(value.rationale);

const isNewsValueAssessment = (value: unknown) =>
  isRecord(value) &&
  hasExactKeys(value, assessmentKeys) &&
  Array.isArray(value.dimensions) &&
  value.dimensions.length === dimensionIds.length &&
  value.dimensions.every((item, index) =>
    isNewsValueDimension(item, dimensionIds[index]),
  ) &&
  typeof value.overallScore === 'number' &&
  Number.isFinite(value.overallScore) &&
  value.overallScore >= 0 &&
  value.overallScore <= 10 &&
  ['low', 'medium', 'high'].includes(String(value.confidence)) &&
  isBoundedText(value.summary);

const isRuleMatch = (value: unknown) =>
  isRecord(value) &&
  hasExactKeys(value, ruleMatchKeys) &&
  isBoundedText(value.id) &&
  isBoundedText(value.title) &&
  isBoundedText(value.reason);

const isRuleDecision = (value: unknown) =>
  isRecord(value) &&
  hasExactKeys(value, ruleDecisionKeys) &&
  Array.isArray(value.matches) &&
  value.matches.length >= 1 &&
  value.matches.length <= 8 &&
  value.matches.every(isRuleMatch) &&
  isTextArray(value.requiredInterviewees, 3, 24) &&
  isTextArray(value.requiredSources, 2, 16) &&
  isTextArray(value.verificationPriorities, 2, 16) &&
  isTextArray(value.riskFlags, 2, 16);

const isRetrievalEvidence = (value: unknown) =>
  isRecord(value) &&
  hasAllowedAndRequiredKeys(
    value,
    retrievalEvidenceAllowedKeys,
    retrievalEvidenceRequiredKeys,
  ) &&
  isBoundedText(value.id) &&
  ['knowledge', 'search'].includes(String(value.origin)) &&
  [
    'news',
    'policy',
    'data',
    'case',
    'news-value',
    'case-pattern',
    'interview-strategy',
  ].includes(String(value.sourceType)) &&
  isBoundedText(value.title) &&
  isBoundedText(value.summary) &&
  typeof value.relevanceScore === 'number' &&
  Number.isFinite(value.relevanceScore) &&
  value.relevanceScore >= 0 &&
  value.relevanceScore <= 1 &&
  (!Object.hasOwn(value, 'query') || isBoundedText(value.query)) &&
  (!Object.hasOwn(value, 'sourceName') || isBoundedText(value.sourceName)) &&
  (!Object.hasOwn(value, 'sourceUrl') ||
    (isBoundedText(value.sourceUrl, 2048) &&
      /^https?:\/\//u.test(String(value.sourceUrl)))) &&
  (!Object.hasOwn(value, 'publishedAt') ||
    isBoundedText(value.publishedAt));

const isRetrievalContext = (value: unknown) =>
  isRecord(value) &&
  hasAllowedAndRequiredKeys(
    value,
    retrievalAllowedKeys,
    retrievalRequiredKeys,
  ) &&
  isTextArray(value.queries, 4, 6) &&
  Array.isArray(value.evidence) &&
  value.evidence.length >= 1 &&
  value.evidence.length <= 16 &&
  value.evidence.every(isRetrievalEvidence) &&
  ['mock', 'brave'].includes(String(value.searchProvider)) &&
  ['mock', 'live', 'failed'].includes(String(value.searchStatus)) &&
  typeof value.retrievedAt === 'string' &&
  !Number.isNaN(Date.parse(value.retrievedAt)) &&
  (!Object.hasOwn(value, 'notice') || isBoundedText(value.notice, 240));

const isSeverity = (value: unknown) =>
  ['low', 'medium', 'high'].includes(String(value));

const isFactFinding = (value: unknown) =>
  isRecord(value) &&
  hasExactKeys(value, factFindingKeys) &&
  isBoundedText(value.id) &&
  isSeverity(value.severity) &&
  ['source', 'fabrication', 'data', 'ethics', 'balance'].includes(
    String(value.category),
  ) &&
  isBoundedText(value.claim) &&
  [
    'supported',
    'partially-supported',
    'unsupported',
    'needs-verification',
  ].includes(String(value.status)) &&
  isBoundedText(value.assessment) &&
  isBoundedText(value.requiredAction) &&
  isTextArray(value.evidenceIds, 0, 6);

const isRiskItem = (value: unknown) =>
  isRecord(value) &&
  hasExactKeys(value, riskItemKeys) &&
  isBoundedText(value.id) &&
  isSeverity(value.severity) &&
  ['privacy', 'ethics', 'legal', 'balance', 'safety'].includes(
    String(value.category),
  ) &&
  isBoundedText(value.description) &&
  isBoundedText(value.mitigation);

const isVerificationReview = (value: unknown) => {
  if (!isRecord(value) || !hasExactKeys(value, verificationKeys)) return false;
  if (
    !isRecord(value.factCheck) ||
    !hasExactKeys(value.factCheck, factCheckKeys) ||
    !isBoundedText(value.factCheck.summary) ||
    !Array.isArray(value.factCheck.findings) ||
    value.factCheck.findings.length < 3 ||
    value.factCheck.findings.length > 12 ||
    !value.factCheck.findings.every(isFactFinding) ||
    !isTextArray(value.factCheck.unsupportedClaims, 0, 10) ||
    !isTextArray(value.factCheck.ethicsNotes, 2, 8)
  ) {
    return false;
  }

  return (
    isRecord(value.riskReview) &&
    hasExactKeys(value.riskReview, riskReviewKeys) &&
    isSeverity(value.riskReview.overallRisk) &&
    ['hold', 'proceed-with-verification'].includes(
      String(value.riskReview.releaseGate),
    ) &&
    Array.isArray(value.riskReview.items) &&
    value.riskReview.items.length >= 2 &&
    value.riskReview.items.length <= 10 &&
    value.riskReview.items.every(isRiskItem)
  );
};

const isEditorialDecision = (value: unknown) =>
  isRecord(value) &&
  hasExactKeys(value, editorialKeys) &&
  ['needs-reporting', 'ready-for-reporting'].includes(
    String(value.disposition),
  ) &&
  angleIds.includes(value.priorityAngleId as StoryAngleId) &&
  isBoundedText(value.rationale) &&
  isTextArray(value.changes, 2, 8) &&
  isTextArray(value.finalChecklist, 4, 12);

const isAgentTraceStep = (value: unknown, expectedAgent: string) =>
  isRecord(value) &&
  hasExactKeys(value, traceKeys) &&
  value.agent === expectedAgent &&
  ['completed', 'fallback'].includes(String(value.status)) &&
  ['mock', 'ollama', 'qwen', 'openai'].includes(String(value.mode)) &&
  isBoundedText(value.summary);

const isAgentReview = (value: unknown) =>
  isRecord(value) &&
  hasExactKeys(value, agentReviewKeys) &&
  value.workflowVersion === 'news-agent-v1' &&
  isVerificationReview(value.verification) &&
  isEditorialDecision(value.editorial) &&
  Array.isArray(value.trace) &&
  value.trace.length === 3 &&
  isAgentTraceStep(value.trace[0], 'planning') &&
  isAgentTraceStep(value.trace[1], 'fact-check') &&
  isAgentTraceStep(value.trace[2], 'editor');

export const isRuntimeGenerationResult = (
  value: unknown,
): value is GenerationResult => {
  if (
    !isRecord(value) ||
    !hasAllowedAndRequiredKeys(value, allowedResultKeys, requiredResultKeys)
  ) {
    return false;
  }

  return (
    isBoundedText(value.topicSummary, 800) &&
    Array.isArray(value.angles) &&
    value.angles.length === angleIds.length &&
    value.angles.every((angle, index) => isStoryAngle(angle, angleIds[index])) &&
    isTextArray(value.dataNeeds, 4, 10) &&
    isTextArray(value.verificationChecklist, 4, 12) &&
    isTextArray(value.risks, 3, 10) &&
    isTextArray(value.nextActions, 3, 8) &&
    isTopicAnalysis(value.topicAnalysis) &&
    isNewsValueAssessment(value.newsValueAssessment) &&
    isRuleDecision(value.ruleDecision) &&
    isRetrievalContext(value.retrievalContext) &&
    isAgentReview(value.agentReview) &&
    typeof value.generatedAt === 'string' &&
    !Number.isNaN(Date.parse(value.generatedAt)) &&
    (value.mode === 'mock' ||
      value.mode === 'ollama' ||
      value.mode === 'qwen' ||
      value.mode === 'openai') &&
    (!Object.hasOwn(value, 'fallbackNotice') ||
      isBoundedText(value.fallbackNotice, 240))
  );
};

export function assertRuntimeGenerationResult(
  value: unknown,
): asserts value is GenerationResult {
  if (!isRuntimeGenerationResult(value)) {
    throw new Error('API 返回内容不符合 GenerationResult 结构。');
  }
}
