import assert from 'node:assert/strict';
import test from 'node:test';
import JSZip from 'jszip';
import { createStudentReportingPlan } from '../../shared/学生报道工作流.js';
import type { AssignmentType, ReportingBrief } from '../../shared/学生报道模型.js';
import { createClaimsFromBrief } from '../../shared/证据工作流.js';
import { createEmptyEvidenceWorkspace } from '../../shared/证据工作区.js';
import type { ConflictRecord, EvidenceWorkspaceState } from '../../shared/证据领域模型.js';
import { createExecutionWorkspaceFromPlan } from '../../shared/报道执行工作区.js';
import type {
  ExecutionWorkspaceState,
  InterviewSourceType,
  StoryStructureType,
} from '../../shared/报道执行模型.js';
import { createOutreachAttempt, transitionSourceStatus } from '../../shared/采访执行规则.js';
import { ManualTranscriptProvider } from '../../shared/采访转写.js';
import {
  createEvidenceGapTasks,
  processInterviewEvidence,
  promoteInterviewCandidateToEvidence,
} from '../../shared/采访证据处理.js';
import { createEvidenceBackedOutline, deriveEvidenceGaps } from '../../shared/报道执行流程.js';
import { runAssignmentCheck } from '../../shared/报道提交检查.js';
import { buildReportingExportPackage } from '../../shared/报道导出.js';

const now = '2026-08-13T08:00:00.000Z';

interface ScenarioConfig {
  name: string;
  topic: string;
  assignmentType: AssignmentType;
  sourceRoles: Array<{ role: string; type: InterviewSourceType }>;
  structureType: StoryStructureType;
  addDocument?: boolean;
  addConflict?: boolean;
}

const createBrief = (config: ScenarioConfig): ReportingBrief => ({
  mode: 'course',
  rawTopic: config.topic,
  assignmentType: config.assignmentType,
  deadline: '2026-08-28T12:00:00.000Z',
  targetLength: 1800,
  minimumInterviewees: config.sourceRoles.length,
  geographicScope: '合成校园',
  targetAudience: '校园师生',
  availableInterviewees: config.sourceRoles.map((item) => item.role),
  existingMaterials: config.addDocument ? ['合成政策文件'] : ['合成观察记录'],
  reportingResources: ['离线合成学生记者'],
  ethicalConstraints: ['采访前说明用途并确认归因'],
  requiresDifferentSourceTypes: true,
  requiresHumanStory: true,
  requiresInterviewOutline: true,
  requiresPlanningDocument: true,
  requiresInterviewSummary: true,
  formatRequirements: 'DOCX；文件名包含课程作业编号',
});

async function completeSyntheticInterview(input: {
  workspace: ExecutionWorkspaceState;
  evidenceWorkspace: EvidenceWorkspaceState;
  sourceIndex: number;
  role: string;
  sourceType: InterviewSourceType;
  relation?: 'supports' | 'contradicts' | 'context';
}) {
  const source = input.workspace.sources[input.sourceIndex]!;
  source.role = input.role;
  source.publicLabel = `${input.role}（离线合成）`;
  source.sourceType = input.sourceType;
  source.attribution = { mode: 'named', publicLabel: source.publicLabel, identityPrivate: true };
  source.status = transitionSourceStatus(source.status, 'contacted');
  input.workspace.outreachAttempts.push(createOutreachAttempt({
    id: `outreach-${input.sourceIndex + 1}`,
    sourceId: source.id,
    channel: 'email',
    templateType: input.sourceType === 'school_administrator' ? 'school_administrator' : 'student',
    message: '这是一条离线合成的人工邀约记录，不会自动发送。',
    attemptedAt: now,
  }));
  source.status = transitionSourceStatus(source.status, 'scheduled');

  const claim = input.evidenceWorkspace.claims[input.sourceIndex % input.evidenceWorkspace.claims.length]!;
  const questions = input.workspace.questions.filter((question) => question.sourceId === source.id);
  for (const question of questions) {
    question.claimIds = [claim.id];
    question.userConfirmed = true;
  }

  const session = input.workspace.sessions.find((item) => item.sourceId === source.id)!;
  session.status = 'in_progress';
  session.scheduledAt = now;
  session.startedAt = now;
  session.consent = {
    recordingAllowed: true,
    materialUseAllowed: true,
    attributionConfirmed: true,
    attributionMode: 'named',
    checkedAt: now,
  };
  const factNoteId = `note-${input.sourceIndex + 1}-fact`;
  const quoteNoteId = `note-${input.sourceIndex + 1}-quote`;
  input.workspace.notes.push(
    {
      id: factNoteId,
      sessionId: session.id,
      sourceId: source.id,
      questionId: questions[0]?.id,
      kind: input.relation === 'contradicts' ? 'contradiction' : 'fact',
      text: `${source.publicLabel}提供了可归因的合成经历与时间线，仍需独立核验。`,
      capturedAt: now,
      reviewStatus: 'confirmed',
      isPrivate: false,
      isOffRecord: false,
    },
    {
      id: quoteNoteId,
      sessionId: session.id,
      sourceId: source.id,
      questionId: questions[1]?.id || questions[0]?.id,
      kind: 'direct_quote',
      text: `“这是${configSafeText(input.role)}亲历的合成场景描述。”`,
      capturedAt: now,
      reviewStatus: 'confirmed',
      isPrivate: false,
      isOffRecord: false,
      audioTimestampMs: 48_000,
    },
  );
  const transcript = await new ManualTranscriptProvider().transcribe({
    id: `transcript-${input.sourceIndex + 1}`,
    sessionId: session.id,
    sourceId: source.id,
    text: `${source.publicLabel}：这是离线合成逐字稿，不包含真实个人数据。`,
    now,
  });
  transcript.segments.forEach((segment) => {
    segment.reviewStatus = 'corrected';
    segment.sensitiveTermFlags = [];
  });
  input.workspace.transcripts.push(transcript);

  const processed = processInterviewEvidence({
    sessionId: session.id,
    sourceId: source.id,
    notes: input.workspace.notes.filter((note) => note.sessionId === session.id),
    transcriptSegments: transcript.segments,
    now,
  });
  const quote = processed.quoteCandidates.find((item) => item.sourceNoteId === quoteNoteId)!;
  quote.reviewStatus = 'confirmed';
  quote.attributionMode = 'named';
  input.workspace.quotes.push(quote);
  const promoted = promoteInterviewCandidateToEvidence({
    candidate: processed.claimCandidates[0]!,
    source,
    claimId: claim.id,
    relation: input.relation || 'supports',
    userConfirmed: true,
    now,
  });
  input.evidenceWorkspace.sources.push(promoted.sourceRecord);
  input.evidenceWorkspace.evidence.push(promoted.evidenceItem);
  session.debrief = {
    confirmedPointIds: [factNoteId, quoteNoteId],
    newLeadIds: [],
    unansweredQuestionIds: questions.slice(2).map((question) => question.id),
    conflictIds: [],
    quoteCandidateIds: [quote.id],
    nextSourceIds: [],
    followUpTaskIds: [],
    completedAt: now,
  };
  session.endedAt = now;
  session.status = 'completed';
  source.status = 'completed';
  return promoted.evidenceItem.id;
}

const configSafeText = (value: string) => value.replace(/[<>]/gu, '');

async function runOfflineScenario(config: ScenarioConfig) {
  const brief = createBrief(config);
  const plan = createStudentReportingPlan(brief);
  const workspace = createExecutionWorkspaceFromPlan(plan, now);
  const evidenceWorkspace = createEmptyEvidenceWorkspace(now);
  evidenceWorkspace.claims = createClaimsFromBrief(brief, () => now);
  const evidenceIds: string[] = [];

  for (const [index, sourceConfig] of config.sourceRoles.entries()) {
    evidenceIds.push(await completeSyntheticInterview({
      workspace,
      evidenceWorkspace,
      sourceIndex: index,
      role: sourceConfig.role,
      sourceType: sourceConfig.type,
      relation: config.addConflict && index === 1 ? 'contradicts' : 'supports',
    }));
  }

  if (config.addDocument) {
    const claim = evidenceWorkspace.claims[0]!;
    evidenceWorkspace.sources.push({
      id: 'source-policy-document',
      title: '合成校园政策文件',
      retrievedAt: now,
      sourceType: 'primary_document',
      credibilityTier: 'A',
      independenceGroupId: 'synthetic-policy-document',
      originStatus: 'resolved',
      isLikelyRepost: false,
      shortSummary: '用于离线测试的政策原文摘要。',
      excerpt: '合成政策适用范围、实施日期与执行责任。',
      supportsClaimIds: [claim.id],
      contradictsClaimIds: [],
      userAccepted: true,
      userRejected: false,
      extractionStatus: 'success',
      warnings: [],
      classificationHistory: [{
        at: now,
        actor: 'user',
        sourceType: 'primary_document',
        credibilityTier: 'A',
        reason: '离线测试中由用户明确标记为原始文件。',
      }],
    });
    evidenceWorkspace.evidence.push({
      id: 'evidence-policy-document',
      sourceId: 'source-policy-document',
      excerpt: '合成政策适用范围、实施日期与执行责任。',
      normalizedMeaning: '政策原文定义了适用范围和实施节点。',
      relation: 'supports',
      claimIds: [claim.id],
      directness: 'direct',
      userConfirmed: true,
      createdAt: now,
    });
  }

  if (config.addConflict) {
    const conflict: ConflictRecord = {
      id: 'conflict-synthetic-1',
      claimId: evidenceWorkspace.claims[0]!.id,
      type: 'scope',
      supportingEvidenceIds: [evidenceIds[0]!],
      contradictingEvidenceIds: [evidenceIds[1]!],
      explanation: '两类合成受访者对现象覆盖范围的描述不同。',
      possibleScopeDifference: true,
      nextSteps: ['补充采访另一类学生', '核对公开数据口径'],
      status: 'open',
    };
    evidenceWorkspace.conflicts.push(conflict);
  }

  workspace.evidenceGaps = deriveEvidenceGaps({ evidenceWorkspace, executionWorkspace: workspace, now });
  workspace.tasks.push(...createEvidenceGapTasks(workspace.evidenceGaps, now));
  const outline = createEvidenceBackedOutline({
    plan,
    evidenceWorkspace,
    executionWorkspace: workspace,
    structureType: config.structureType,
    now,
  });
  workspace.outlines = [outline];
  workspace.assignmentChecks = runAssignmentCheck({ brief, workspace, evidenceWorkspace });

  const archive = await buildReportingExportPackage({
    projectName: config.name,
    brief,
    plan,
    workspace,
    evidenceWorkspace,
    mode: 'course_submission',
    privacyConfirmation: {
      noPrivateContacts: true,
      noAnonymousIdentity: true,
      noOffRecord: true,
      noUnconfirmedQuotes: true,
      noAudioOrFullTranscript: true,
      userConfirmed: true,
    },
  });
  const zip = await JSZip.loadAsync(archive);
  assert.ok(zip.file('interview-guide.docx'));
  assert.ok(zip.file('outline.docx'));
  assert.equal(workspace.sources.filter((source) => source.status === 'completed').length, config.sourceRoles.length);
  assert.equal(workspace.quotes.filter((quote) => quote.reviewStatus === 'confirmed').length, config.sourceRoles.length);
  assert.equal(outline.structureType, config.structureType);
  assert.equal(outline.sections.length, 4);
  return { brief, workspace, evidenceWorkspace, outline };
}

test('P2 E2E：人物特稿完成主人公、两名旁证、场景时间线、引语确认和人物大纲', async () => {
  const result = await runOfflineScenario({
    name: '离线人物特稿',
    topic: '合成校队守门员伤后复训的一周',
    assignmentType: '人物特稿',
    sourceRoles: [
      { role: '主人公', type: 'student' },
      { role: '队友旁证', type: 'student' },
      { role: '教练旁证', type: 'teacher' },
    ],
    structureType: 'profile',
  });
  assert.match(result.outline.sections[0]!.title, /人物场景/u);
  assert.ok(result.workspace.notes.some((note) => note.audioTimestampMs === 48_000));
  assert.equal(new Set(result.workspace.sources.slice(0, 3).map((source) => source.role)).size, 3);
});

test('P2 E2E：校园现象调查覆盖多类学生、教师、管理者、来源冲突和补充采访', async () => {
  const result = await runOfflineScenario({
    name: '离线校园现象调查',
    topic: '合成校园共享单车停放现象调查',
    assignmentType: '校园调查',
    sourceRoles: [
      { role: '经常骑车学生', type: 'student' },
      { role: '很少骑车学生', type: 'student' },
      { role: '课程教师', type: 'teacher' },
      { role: '校园管理者', type: 'school_administrator' },
    ],
    structureType: 'campus_phenomenon',
    addDocument: true,
    addConflict: true,
  });
  assert.equal(result.evidenceWorkspace.conflicts.length, 1);
  assert.ok(result.workspace.evidenceGaps.some((gap) => gap.type === 'scope_mismatch'));
  assert.ok(result.workspace.tasks.some((task) => task.type === 'close_evidence_gap'));
  assert.ok(result.evidenceWorkspace.sources.some((source) => source.sourceType === 'primary_document'));
});

test('P2 E2E：校园政策观察覆盖政策原文、执行者、受影响者、执行差异与政策大纲', async () => {
  const result = await runOfflineScenario({
    name: '离线校园政策观察',
    topic: '合成校园夜间门禁政策执行差异',
    assignmentType: '校园调查',
    sourceRoles: [
      { role: '受影响学生', type: 'student' },
      { role: '规则执行者', type: 'school_administrator' },
      { role: '第三方教师', type: 'teacher' },
    ],
    structureType: 'policy_implementation',
    addDocument: true,
    addConflict: true,
  });
  assert.match(result.outline.sections[0]!.title, /政策与时间线/u);
  assert.ok(result.evidenceWorkspace.sources.some((source) => source.sourceType === 'primary_document'));
  assert.ok(result.workspace.assignmentChecks.some((item) => item.key === 'critical_claims'));
});
