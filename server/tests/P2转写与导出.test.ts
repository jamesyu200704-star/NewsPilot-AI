import assert from 'node:assert/strict';
import test from 'node:test';
import JSZip from 'jszip';
import { createStudentReportingPlan } from '../../shared/学生报道工作流.js';
import type { ReportingBrief } from '../../shared/学生报道模型.js';
import { createExecutionWorkspaceFromPlan } from '../../shared/报道执行工作区.js';
import {
  ManualTranscriptProvider,
  validateAudioUpload,
} from '../../shared/采访转写.js';
import {
  buildInterviewGuideDocx,
  buildReportingExportPackage,
  type ExportPrivacyConfirmation,
} from '../../shared/报道导出.js';
import { createEmptyEvidenceWorkspace } from '../../shared/证据工作区.js';

const now = '2026-08-13T08:00:00.000Z';
const brief: ReportingBrief = {
  mode: 'course',
  rawTopic: '校园夜间通行规定实施情况',
  assignmentType: '校园调查',
  deadline: '2026-08-20T23:59:00.000Z',
  targetLength: 1800,
  minimumInterviewees: 3,
  geographicScope: '本校校园',
  targetAudience: '在校师生',
  availableInterviewees: ['学生', '教师', '学校管理者'],
  existingMaterials: ['学校公开通知'],
  reportingResources: ['学生记者一名'],
  ethicalConstraints: ['录音前征得同意'],
  requiresDifferentSourceTypes: true,
  requiresHumanStory: true,
  requiresInterviewOutline: true,
  requiresPlanningDocument: true,
  requiresInterviewSummary: true,
  formatRequirements: 'DOCX',
};

const privacyConfirmation: ExportPrivacyConfirmation = {
  noPrivateContacts: true,
  noAnonymousIdentity: true,
  noOffRecord: true,
  noUnconfirmedQuotes: true,
  noAudioOrFullTranscript: true,
  userConfirmed: true,
};

test('ManualTranscriptProvider 支持粘贴 TXT/MD、说话人分段与人工复核标记', async () => {
  const provider = new ManualTranscriptProvider();
  const transcript = await provider.transcribe({
    id: 'transcript-1',
    sessionId: 'session-1',
    sourceId: 'source-1',
    text: '记者：请说明时间。\n受访者：8 月 12 日，学生处发布了通知。\n受访者：这是需要核实的说法。',
    fileName: '采访记录.md',
    now,
  });
  assert.equal(transcript.provider, 'manual');
  assert.equal(transcript.status, 'review_required');
  assert.equal(transcript.segments.length, 3);
  assert.equal(transcript.segments[1]?.speaker, '受访者');
  assert.ok(transcript.segments[1]?.sensitiveTermFlags.includes('number'));
  assert.ok(transcript.segments[1]?.sensitiveTermFlags.includes('organization'));
  assert.ok(transcript.segments.every((segment) => segment.reviewStatus === 'unreviewed'));
});

test('音频校验限制扩展名、MIME、大小与文件签名', () => {
  const valid = validateAudioUpload({
    fileName: 'interview.webm',
    mimeType: 'audio/webm',
    size: 8,
    bytes: new Uint8Array([0x1a, 0x45, 0xdf, 0xa3, 0, 0, 0, 0]),
    maxFileMb: 100,
  });
  assert.equal(valid.ok, true);
  assert.equal(validateAudioUpload({ ...valid.input!, fileName: 'attack.html' }).ok, false);
  assert.equal(validateAudioUpload({ ...valid.input!, mimeType: 'text/html' }).ok, false);
  assert.equal(validateAudioUpload({ ...valid.input!, size: 101 * 1024 * 1024 }).ok, false);
  assert.equal(validateAudioUpload({ ...valid.input!, bytes: new Uint8Array([60, 115, 99, 114]) }).ok, false);
});

test('DOCX 采访提纲包含中文标题与信源问题，但排除联系方式和私密备注', async () => {
  const plan = createStudentReportingPlan(brief);
  const workspace = createExecutionWorkspaceFromPlan(plan, now);
  workspace.sources[0]!.contactMethods = [{ type: 'phone', value: 'TEST-PRIVATE-PHONE', isPrivate: true }];
  workspace.sources[0]!.privateNotes = '测试受访者私密身份，只限内部使用';
  const bytes = await buildInterviewGuideDocx({
    projectName: '校园夜间通行调查',
    brief,
    workspace,
    mode: 'course_submission',
  });
  const zip = await JSZip.loadAsync(bytes);
  const documentXml = await zip.file('word/document.xml')!.async('string');
  assert.match(documentXml, /采访提纲/u);
  assert.doesNotMatch(documentXml, /TEST-PRIVATE-PHONE|测试受访者私密身份/u);
});

test('完整提交包只包含六个规定文件并通过隐私确认门槛', async () => {
  const plan = createStudentReportingPlan(brief);
  const workspace = createExecutionWorkspaceFromPlan(plan, now);
  const firstSource = workspace.sources[0]!;
  firstSource.contactMethods = [{ type: 'wechat', value: 'secret-contact', isPrivate: true }];
  workspace.notes.push({
    id: 'off-record-note',
    sessionId: workspace.sessions[0]!.id,
    sourceId: firstSource.id,
    kind: 'paraphrase',
    text: '不可公开的私下说明',
    capturedAt: now,
    reviewStatus: 'confirmed',
    isPrivate: true,
    isOffRecord: true,
  });

  await assert.rejects(
    buildReportingExportPackage({
      projectName: '校园夜间通行调查',
      brief,
      plan,
      workspace,
      evidenceWorkspace: createEmptyEvidenceWorkspace(now),
      mode: 'course_submission',
      privacyConfirmation: { ...privacyConfirmation, userConfirmed: false },
    }),
    /隐私检查/u,
  );

  const archive = await buildReportingExportPackage({
    projectName: '校园夜间通行调查',
    brief,
    plan,
    workspace,
    evidenceWorkspace: createEmptyEvidenceWorkspace(now),
    mode: 'course_submission',
    privacyConfirmation,
  });
  const zip = await JSZip.loadAsync(archive);
  const names = Object.keys(zip.files).sort();
  assert.deepEqual(names, [
    'README.txt',
    'evidence-matrix.csv',
    'interview-guide.docx',
    'outline.docx',
    'project.json',
    'reporting-plan.md',
  ]);
  const serialized = await zip.file('project.json')!.async('string');
  const markdown = await zip.file('reporting-plan.md')!.async('string');
  assert.doesNotMatch(`${serialized}\n${markdown}`, /secret-contact|不可公开的私下说明/u);
  assert.doesNotMatch(names.join('\n'), /audio|transcript|\.env|key/u);
});
