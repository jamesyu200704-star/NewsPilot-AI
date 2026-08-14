import assert from 'node:assert/strict';
import test from 'node:test';
import {
  blindReviewDimensions,
  canRevealBlindComparison,
  createBlindComparison,
  finalizeBlindComparison,
  type BlindReviewScore,
} from '../../shared/人工盲评.js';
import {
  RESEARCH_VALIDATION_NOTICE,
  calculateResearchMetrics,
  compareResearchRounds,
  createProductEvent,
  createResearchParticipant,
  createReleaseGateCatalog,
  evaluateReleaseReadiness,
  filterResearchData,
  isFeatureFreezeCompliant,
  parseResearchDataBundle,
  prioritizeProductIssue,
  type ProductIssue,
  type ResearchDataBundle,
  type ResearchSession,
} from '../../shared/产品验证.js';

const realSession: ResearchSession = {
  id: 'session-real-001',
  participantId: 'P001',
  taskId: 'campus-investigation',
  condition: 'newspilot',
  startedAt: '2026-08-13T09:00:00.000Z',
  completedAt: '2026-08-13T09:08:00.000Z',
  taskCompleted: true,
  timeToFirstUsablePlanSeconds: 480,
  totalTaskTimeSeconds: 900,
  majorAssistanceRequired: false,
  acceptedIntervieweeCount: 3,
  totalSuggestedIntervieweeCount: 4,
  acceptedQuestionCount: 5,
  totalSuggestedQuestionCount: 8,
  majorRewriteRequired: false,
  userKnewNextStep: true,
  userUnderstoodVerificationStatus: true,
  observedProblems: [],
  comments: [],
  synthetic: false,
  createdAt: '2026-08-13T09:00:00.000Z',
};

const syntheticSession: ResearchSession = {
  ...realSession,
  id: 'session-synthetic-001',
  participantId: 'P900',
  synthetic: true,
};

test('研究参与者只接受匿名编号，且不允许夹带个人信息字段', () => {
  const participant = createResearchParticipant({
    id: 'P001',
    academicYear: 'sophomore',
    journalismExperience: 'beginner',
    campusMediaExperience: false,
    priorAiToolExperience: true,
    primaryDevice: 'laptop',
    consentConfirmed: true,
    synthetic: false,
    createdAt: '2026-08-13T08:00:00.000Z',
  });
  assert.equal(participant.id, 'P001');
  assert.throws(
    () => createResearchParticipant({ ...participant, id: '真实姓名' }),
    /匿名编号/u,
  );
  assert.throws(
    () => createResearchParticipant({ ...participant, email: 'person@example.com' } as never),
    /个人信息|禁止字段/u,
  );
});

test('真实研究与模拟研究数据严格分离，指标默认不混合', () => {
  const bundle: ResearchDataBundle = {
    format: 'newspilot-research-bundle',
    schemaVersion: 2,
    exportedAt: '2026-08-13T10:00:00.000Z',
    participants: [
      createResearchParticipant({
        id: 'P001', academicYear: 'sophomore', journalismExperience: 'beginner',
        campusMediaExperience: false, priorAiToolExperience: true, primaryDevice: 'laptop',
        consentConfirmed: true, synthetic: false, createdAt: '2026-08-13T08:00:00.000Z',
      }),
      createResearchParticipant({
        id: 'P900', academicYear: 'other', journalismExperience: 'none',
        campusMediaExperience: false, priorAiToolExperience: false, primaryDevice: 'desktop',
        consentConfirmed: true, synthetic: true, createdAt: '2026-08-13T08:00:00.000Z',
      }),
    ],
    sessions: [realSession, syntheticSession],
    observations: [],
    events: [],
    issues: [],
  };

  const realOnly = filterResearchData(bundle, 'real');
  const syntheticOnly = filterResearchData(bundle, 'synthetic');
  assert.deepEqual(realOnly.sessions.map((item) => item.id), ['session-real-001']);
  assert.deepEqual(syntheticOnly.sessions.map((item) => item.id), ['session-synthetic-001']);
  const metrics = calculateResearchMetrics(realOnly.sessions);
  assert.equal(metrics.sampleSize, 1);
  assert.equal(metrics.medianTimeToFirstUsablePlanSeconds, 480);
  assert.equal(metrics.taskCompletionRate, 1);
  assert.equal(calculateResearchMetrics([]).validationNotice, RESEARCH_VALIDATION_NOTICE);
});

test('产品事件只保留标量、非敏感元数据', () => {
  const event = createProductEvent({
    id: 'event-001',
    sessionId: 'session-real-001',
    eventName: 'question_edited',
    page: 'interview-guide',
    timestamp: '2026-08-13T09:05:00.000Z',
    metadata: {
      count: 2,
      successful: true,
      transcript: '未经同意的逐字稿',
      apiKey: 'sk-not-a-real-key',
      localPath: 'C:\\Users\\person\\private.txt',
      nested: { forbidden: true },
    } as never,
    synthetic: false,
  });
  assert.deepEqual(event.metadata, { count: 2, successful: true });
  assert.equal((event as unknown as Record<string, unknown>).eventName, 'question_edited');
  assert.equal(Object.hasOwn(event, 'name'), false);
  assert.doesNotMatch(JSON.stringify(event), /逐字稿|sk-|C:\\\\Users/u);
});

test('研究包把旧 ProductEvent.name 迁移为 eventName 并升级结构版本', () => {
  const legacy = {
    format: 'newspilot-research-bundle',
    dataVersion: 1,
    exportedAt: '2026-08-13T10:00:00.000Z',
    participants: [],
    sessions: [],
    observations: [],
    events: [{
      id: 'event-legacy-001',
      sessionId: 'session-legacy-001',
      name: 'project_created',
      page: 'project-bar',
      timestamp: '2026-08-13T09:00:00.000Z',
      synthetic: true,
    }],
    issues: [],
  };

  const migrated = parseResearchDataBundle(JSON.stringify(legacy));
  assert.equal((migrated as unknown as Record<string, unknown>).schemaVersion, 2);
  assert.equal(Object.hasOwn(migrated, 'dataVersion'), false);
  assert.equal(migrated.events[0].eventName, 'project_created');
  assert.equal(Object.hasOwn(migrated.events[0], 'name'), false);
});

test('研究包隐私验证继续拒绝明确的身份、联系方式和凭据字段', () => {
  const bundle = {
    format: 'newspilot-research-bundle',
    schemaVersion: 2,
    exportedAt: '2026-08-13T10:00:00.000Z',
    participants: [], sessions: [], observations: [], events: [], issues: [],
  };
  const forbidden = [
    'personName', 'fullName', 'studentName', 'contactName',
    'phone', 'email', 'wechat', 'authenticationToken', 'privateNote',
  ];
  for (const field of forbidden) {
    assert.throws(
      () => parseResearchDataBundle(JSON.stringify({ ...bundle, [field]: '禁止保存' })),
      /个人信息|禁止/u,
      field,
    );
  }
});

test('匿名对照评测包含 13 个带 Rubric 的维度，评分提交前不可揭盲', () => {
  assert.equal(blindReviewDimensions.length, 13);
  assert.ok(blindReviewDimensions.every((dimension) => dimension.rubric[1] && dimension.rubric[5]));
  const comparison = createBlindComparison({
    caseId: 'case-001',
    outputs: [
      { source: 'newspilot', content: 'NewsPilot 方案内容' },
      { source: 'general_model', content: 'ChatGPT 方案内容' },
      { source: 'student', content: '学生自行策划内容' },
    ],
  }, 7);
  assert.equal(canRevealBlindComparison(comparison.packet, []), false);
  assert.doesNotMatch(
    JSON.stringify(comparison.packet),
    /"(?:newspilot|general_model|student)"|ChatGPT|学生自行策划/u,
  );

  const scores: BlindReviewScore[] = comparison.packet.variants.map(({ anonymousId }) => ({
    anonymousId,
    scores: Object.fromEntries(
      blindReviewDimensions.map(({ key }) => [key, 4]),
    ) as BlindReviewScore['scores'],
    comment: '',
  }));
  assert.equal(canRevealBlindComparison(comparison.packet, scores), true);
  assert.equal(Object.keys(finalizeBlindComparison(comparison, scores).revealKey).length, 3);
  const invalid = structuredClone(scores);
  invalid[0].scores.newsQuestionClarity = 6;
  assert.throws(() => finalizeBlindComparison(comparison, invalid), /1—5/u);
});

test('问题分级把隐私、数据丢失、虚构和错误核实设为发布阻断', () => {
  const issue: ProductIssue = {
    id: 'issue-001',
    title: '课程导出包含私人联系方式',
    description: '匿名导出中出现了测试联系方式。',
    category: 'privacy',
    severity: 'medium',
    frequency: 'rare',
    userImpact: 'major_friction',
    evidence: { sessionIds: ['session-real-001'], screenshots: [], notes: [] },
    status: 'confirmed',
    releaseBlocker: false,
    createdAt: '2026-08-13T10:00:00.000Z',
    updatedAt: '2026-08-13T10:00:00.000Z',
  };
  const prioritized = prioritizeProductIssue(issue);
  assert.equal(prioritized.severity, 'critical');
  assert.equal(prioritized.releaseBlocker, true);
});

test('没有真实研究时只允许 Beta，未解决 Critical 时不得发布', () => {
  const gates = createReleaseGateCatalog().map((gate) =>
    gate.type === 'research'
      ? { ...gate, status: 'blocked' as const }
      : { ...gate, status: 'passed' as const },
  );
  const beta = evaluateReleaseReadiness({ gates, issues: [], realSessionCount: 0 });
  assert.equal(beta.recommendation, 'beta');
  assert.equal(beta.version, 'v1.1.0-beta.1');
  assert.equal(beta.message, RESEARCH_VALIDATION_NOTICE);

  const critical = prioritizeProductIssue({
    id: 'issue-critical', title: '数据丢失', description: '项目刷新后丢失',
    category: 'data_loss', severity: 'critical', frequency: 'rare',
    userImpact: 'blocks_completion', evidence: { sessionIds: [], screenshots: [], notes: [] },
    status: 'confirmed', releaseBlocker: true,
    createdAt: '2026-08-13T10:00:00.000Z', updatedAt: '2026-08-13T10:00:00.000Z',
  });
  const blocked = evaluateReleaseReadiness({ gates, issues: [critical], realSessionCount: 0 });
  assert.equal(blocked.recommendation, 'hold');
});

test('功能冻结只允许修复、文档、测试、安全、隐私、导出、无障碍和关键文案', () => {
  assert.equal(isFeatureFreezeCompliant(['bug_fix', 'documentation', 'test']), true);
  assert.equal(isFeatureFreezeCompliant(['new_provider']), false);
  assert.equal(isFeatureFreezeCompliant(['new_workflow']), false);
});

test('第二轮对比始终显示两个样本量，样本不足时不下强结论', () => {
  const insufficient = compareResearchRounds([realSession], []);
  assert.equal(insufficient.outcome, '样本不足');
  assert.deepEqual(insufficient.sampleSizes, { before: 1, after: 0 });
});
