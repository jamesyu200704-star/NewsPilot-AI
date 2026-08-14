import assert from 'node:assert/strict';
import test from 'node:test';
import JSZip from 'jszip';
import { createStudentReportingPlan } from '../../shared/学生报道工作流.js';
import type { ReportingBrief } from '../../shared/学生报道模型.js';
import { createClaimsFromBrief } from '../../shared/证据工作流.js';
import { createEmptyEvidenceWorkspace } from '../../shared/证据工作区.js';
import { createExecutionWorkspaceFromPlan } from '../../shared/报道执行工作区.js';
import { createOutreachAttempt, transitionSourceStatus } from '../../shared/采访执行规则.js';
import { ManualTranscriptProvider } from '../../shared/采访转写.js';
import {
  processInterviewEvidence,
  promoteInterviewCandidateToEvidence,
} from '../../shared/采访证据处理.js';
import {
  createEvidenceBackedOutline,
  createInterviewSummary,
  deriveEvidenceGaps,
} from '../../shared/报道执行流程.js';
import { runAssignmentCheck } from '../../shared/报道提交检查.js';
import { buildReportingExportPackage } from '../../shared/报道导出.js';

const now = '2026-08-13T08:00:00.000Z';
const brief: ReportingBrief = {
  mode: 'course',
  rawTopic: '校园门禁新规实施后的晚归通行体验',
  assignmentType: '校园调查',
  deadline: '2026-08-21T12:00:00.000Z',
  targetLength: 1600,
  minimumInterviewees: 1,
  geographicScope: '本校校园',
  targetAudience: '本校师生',
  availableInterviewees: ['学生', '学校管理者'],
  existingMaterials: ['学校公开通知'],
  reportingResources: ['学生记者一名'],
  ethicalConstraints: ['采访前说明用途'],
  requiresDifferentSourceTypes: false,
  requiresHumanStory: true,
  requiresInterviewOutline: true,
  requiresPlanningDocument: true,
  requiresInterviewSummary: true,
  formatRequirements: 'DOCX',
};

test('P2 集成：从任务、联系、采访、转写、证据到提纲、自查和 DOCX 包', async () => {
  const plan = createStudentReportingPlan(brief);
  const execution = createExecutionWorkspaceFromPlan(plan, now);
  const evidence = createEmptyEvidenceWorkspace(now);
  evidence.claims = createClaimsFromBrief(brief, () => now);
  const source = execution.sources[0]!;
  source.identity = '内部真实姓名';
  source.attribution = { mode: 'anonymous', publicLabel: '一名受访学生', identityPrivate: true };
  source.contactMethods = [{ type: 'wechat', value: 'private-contact', isPrivate: true }];
  source.status = transitionSourceStatus(source.status, 'contacted');
  execution.outreachAttempts.push(createOutreachAttempt({
    id: 'outreach-1',
    sourceId: source.id,
    channel: 'wechat',
    templateType: 'student',
    message: '人工发送的采访邀请',
    attemptedAt: now,
  }));
  source.status = transitionSourceStatus(source.status, 'scheduled');
  execution.questions
    .filter((question) => question.sourceId === source.id)
    .forEach((question) => {
      question.userConfirmed = true;
      if (!question.claimIds.length) question.claimIds = [evidence.claims[0]!.id];
    });
  const session = execution.sessions.find((item) => item.sourceId === source.id)!;
  session.status = 'in_progress';
  session.consent = {
    recordingAllowed: false,
    materialUseAllowed: true,
    attributionConfirmed: true,
    attributionMode: 'anonymous',
    checkedAt: now,
  };
  const transcript = await new ManualTranscriptProvider().transcribe({
    id: 'transcript-1',
    sessionId: session.id,
    sourceId: source.id,
    text: '受访学生：过去一周我有三次在门口等待。',
    now,
  });
  transcript.segments[0]!.reviewStatus = 'corrected';
  transcript.segments[0]!.sensitiveTermFlags = [];
  execution.transcripts.push(transcript);
  execution.notes.push({
    id: 'note-1',
    sessionId: session.id,
    sourceId: source.id,
    questionId: session.questionIds[0],
    kind: 'direct_quote',
    text: '过去一周我有三次在门口等待。',
    capturedAt: now,
    reviewStatus: 'confirmed',
    isPrivate: false,
    isOffRecord: false,
  });
  const processed = processInterviewEvidence({
    sessionId: session.id,
    sourceId: source.id,
    notes: execution.notes,
    transcriptSegments: transcript.segments,
    now,
  });
  const quote = processed.quoteCandidates[0]!;
  quote.reviewStatus = 'confirmed';
  quote.attributionMode = 'anonymous';
  execution.quotes.push(quote);
  const candidate = processed.claimCandidates[0]!;
  const promoted = promoteInterviewCandidateToEvidence({
    candidate,
    source,
    claimId: evidence.claims[0]!.id,
    relation: 'context',
    userConfirmed: true,
    now,
  });
  evidence.sources.push(promoted.sourceRecord);
  evidence.evidence.push(promoted.evidenceItem);
  session.debrief = {
    confirmedPointIds: ['note-1'],
    newLeadIds: [],
    unansweredQuestionIds: session.questionIds.slice(1),
    conflictIds: [],
    quoteCandidateIds: [quote.id],
    nextSourceIds: [],
    followUpTaskIds: [],
    completedAt: now,
  };
  session.status = 'completed';
  source.status = 'completed';

  execution.evidenceGaps = deriveEvidenceGaps({ evidenceWorkspace: evidence, executionWorkspace: execution, now });
  execution.outlines = [createEvidenceBackedOutline({ plan, evidenceWorkspace: evidence, executionWorkspace: execution, now })];
  execution.assignmentChecks = runAssignmentCheck({ brief, workspace: execution, evidenceWorkspace: evidence });
  const summary = createInterviewSummary(execution, source.id);
  assert.match(summary, /过去一周/u);
  assert.match(summary, /仍须独立核验/u);
  assert.ok(execution.evidenceGaps.length >= 1);
  assert.ok(execution.outlines[0]!.sections.length >= 4);
  assert.ok(execution.outlines[0]!.sections.every((section) => section.purpose));

  const archive = await buildReportingExportPackage({
    projectName: '门禁新规报道项目',
    brief,
    plan,
    workspace: execution,
    evidenceWorkspace: evidence,
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
  const projectJson = await zip.file('project.json')!.async('string');
  assert.doesNotMatch(projectJson, /内部真实姓名|private-contact/u);
  assert.ok(zip.file('interview-guide.docx'));
  assert.ok(zip.file('outline.docx'));
});
