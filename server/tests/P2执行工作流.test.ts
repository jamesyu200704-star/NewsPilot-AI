import assert from 'node:assert/strict';
import test from 'node:test';
import { createStudentReportingPlan } from '../../shared/学生报道工作流.js';
import type { ReportingBrief } from '../../shared/学生报道模型.js';
import {
  canCompleteInterview,
  canUseAsDirectQuote,
  createExecutionWorkspaceFromPlan,
  isExecutionWorkspace,
  redactExecutionWorkspace,
} from '../../shared/报道执行工作区.js';
import {
  ExecutionPlanner,
  computeTaskBlockers,
} from '../../shared/执行计划器.js';
import {
  assessInterviewQuestion,
  createOutreachAttempt,
  transitionSourceStatus,
} from '../../shared/采访执行规则.js';
import {
  createEvidenceGapTasks,
  processInterviewEvidence,
} from '../../shared/采访证据处理.js';
import {
  evaluateOutlineSupport,
  runAssignmentCheck,
} from '../../shared/报道提交检查.js';
import {
  createLocalReportingProject,
  parseLocalProjectImport,
} from '../../shared/本地项目模型.js';

const now = '2026-08-13T08:00:00.000Z';

const brief: ReportingBrief = {
  mode: 'course',
  rawTopic: '学校新规实施后，晚归学生的通行体验出现变化',
  assignmentType: '校园调查',
  courseName: '新闻采访与写作',
  deadline: '2026-08-20T23:59:00.000Z',
  targetLength: 1800,
  minimumInterviewees: 3,
  geographicScope: '本校校园',
  targetAudience: '本校学生与教师',
  availableInterviewees: ['学生', '教师', '学校管理者'],
  existingMaterials: ['学校公开通知'],
  reportingResources: ['1 名学生记者'],
  ethicalConstraints: ['录音前征得同意', '匿名身份不得外泄'],
  requiresDifferentSourceTypes: true,
  requiresHumanStory: true,
  requiresInterviewOutline: true,
  requiresPlanningDocument: true,
  requiresInterviewSummary: true,
  assignmentRequirementsText: '至少采访三类对象，包含人物场景、不同观点与采访总结。',
  formatRequirements: 'DOCX',
};

test('ExecutionPlanner 按截止时间倒排任务并保留依赖关系', () => {
  const plan = createStudentReportingPlan(brief);
  const workspace = createExecutionWorkspaceFromPlan(plan, now);
  const tasks = new ExecutionPlanner().build({
    brief,
    sourceIds: workspace.sources.map((source) => source.id),
    now,
  });

  assert.ok(tasks.length >= 8);
  assert.ok(tasks.every((task) => Date.parse(task.dueAt) <= Date.parse(brief.deadline!)));
  assert.ok(tasks.some((task) => task.type === 'contact_source'));
  assert.ok(tasks.some((task) => task.type === 'interview' && task.dependencyIds.length));
  assert.ok(tasks.some((task) => task.type === 'assignment_check'));
});

test('通用信源角色会映射为不同采访对象类型，避免多样性检查误判', () => {
  const workspace = createExecutionWorkspaceFromPlan(createStudentReportingPlan(brief), now);
  const byRole = new Map(workspace.sources.map((source) => [source.role, source.sourceType]));

  assert.equal(byRole.get('直接经历者'), 'affected_group');
  assert.equal(byRole.get('不同或受影响观点'), 'affected_group');
  assert.equal(byRole.get('决策者或规则执行者'), 'school_administrator');
  assert.equal(byRole.get('第三方解释者'), 'expert');
  assert.ok(new Set(workspace.sources.map((source) => source.sourceType)).size >= 3);
});

test('48 小时内的任务计划优先最小可交付采访与关键核验', () => {
  const urgentBrief = { ...brief, deadline: '2026-08-14T18:00:00.000Z' };
  const tasks = new ExecutionPlanner().build({
    brief: urgentBrief,
    sourceIds: ['source-student', 'source-school'],
    now,
  });
  const topThree = tasks.filter((task) => task.isTodayFocus).slice(0, 3);
  assert.equal(topThree.length, 3);
  assert.ok(topThree.some((task) => task.type === 'contact_source'));
  assert.ok(topThree.some((task) => task.priority === 'critical'));
});

test('依赖未完成和人工阻塞原因都会进入 blocker 计算', () => {
  const tasks = new ExecutionPlanner().build({
    brief,
    sourceIds: ['source-student'],
    now,
  });
  const interview = tasks.find((task) => task.type === 'interview');
  assert.ok(interview);
  const blockers = computeTaskBlockers(interview!, tasks);
  assert.ok(blockers.length >= 1);

  interview!.manualBlocker = '采访对象尚未回复';
  assert.ok(computeTaskBlockers(interview!, tasks).includes('采访对象尚未回复'));
});

test('信源状态转换拒绝跳过联系与同意环节', () => {
  assert.throws(
    () => transitionSourceStatus('identified', 'interviewed'),
    /不能直接切换/u,
  );
  assert.equal(transitionSourceStatus('identified', 'contacted'), 'contacted');
  assert.equal(transitionSourceStatus('contacted', 'scheduled'), 'scheduled');
});

test('联系尝试只保存草稿和人工记录，不含自动发送状态', () => {
  const attempt = createOutreachAttempt({
    id: 'outreach-1',
    sourceId: 'source-1',
    channel: 'email',
    templateType: 'school_administrator',
    message: '您好，我是新闻采访与写作课程学生，想就公开通知进行一次 20 分钟采访。',
    attemptedAt: now,
  });
  assert.equal(attempt.delivery, 'manual_record');
  assert.equal('sentAutomatically' in attempt, false);
});

test('采访完成门槛要求同意记录、笔记、未回答项和采访后复盘', () => {
  const plan = createStudentReportingPlan(brief);
  const workspace = createExecutionWorkspaceFromPlan(plan, now);
  const session = workspace.sessions[0];
  assert.ok(session);
  assert.equal(canCompleteInterview(session, workspace.notes, workspace.questions).ok, false);

  const ready = {
    ...session,
    status: 'in_progress' as const,
    consent: {
      recordingAllowed: false,
      materialUseAllowed: true,
      attributionConfirmed: true,
      attributionMode: 'named' as const,
      checkedAt: now,
    },
    debrief: {
      confirmedPointIds: ['note-1'],
      newLeadIds: [],
      unansweredQuestionIds: workspace.questions
        .filter((question) => question.sourceId === session.sourceId)
        .map((question) => question.id),
      conflictIds: [],
      quoteCandidateIds: [],
      nextSourceIds: [],
      followUpTaskIds: [],
      completedAt: now,
    },
  };
  const notes = [{
    id: 'note-1',
    sessionId: session.id,
    sourceId: session.sourceId,
    kind: 'fact' as const,
    text: '受访者说明了通行时间与实际经历。',
    capturedAt: now,
    reviewStatus: 'confirmed' as const,
    isPrivate: false,
    isOffRecord: false,
  }];
  assert.equal(canCompleteInterview(ready, notes, workspace.questions).ok, true);
});

test('采访问题必须绑定信源、主张或证据缺口，并标注问题风险', () => {
  const assessment = assessInterviewQuestion({
    id: 'question-1',
    sourceId: 'source-1',
    category: 'verification',
    text: '你是否认为新规不合理并且给所有学生造成了严重影响？',
    purpose: '核验影响',
    expectedEvidence: '具体经历、时间与可交叉核验对象',
    claimIds: [],
    evidenceGapIds: [],
    followUps: [],
    riskFlags: [],
    order: 1,
    userConfirmed: false,
  });
  assert.ok(assessment.riskFlags.includes('leading'));
  assert.ok(assessment.riskFlags.includes('double_barreled'));
  assert.ok(assessment.riskFlags.includes('unbound'));
});

test('采访笔记只产生候选主张、候选引语和线索，不能自动变成事实', () => {
  const result = processInterviewEvidence({
    sessionId: 'session-1',
    sourceId: 'source-1',
    notes: [{
      id: 'note-1',
      sessionId: 'session-1',
      sourceId: 'source-1',
      kind: 'direct_quote',
      text: '“过去一周我有三次在门口等待。”',
      capturedAt: now,
      reviewStatus: 'confirmed',
      isPrivate: false,
      isOffRecord: false,
    }],
    transcriptSegments: [],
    now,
  });
  assert.equal(result.claimCandidates[0]?.status, 'attributed_unverified');
  assert.equal(result.quoteCandidates[0]?.reviewStatus, 'candidate');
  assert.equal(result.evidenceItems.length, 0);
});

test('直接引语要求可追溯、人工复核、允许归因且不是 off-record', () => {
  const baseQuote = {
    id: 'quote-1',
    sourceId: 'source-1',
    sessionId: 'session-1',
    text: '过去一周我有三次在门口等待。',
    sourceNoteId: 'note-1',
    sourceTranscriptSegmentId: undefined,
    capturedAt: now,
    reviewStatus: 'confirmed' as const,
    attributionMode: 'named' as const,
    isOffRecord: false,
    isPrivate: false,
    withdrawn: false,
  };
  assert.equal(canUseAsDirectQuote(baseQuote).ok, true);
  assert.equal(canUseAsDirectQuote({ ...baseQuote, isOffRecord: true }).ok, false);
  assert.equal(canUseAsDirectQuote({ ...baseQuote, reviewStatus: 'candidate' }).ok, false);
  assert.equal(canUseAsDirectQuote({ ...baseQuote, sourceNoteId: undefined }).ok, false);
});

test('低置信度转写片段不能直接生成可用引语', () => {
  const result = processInterviewEvidence({
    sessionId: 'session-1',
    sourceId: 'source-1',
    notes: [],
    transcriptSegments: [{
      id: 'segment-1',
      transcriptId: 'transcript-1',
      speaker: '受访者',
      text: '涉及数字和机构名称的回答',
      startMs: 1000,
      endMs: 4000,
      confidence: 0.42,
      reviewStatus: 'unreviewed',
      sensitiveTermFlags: ['number', 'organization'],
    }],
    now,
  });
  assert.equal(result.quoteCandidates.length, 0);
  assert.ok(result.reviewWarnings.some((warning) => warning.includes('低置信度')));
});

test('证据缺口会生成带主张绑定和明确完成条件的追踪任务', () => {
  const tasks = createEvidenceGapTasks([
    {
      id: 'gap-1',
      type: 'party_response',
      claimIds: ['claim-1'],
      description: '缺少校方回应',
      status: 'open',
      requiredAction: '联系学校管理者并记录是否回应',
      createdAt: now,
      updatedAt: now,
    },
  ], now);
  assert.equal(tasks[0]?.claimIds[0], 'claim-1');
  assert.match(tasks[0]?.completionCriteria || '', /回应|拒绝|未回复/u);
});

test('报道提纲不把无证据主张和未确认引语标记为已支撑', () => {
  const result = evaluateOutlineSupport({
    section: {
      id: 'section-1',
      title: '新规实施后的学生经历',
      purpose: '用人物经历进入制度影响',
      materialIds: [],
      claimIds: ['claim-1'],
      quoteIds: ['quote-1'],
      evidenceIds: [],
      gapIds: [],
      draftNotes: '',
      supportStatus: 'supported',
      order: 1,
    },
    claims: [],
    evidence: [],
    quotes: [],
    conflicts: [],
  });
  assert.equal(result.status, 'unsupported');
  assert.ok(result.reasons.length >= 2);
});

test('作业检查保留 blocking 项，不用总分掩盖未完成要求', () => {
  const plan = createStudentReportingPlan(brief);
  const workspace = createExecutionWorkspaceFromPlan(plan, now);
  const checks = runAssignmentCheck({ brief, workspace, evidenceWorkspace: {
    schemaVersion: 1,
    claims: [],
    searchPlan: null,
    sources: [],
    evidence: [],
    claimEvidenceMatrix: [],
    conflicts: [],
    uploadedMaterials: [],
    updatedAt: now,
  } });
  assert.ok(checks.some((item) => item.status === 'blocking'));
  assert.ok(checks.some((item) => item.key === 'minimum_interviews'));
  assert.equal('score' in checks, false);
});

test('完成最低采访数量后，未采用的候选信源提纲不阻断提交', () => {
  const plan = createStudentReportingPlan(brief);
  const base = createExecutionWorkspaceFromPlan(plan, now);
  const usedSourceIds = new Set(base.sources.slice(0, brief.minimumInterviewees).map((source) => source.id));
  const workspace = {
    ...base,
    sessions: base.sessions.map((session) => usedSourceIds.has(session.sourceId)
      ? { ...session, status: 'completed' as const }
      : session),
    questions: base.questions.map((question) => usedSourceIds.has(question.sourceId)
      ? { ...question, userConfirmed: true }
      : question),
  };
  const checks = runAssignmentCheck({
    brief,
    workspace,
    evidenceWorkspace: {
      schemaVersion: 1,
      claims: [],
      searchPlan: null,
      sources: [],
      evidence: [],
      claimEvidenceMatrix: [],
      conflicts: [],
      uploadedMaterials: [],
      updatedAt: now,
    },
  });

  assert.equal(checks.find((item) => item.key === 'interview_guide')?.status, 'passed');
});

test('脱敏导出移除联系方式、匿名身份、私密笔记和 off-record 内容', () => {
  const plan = createStudentReportingPlan(brief);
  const workspace = createExecutionWorkspaceFromPlan(plan, now);
  workspace.sources[0]!.contactMethods = [{ type: 'wechat', value: 'private-wechat-id', isPrivate: true }];
  workspace.sources[0]!.identity = '张同学';
  workspace.sources[0]!.attribution = { mode: 'anonymous', publicLabel: '一名学生', identityPrivate: true };
  workspace.notes.push({
    id: 'private-note',
    sessionId: workspace.sessions[0]!.id,
    sourceId: workspace.sources[0]!.id,
    kind: 'paraphrase',
    text: '私下提供的身份线索',
    capturedAt: now,
    reviewStatus: 'confirmed',
    isPrivate: true,
    isOffRecord: true,
  });

  const redacted = redactExecutionWorkspace(workspace, 'redacted_share');
  const serialized = JSON.stringify(redacted);
  assert.doesNotMatch(serialized, /private-wechat-id|张同学|私下提供/u);
  assert.match(serialized, /一名学生/u);
});

test('本地项目从 v2 迁移到 v3 且创建空的执行工作区', () => {
  const plan = createStudentReportingPlan(brief);
  const current = createLocalReportingProject({ id: 'p1', name: '测试项目', brief, plan, now });
  const legacy = {
    format: 'newspilot-local-projects',
    dataVersion: 2,
    exportedAt: now,
    projects: [{ ...current, dataVersion: 2, executionWorkspace: undefined }],
  };
  const imported = parseLocalProjectImport(JSON.stringify(legacy));
  assert.equal(imported.dataVersion, 3);
  assert.ok(isExecutionWorkspace(imported.projects[0]!.executionWorkspace));
});
