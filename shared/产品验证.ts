export const NO_REAL_USER_DATA_NOTICE =
  '当前尚未完成真实用户验证。\n以下内容为测试框架或模拟演示数据。';

export const RESEARCH_VALIDATION_NOTICE = '验证不足，不满足 V1.0 研究门槛。';

export const RESEARCH_BUNDLE_SCHEMA_VERSION = 2 as const;

export type AcceptanceStatus =
  | 'not_tested'
  | 'passed'
  | 'failed'
  | 'blocked'
  | 'needs_review';

export interface ManualAcceptanceItem {
  id: string;
  category:
    | 'workflow'
    | 'data_persistence'
    | 'privacy'
    | 'evidence'
    | 'interview'
    | 'export'
    | 'mobile'
    | 'accessibility'
    | 'performance';
  title: string;
  expectedResult: string;
  actualResult?: string;
  status: AcceptanceStatus;
  severityIfFailed: 'critical' | 'high' | 'medium' | 'low';
  screenshotPath?: string;
  notes?: string;
  testedBy?: string;
  testedAt?: string;
}

export interface ResearchParticipant {
  id: string;
  academicYear: 'freshman' | 'sophomore' | 'junior' | 'senior' | 'graduate' | 'other';
  journalismExperience: 'none' | 'beginner' | 'intermediate' | 'experienced';
  campusMediaExperience: boolean;
  priorAiToolExperience: boolean;
  primaryDevice: 'desktop' | 'laptop' | 'tablet' | 'mobile';
  consentConfirmed: boolean;
  synthetic: boolean;
  createdAt: string;
}

export interface ResearchSession {
  id: string;
  participantId: string;
  taskId: string;
  condition: 'newspilot' | 'generic_llm' | 'self_planning';
  startedAt: string;
  completedAt?: string;
  taskCompleted: boolean;
  timeToFirstUsablePlanSeconds?: number;
  totalTaskTimeSeconds?: number;
  majorAssistanceRequired: boolean;
  abandonedStep?: string;
  selectedStrategyId?: string;
  acceptedIntervieweeCount?: number;
  totalSuggestedIntervieweeCount?: number;
  acceptedQuestionCount?: number;
  totalSuggestedQuestionCount?: number;
  majorRewriteRequired?: boolean;
  userKnewNextStep?: boolean;
  userUnderstoodVerificationStatus?: boolean;
  usabilityRating?: number;
  usefulnessRating?: number;
  trustRating?: number;
  reuseIntentRating?: number;
  observedProblems: string[];
  comments: string[];
  synthetic: boolean;
  createdAt: string;
}

export interface UsabilityObservation {
  id: string;
  sessionId: string;
  timestampSeconds?: number;
  eventType:
    | 'hesitation'
    | 'misclick'
    | 'confusion'
    | 'backtrack'
    | 'error'
    | 'request_help'
    | 'abandonment'
    | 'positive_reaction'
    | 'other';
  page: string;
  description: string;
  severity: 'blocking' | 'major' | 'minor' | 'cosmetic';
  createdAt: string;
}

export const PRODUCT_EVENT_NAMES = [
  'project_created',
  'assignment_parsed',
  'strategy_selected',
  'quick_plan_viewed',
  'full_plan_opened',
  'interviewee_added',
  'question_edited',
  'evidence_added',
  'interview_started',
  'interview_completed',
  'quote_confirmed',
  'outline_created',
  'assignment_check_run',
  'export_completed',
  'error_shown',
  'help_requested',
] as const;

export type ProductEventName = typeof PRODUCT_EVENT_NAMES[number];

export interface ProductEvent {
  id: string;
  sessionId: string;
  eventName: ProductEventName;
  page: string;
  timestamp: string;
  metadata?: Record<string, string | number | boolean>;
  synthetic: boolean;
}

export type ProductIssueCategory =
  | 'data_loss'
  | 'privacy'
  | 'fabrication'
  | 'false_verification'
  | 'workflow'
  | 'usability'
  | 'content_quality'
  | 'export'
  | 'mobile'
  | 'performance'
  | 'accessibility'
  | 'documentation'
  | 'other';

export interface ProductIssue {
  id: string;
  title: string;
  description: string;
  category: ProductIssueCategory;
  severity: 'critical' | 'high' | 'medium' | 'low';
  frequency: 'very_common' | 'common' | 'occasional' | 'rare' | 'unknown';
  userImpact: 'blocks_completion' | 'major_friction' | 'minor_friction' | 'cosmetic';
  evidence: {
    sessionIds: string[];
    screenshots: string[];
    notes: string[];
  };
  proposedResolution?: string;
  status: 'new' | 'confirmed' | 'planned' | 'in_progress' | 'resolved' | 'wont_fix' | 'needs_more_data';
  releaseBlocker: boolean;
  createdAt: string;
  updatedAt: string;
}

export interface ReleaseGate {
  id: string;
  name: string;
  description: string;
  type: 'automatic' | 'manual' | 'research';
  required: boolean;
  status: 'not_checked' | 'passed' | 'failed' | 'blocked' | 'waived';
  evidence: string[];
  notes?: string;
  checkedAt?: string;
}

export interface ResearchDataBundle {
  format: 'newspilot-research-bundle';
  schemaVersion: typeof RESEARCH_BUNDLE_SCHEMA_VERSION;
  exportedAt: string;
  participants: ResearchParticipant[];
  sessions: ResearchSession[];
  observations: UsabilityObservation[];
  events: ProductEvent[];
  issues: ProductIssue[];
}

const participantKeys = new Set([
  'id',
  'academicYear',
  'journalismExperience',
  'campusMediaExperience',
  'priorAiToolExperience',
  'primaryDevice',
  'consentConfirmed',
  'synthetic',
  'createdAt',
]);

const isRecord = (value: unknown): value is Record<string, unknown> =>
  Boolean(value) && typeof value === 'object' && !Array.isArray(value);

const validDate = (value: string) => !Number.isNaN(Date.parse(value));

export function createResearchParticipant(
  input: ResearchParticipant,
): ResearchParticipant {
  const unexpected = Object.keys(input).filter((key) => !participantKeys.has(key));
  if (unexpected.length) {
    throw new Error(`参与者数据包含个人信息或禁止字段：${unexpected.join('、')}。`);
  }
  if (!/^P\d{3,}$/u.test(input.id)) {
    throw new Error('参与者必须使用 P001 形式的匿名编号。');
  }
  if (!validDate(input.createdAt)) throw new Error('参与者创建时间无效。');
  return structuredClone(input);
}

const forbiddenMetadataKey =
  /(?:content|text|transcript|audio|recording|api.?key|token|secret|password|path|file|contact|phone|email|wechat|name|student.?id|private|source.?identity|interview.?note)/iu;
const sensitiveString =
  /(?:\bsk-[A-Za-z0-9_-]{8,}\b|[A-Z]:\\Users\\|\b1[3-9]\d{9}\b|[\w.+-]+@[\w.-]+\.[A-Za-z]{2,})/iu;

export function createProductEvent(
  input: Omit<ProductEvent, 'metadata'> & { metadata?: Record<string, unknown> },
): ProductEvent {
  const metadata = Object.fromEntries(
    Object.entries(input.metadata ?? {}).filter(([key, value]) => {
      if (forbiddenMetadataKey.test(key)) return false;
      if (!['string', 'number', 'boolean'].includes(typeof value)) return false;
      return typeof value !== 'string' || !sensitiveString.test(value);
    }),
  ) as Record<string, string | number | boolean>;
  return {
    id: input.id,
    sessionId: input.sessionId,
    eventName: input.eventName,
    page: input.page,
    timestamp: input.timestamp,
    ...(Object.keys(metadata).length ? { metadata } : {}),
    synthetic: input.synthetic,
  };
}

export type ResearchDataFilter = 'real' | 'synthetic' | 'all';

export function filterResearchData(
  bundle: ResearchDataBundle,
  filter: ResearchDataFilter = 'real',
): ResearchDataBundle {
  if (filter === 'all') return structuredClone(bundle);
  const synthetic = filter === 'synthetic';
  const participants = bundle.participants.filter((item) => item.synthetic === synthetic);
  const participantIds = new Set(participants.map((item) => item.id));
  const sessions = bundle.sessions.filter(
    (item) => item.synthetic === synthetic && participantIds.has(item.participantId),
  );
  const sessionIds = new Set(sessions.map((item) => item.id));
  return {
    ...structuredClone(bundle),
    participants: structuredClone(participants),
    sessions: structuredClone(sessions),
    observations: structuredClone(
      bundle.observations.filter((item) => sessionIds.has(item.sessionId)),
    ),
    events: structuredClone(
      bundle.events.filter(
        (item) => item.synthetic === synthetic && sessionIds.has(item.sessionId),
      ),
    ),
    issues: structuredClone(
      bundle.issues.filter(
        (item) => item.evidence.sessionIds.length > 0 &&
          item.evidence.sessionIds.every((sessionId) => sessionIds.has(sessionId)),
      ),
    ),
  };
}

const ratio = (numerator: number, denominator: number) =>
  denominator > 0 ? numerator / denominator : null;

const median = (values: number[]) => {
  if (!values.length) return null;
  const sorted = [...values].sort((left, right) => left - right);
  const middle = Math.floor(sorted.length / 2);
  return sorted.length % 2
    ? sorted[middle]
    : (sorted[middle - 1] + sorted[middle]) / 2;
};

export interface ResearchMetrics {
  sampleSize: number;
  medianTimeToFirstUsablePlanSeconds: number | null;
  taskCompletionRate: number | null;
  nextStepClarityRate: number | null;
  intervieweeAdoptionRate: number | null;
  questionAdoptionRate: number | null;
  majorRewriteRate: number | null;
  validationNotice?: string;
}

export function calculateResearchMetrics(sessions: ResearchSession[]): ResearchMetrics {
  if (!sessions.length) {
    return {
      sampleSize: 0,
      medianTimeToFirstUsablePlanSeconds: null,
      taskCompletionRate: null,
      nextStepClarityRate: null,
      intervieweeAdoptionRate: null,
      questionAdoptionRate: null,
      majorRewriteRate: null,
      validationNotice: RESEARCH_VALIDATION_NOTICE,
    };
  }
  const usableTimes = sessions
    .map((item) => item.timeToFirstUsablePlanSeconds)
    .filter((value): value is number => typeof value === 'number' && value >= 0);
  const nextStepKnown = sessions.filter(
    (item) => typeof item.userKnewNextStep === 'boolean',
  );
  const rewriteObserved = sessions.filter(
    (item) => typeof item.majorRewriteRequired === 'boolean',
  );
  const acceptedInterviewees = sessions.reduce(
    (sum, item) => sum + (item.acceptedIntervieweeCount ?? 0), 0,
  );
  const suggestedInterviewees = sessions.reduce(
    (sum, item) => sum + (item.totalSuggestedIntervieweeCount ?? 0), 0,
  );
  const acceptedQuestions = sessions.reduce(
    (sum, item) => sum + (item.acceptedQuestionCount ?? 0), 0,
  );
  const suggestedQuestions = sessions.reduce(
    (sum, item) => sum + (item.totalSuggestedQuestionCount ?? 0), 0,
  );
  return {
    sampleSize: sessions.length,
    medianTimeToFirstUsablePlanSeconds: median(usableTimes),
    taskCompletionRate: ratio(sessions.filter((item) => item.taskCompleted).length, sessions.length),
    nextStepClarityRate: ratio(
      nextStepKnown.filter((item) => item.userKnewNextStep).length,
      nextStepKnown.length,
    ),
    intervieweeAdoptionRate: ratio(acceptedInterviewees, suggestedInterviewees),
    questionAdoptionRate: ratio(acceptedQuestions, suggestedQuestions),
    majorRewriteRate: ratio(
      rewriteObserved.filter((item) => item.majorRewriteRequired).length,
      rewriteObserved.length,
    ),
  };
}

export function compareResearchRounds(
  before: ResearchSession[],
  after: ResearchSession[],
) {
  const sampleSizes = { before: before.length, after: after.length };
  if (before.length < 2 || after.length < 2) {
    return { outcome: '样本不足' as const, sampleSizes };
  }
  const beforeRate = calculateResearchMetrics(before).taskCompletionRate ?? 0;
  const afterRate = calculateResearchMetrics(after).taskCompletionRate ?? 0;
  const delta = afterRate - beforeRate;
  const outcome = delta > 0.05 ? '改善' : delta < -0.05 ? '恶化' : '无明显变化';
  return { outcome, sampleSizes, beforeRate, afterRate };
}

const criticalCategories = new Set<ProductIssueCategory>([
  'data_loss',
  'privacy',
  'fabrication',
  'false_verification',
]);

export function prioritizeProductIssue(issue: ProductIssue): ProductIssue {
  const criticalByContent =
    /(?:off[ -]?the[ -]?record|未确认引语|虚构直接引语|导出文件损坏|旧项目无法打开)/iu.test(
      `${issue.title} ${issue.description}`,
    );
  const critical =
    criticalCategories.has(issue.category) ||
    criticalByContent ||
    issue.userImpact === 'blocks_completion';
  const high =
    ['mobile', 'export'].includes(issue.category) ||
    issue.userImpact === 'major_friction' ||
    issue.frequency === 'very_common';
  return {
    ...structuredClone(issue),
    severity: critical ? 'critical' : high ? 'high' : issue.severity,
    releaseBlocker: critical || issue.releaseBlocker,
  };
}

export function productIssuePriorityScore(issue: ProductIssue) {
  const normalized = prioritizeProductIssue(issue);
  const severity = { critical: 100, high: 60, medium: 30, low: 10 }[normalized.severity];
  const frequency = { very_common: 25, common: 18, occasional: 10, rare: 4, unknown: 0 }[normalized.frequency];
  const impact = { blocks_completion: 30, major_friction: 20, minor_friction: 8, cosmetic: 1 }[normalized.userImpact];
  return severity + frequency + impact + (normalized.releaseBlocker ? 20 : 0);
}

const gate = (
  id: string,
  name: string,
  type: ReleaseGate['type'],
  description = name,
): ReleaseGate => ({
  id,
  name,
  description,
  type,
  required: true,
  status: 'not_checked',
  evidence: [],
});

export function createReleaseGateCatalog(): ReleaseGate[] {
  return [
    gate('auto-unit', '单元测试通过', 'automatic'),
    gate('auto-integration', '集成测试通过', 'automatic'),
    gate('auto-e2e', '端到端测试通过', 'automatic'),
    gate('auto-build', '生产构建通过', 'automatic'),
    gate('auto-evals', 'P0、P1、P2、P3 评测通过', 'automatic'),
    gate('auto-security', '没有 Critical 安全漏洞', 'automatic'),
    gate('auto-secrets', '没有真实密钥且未跟踪 .env', 'automatic'),
    gate('auto-migration', '旧项目数据迁移通过', 'automatic'),
    gate('auto-export-open', '导出文件可正常打开', 'automatic'),
    gate('manual-three-projects', '三个完整报道项目人工跑通', 'manual'),
    gate('manual-mobile-interview', '手机采访模式可用', 'manual'),
    gate('manual-word-cn', 'Word 中文排版正常', 'manual'),
    gate('manual-private-export', '私人联系方式不进入课程导出', 'manual'),
    gate('manual-unconfirmed-quote', '未确认引语不进入导出', 'manual'),
    gate('manual-offrecord', 'off the record 内容不进入导出', 'manual'),
    gate('manual-delete', '删除项目后数据确实被删除', 'manual'),
    gate('manual-persistence', '刷新页面后本地项目仍然存在', 'manual'),
    gate('research-round', '至少完成一轮真实用户测试', 'research'),
    gate('research-separation', '真实数据与模拟数据分离', 'research'),
    gate('research-sample', '样本量已明确', 'research'),
    gate('research-high-issues', '高优先级问题已处理', 'research'),
    gate('research-no-critical', '没有未解决的 Critical 问题', 'research'),
    gate('research-completion', '核心流程完成率达到可接受水平', 'research'),
    gate('research-boundary', '用户理解产品边界', 'research'),
    gate('research-journalism-boundary', '用户知道产品不替代采访与核查', 'research'),
  ];
}

export type FeatureFreezeChange =
  | 'bug_fix'
  | 'core_usability'
  | 'security'
  | 'privacy'
  | 'export_fix'
  | 'documentation'
  | 'test'
  | 'accessibility'
  | 'critical_copy'
  | 'new_provider'
  | 'new_agent'
  | 'new_workflow'
  | 'cloud_account'
  | 'collaboration'
  | 'full_article_generation'
  | 'automatic_publishing'
  | 'payment'
  | 'monitoring_dashboard'
  | 'nonessential_animation';

const allowedFrozenChanges = new Set<FeatureFreezeChange>([
  'bug_fix',
  'core_usability',
  'security',
  'privacy',
  'export_fix',
  'documentation',
  'test',
  'accessibility',
  'critical_copy',
]);

export function isFeatureFreezeCompliant(changes: FeatureFreezeChange[]) {
  return changes.every((change) => allowedFrozenChanges.has(change));
}

export interface ReleaseReadiness {
  recommendation: 'v1' | 'beta' | 'hold';
  version: 'v1.1.0' | 'v1.1.0-beta.1' | null;
  message: string;
  blockingGateIds: string[];
}

export function evaluateReleaseReadiness(input: {
  gates: ReleaseGate[];
  issues: ProductIssue[];
  realSessionCount: number;
}): ReleaseReadiness {
  const unresolvedCritical = input.issues
    .map(prioritizeProductIssue)
    .filter(
      (issue) => issue.releaseBlocker && issue.severity === 'critical' &&
        !['resolved', 'wont_fix'].includes(issue.status),
    );
  if (unresolvedCritical.length) {
    return {
      recommendation: 'hold',
      version: null,
      message: '存在未解决的 Critical 发布阻断问题，暂不建议发布 Release。',
      blockingGateIds: unresolvedCritical.map((issue) => issue.id),
    };
  }
  const functionalBlockers = input.gates.filter(
    (item) => item.required && item.type !== 'research' && item.status !== 'passed',
  );
  if (functionalBlockers.length) {
    return {
      recommendation: 'hold',
      version: null,
      message: '自动或人工发布门槛尚未全部通过，暂不建议发布 Release。',
      blockingGateIds: functionalBlockers.map((item) => item.id),
    };
  }
  const researchBlockers = input.gates.filter(
    (item) => item.required && item.type === 'research' && item.status !== 'passed',
  );
  if (input.realSessionCount === 0 || researchBlockers.length) {
    return {
      recommendation: 'beta',
      version: 'v1.1.0-beta.1',
      message: RESEARCH_VALIDATION_NOTICE,
      blockingGateIds: researchBlockers.map((item) => item.id),
    };
  }
  return {
    recommendation: 'v1',
    version: 'v1.1.0',
    message: '全部必需发布门槛已通过，可以复核 v1.1.0 稳定版发布。',
    blockingGateIds: [],
  };
}

const bundleSensitiveKey = /^(?:personName|fullName|studentName|contactName|studentId|phone|email|wechat|authenticationToken|accessToken|refreshToken|apiKey|privateKey|address|privateNote)$/iu;

const rejectSensitiveFields = (value: unknown, path = 'root'): void => {
  if (Array.isArray(value)) {
    value.forEach((item, index) => rejectSensitiveFields(item, `${path}[${index}]`));
    return;
  }
  if (!isRecord(value)) return;
  for (const [key, nested] of Object.entries(value)) {
    if (bundleSensitiveKey.test(key)) {
      throw new Error(`研究包包含禁止的个人信息字段：${path}.${key}。`);
    }
    if (typeof nested === 'string' && sensitiveString.test(nested)) {
      throw new Error(`研究包疑似包含个人信息或密钥：${path}.${key}。`);
    }
    rejectSensitiveFields(nested, `${path}.${key}`);
  }
};

export function parseResearchDataBundle(serialized: string): ResearchDataBundle {
  let value: unknown;
  try {
    value = JSON.parse(serialized);
  } catch {
    throw new Error('研究包不是有效 JSON。');
  }
  if (
    !isRecord(value) ||
    value.format !== 'newspilot-research-bundle' ||
    !(
      value.schemaVersion === RESEARCH_BUNDLE_SCHEMA_VERSION ||
      (value.dataVersion === 1 && !Object.hasOwn(value, 'schemaVersion'))
    ) ||
    typeof value.exportedAt !== 'string' ||
    !validDate(value.exportedAt) ||
    !Array.isArray(value.participants) ||
    !Array.isArray(value.sessions) ||
    !Array.isArray(value.observations) ||
    !Array.isArray(value.events) ||
    !Array.isArray(value.issues)
  ) {
    throw new Error('研究包格式、版本或必需字段无效。');
  }
  rejectSensitiveFields(value);
  const participants = value.participants.map((item) => {
    if (!isRecord(item)) throw new Error('参与者记录无效。');
    return createResearchParticipant(item as unknown as ResearchParticipant);
  });
  const participantIds = new Set(participants.map((item) => item.id));
  const sessions = value.sessions as unknown as ResearchSession[];
  if (sessions.some((item) => !participantIds.has(item.participantId))) {
    throw new Error('研究场次引用了不存在的匿名参与者。');
  }
  const eventNames = new Set<string>(PRODUCT_EVENT_NAMES);
  const events = value.events.map((item) => {
    if (!isRecord(item)) throw new Error('产品事件记录无效。');
    const currentEventName = item.eventName;
    const legacyEventName = item.name;
    if (
      currentEventName !== undefined &&
      legacyEventName !== undefined &&
      currentEventName !== legacyEventName
    ) {
      throw new Error('产品事件同时包含冲突的 eventName 与旧 name 字段。');
    }
    const eventName = currentEventName ?? legacyEventName;
    if (
      typeof item.id !== 'string' || !item.id.trim() ||
      typeof item.sessionId !== 'string' || !item.sessionId.trim() ||
      typeof eventName !== 'string' || !eventNames.has(eventName) ||
      typeof item.page !== 'string' || !item.page.trim() ||
      typeof item.timestamp !== 'string' || !validDate(item.timestamp) ||
      typeof item.synthetic !== 'boolean' ||
      (item.metadata !== undefined && !isRecord(item.metadata))
    ) {
      throw new Error('产品事件字段或事件名称无效。');
    }
    return createProductEvent({
      id: item.id,
      sessionId: item.sessionId,
      eventName: eventName as ProductEventName,
      page: item.page,
      timestamp: item.timestamp,
      metadata: item.metadata,
      synthetic: item.synthetic,
    });
  });
  return {
    format: 'newspilot-research-bundle',
    schemaVersion: RESEARCH_BUNDLE_SCHEMA_VERSION,
    exportedAt: value.exportedAt,
    participants,
    sessions: structuredClone(sessions),
    observations: structuredClone(value.observations as unknown as UsabilityObservation[]),
    events,
    issues: structuredClone(value.issues as unknown as ProductIssue[]),
  };
}

export function serializeResearchDataBundle(bundle: ResearchDataBundle) {
  const normalized = parseResearchDataBundle(JSON.stringify(bundle));
  return JSON.stringify(normalized, null, 2);
}
