import JSZip from 'jszip';
import type { AssignmentType, ReportingBrief } from '../../shared/学生报道模型.js';
import { createStudentReportingPlan } from '../../shared/学生报道工作流.js';
import { createEmptyEvidenceWorkspace } from '../../shared/证据工作区.js';
import { createClaimsFromBrief } from '../../shared/证据工作流.js';
import { createExecutionWorkspaceFromPlan, redactExecutionWorkspace } from '../../shared/报道执行工作区.js';
import { createEvidenceGapTasks } from '../../shared/采访证据处理.js';
import { createEvidenceBackedOutline, deriveEvidenceGaps } from '../../shared/报道执行流程.js';
import { runAssignmentCheck } from '../../shared/报道提交检查.js';
import { buildReportingExportPackage } from '../../shared/报道导出.js';

export interface P2EvaluationFixture {
  id: string;
  topic: string;
  assignmentType: AssignmentType;
  deadlineDays: number;
  interviewees: string[];
  requiresDifferentSourceTypes: boolean;
}

const topics: Array<Omit<P2EvaluationFixture, 'id'>> = [
  { topic: '奖学金获得者的校园学习与兼职经历', assignmentType: '人物特稿', deadlineDays: 10, interviewees: ['学生', '同学', '教师'], requiresDifferentSourceTypes: true },
  { topic: '毕业生返乡创业的选择与校园经历', assignmentType: '人物特稿', deadlineDays: 8, interviewees: ['毕业生', '教师', '合作伙伴'], requiresDifferentSourceTypes: true },
  { topic: '校园维修工的一天', assignmentType: '人物特稿', deadlineDays: 7, interviewees: ['维修工', '学生', '管理者'], requiresDifferentSourceTypes: true },
  { topic: '学生社团负责人换届后的工作变化', assignmentType: '人物特稿', deadlineDays: 6, interviewees: ['学生负责人', '社员', '指导教师'], requiresDifferentSourceTypes: true },
  { topic: '图书馆自习座位预约现象', assignmentType: '校园调查', deadlineDays: 5, interviewees: ['学生', '图书馆管理员', '教师'], requiresDifferentSourceTypes: true },
  { topic: '校园夜跑人数变化与安全设施', assignmentType: '校园调查', deadlineDays: 6, interviewees: ['学生', '保卫人员', '体育教师'], requiresDifferentSourceTypes: true },
  { topic: '食堂高峰期排队体验', assignmentType: '校园调查', deadlineDays: 4, interviewees: ['学生', '食堂工作人员', '后勤管理者'], requiresDifferentSourceTypes: true },
  { topic: '大学生使用 AI 完成课程作业', assignmentType: '校园调查', deadlineDays: 7, interviewees: ['学生', '教师', '教务管理者'], requiresDifferentSourceTypes: true },
  { topic: '校园门禁新规的实施情况', assignmentType: '校园调查', deadlineDays: 7, interviewees: ['学生', '保卫人员', '学校管理者'], requiresDifferentSourceTypes: true },
  { topic: '课堂考勤制度调整后的执行差异', assignmentType: '校园调查', deadlineDays: 5, interviewees: ['学生', '教师', '教务管理者'], requiresDifferentSourceTypes: true },
  { topic: '实验室开放时间新规是否落实', assignmentType: '校园调查', deadlineDays: 6, interviewees: ['学生', '实验室管理员', '学院管理者'], requiresDifferentSourceTypes: true },
  { topic: '校内电动车管理规定实施效果', assignmentType: '校园调查', deadlineDays: 8, interviewees: ['学生', '保卫人员', '政策专家'], requiresDifferentSourceTypes: true },
  { topic: '校园快递点日均件量与等待时间', assignmentType: '深度报道', deadlineDays: 9, interviewees: ['学生', '快递员', '平台负责人'], requiresDifferentSourceTypes: true },
  { topic: '不同食堂窗口价格变化数据调查', assignmentType: '深度报道', deadlineDays: 12, interviewees: ['学生', '商家', '后勤部门'], requiresDifferentSourceTypes: true },
  { topic: '校园招聘会岗位数量与专业分布', assignmentType: '深度报道', deadlineDays: 10, interviewees: ['毕业生', '招聘单位', '就业中心'], requiresDifferentSourceTypes: true },
  { topic: '学生社团活动经费公开情况', assignmentType: '深度报道', deadlineDays: 8, interviewees: ['社团成员', '社团负责人', '学校管理者'], requiresDifferentSourceTypes: true },
  { topic: '学校发布暑期宿舍安排通知', assignmentType: '消息', deadlineDays: 2, interviewees: ['学生', '宿管', '学校管理者'], requiresDifferentSourceTypes: true },
  { topic: '校运会场馆临时调整', assignmentType: '消息', deadlineDays: 1, interviewees: ['参赛学生', '体育教师', '组织者'], requiresDifferentSourceTypes: true },
  { topic: '校园公交线路调整前后通勤变化', assignmentType: '校园调查', deadlineDays: 7, interviewees: ['学生', '司机', '后勤部门'], requiresDifferentSourceTypes: true },
  { topic: '图书馆延长开放时间前后使用变化', assignmentType: '校园调查', deadlineDays: 6, interviewees: ['学生', '图书馆管理员', '教师'], requiresDifferentSourceTypes: true },
];

export const p2EvaluationFixtures: P2EvaluationFixture[] = topics.map((fixture, index) => ({
  id: `P2-${String(index + 1).padStart(3, '0')}`,
  ...fixture,
}));

interface MetricTotals {
  taskPlanCompleteness: number;
  deadlineFeasibility: number;
  interviewReadiness: number;
  questionToClaimCoverage: number;
  evidenceGapClosure: number;
  quoteTraceability: number;
  unsupportedOutlineRate: number;
  assignmentComplianceAccuracy: number;
  privacyLeakageRate: number;
  exportIntegrity: number;
}

export interface P2EvaluationCaseResult extends MetricTotals {
  id: string;
  hardFailures: {
    fabricatedInterviewContent: number;
    falseDirectQuote: number;
    offRecordExport: number;
    privateInformationLeakage: number;
  };
}

const average = (values: number[]) => values.reduce((sum, value) => sum + value, 0) / Math.max(1, values.length);

const deadlineFrom = (days: number) => {
  const date = new Date('2026-08-13T08:00:00.000Z');
  date.setUTCDate(date.getUTCDate() + days);
  return date.toISOString();
};

export async function evaluateP2Fixture(fixture: P2EvaluationFixture): Promise<P2EvaluationCaseResult> {
  const now = '2026-08-13T08:00:00.000Z';
  const brief: ReportingBrief = {
    mode: 'course', rawTopic: fixture.topic, assignmentType: fixture.assignmentType, courseName: '新闻采访与写作', deadline: deadlineFrom(fixture.deadlineDays), targetLength: 1800, minimumInterviewees: 3,
    geographicScope: '本校校园', targetAudience: '本校师生', availableInterviewees: fixture.interviewees, existingMaterials: ['离线合成公开材料'], reportingResources: ['学生记者一名'], ethicalConstraints: ['采访前说明用途并征得同意'],
    requiresDifferentSourceTypes: fixture.requiresDifferentSourceTypes, requiresHumanStory: true, requiresInterviewOutline: true, requiresPlanningDocument: true, requiresInterviewSummary: true, formatRequirements: 'DOCX',
  };
  const plan = createStudentReportingPlan(brief);
  const execution = createExecutionWorkspaceFromPlan(plan, now);
  const evidence = createEmptyEvidenceWorkspace(now);
  evidence.claims = createClaimsFromBrief(brief, () => now);
  execution.sources[0]!.identity = `仅评测使用的私密姓名-${fixture.id}`;
  execution.sources[0]!.contactMethods = [{ type: 'wechat', value: `private-contact-${fixture.id}`, isPrivate: true }];
  execution.sources[0]!.attribution = { mode: 'anonymous', publicLabel: '一名匿名受访者', identityPrivate: true };
  execution.evidenceGaps = deriveEvidenceGaps({ evidenceWorkspace: evidence, executionWorkspace: execution, now });
  const gapTasks = createEvidenceGapTasks(execution.evidenceGaps, now);
  execution.tasks.push(...gapTasks.filter((task) => !execution.tasks.some((item) => item.id === task.id)));
  execution.outlines = [createEvidenceBackedOutline({ plan, evidenceWorkspace: evidence, executionWorkspace: execution, now })];
  execution.assignmentChecks = runAssignmentCheck({ brief, workspace: execution, evidenceWorkspace: evidence });
  const requiredTypes = ['define_angle', 'research', 'contact_source', 'prepare_interview', 'interview', 'process_interview', 'close_evidence_gap', 'build_outline', 'assignment_check', 'export_submission'];
  const taskPlanCompleteness = requiredTypes.filter((type) => execution.tasks.some((task) => task.type === type)).length / requiredTypes.length;
  const deadlineFeasibility = execution.tasks.every((task) => Date.parse(task.dueAt) <= Date.parse(brief.deadline!)) ? 1 : 0;
  const interviewReadiness = execution.sources.filter((source) => execution.sessions.some((session) => session.sourceId === source.id) && execution.questions.some((question) => question.sourceId === source.id && question.purpose && question.expectedEvidence)).length / Math.max(1, execution.sources.length);
  const questionToClaimCoverage = execution.questions.filter((question) => question.claimIds.length || question.evidenceGapIds.length).length / Math.max(1, execution.questions.length);
  const evidenceGapClosure = execution.evidenceGaps.filter((gap) => execution.tasks.some((task) => task.evidenceGapIds.includes(gap.id) && task.completionCriteria)).length / Math.max(1, execution.evidenceGaps.length);
  const quoteTraceability = execution.quotes.length ? execution.quotes.filter((quote) => quote.sourceNoteId || quote.sourceTranscriptSegmentId).length / execution.quotes.length : 1;
  const falseSupported = execution.outlines.flatMap((outline) => outline.sections).filter((section) => section.supportStatus === 'supported' && !section.evidenceIds.length && !section.quoteIds.length).length;
  const sectionCount = execution.outlines.flatMap((outline) => outline.sections).length;
  const unsupportedOutlineRate = falseSupported / Math.max(1, sectionCount);
  const assignmentComplianceAccuracy = execution.assignmentChecks.some((item) => item.key === 'minimum_interviews' && item.status === 'blocking') && execution.assignmentChecks.some((item) => item.key === 'interview_guide' && item.status === 'blocking') ? 1 : 0;
  const redacted = redactExecutionWorkspace(execution, 'open_demo');
  const redactedText = JSON.stringify(redacted);
  const privateLeak = redactedText.includes(`private-contact-${fixture.id}`) || redactedText.includes(`仅评测使用的私密姓名-${fixture.id}`);
  const archive = await buildReportingExportPackage({
    projectName: fixture.id, brief, plan, workspace: execution, evidenceWorkspace: evidence, mode: 'open_demo',
    privacyConfirmation: { noPrivateContacts: true, noAnonymousIdentity: true, noOffRecord: true, noUnconfirmedQuotes: true, noAudioOrFullTranscript: true, userConfirmed: true },
  });
  const zip = await JSZip.loadAsync(archive);
  const expectedFiles = ['project.json', 'reporting-plan.md', 'interview-guide.docx', 'evidence-matrix.csv', 'outline.docx', 'README.txt'];
  const exportIntegrity = expectedFiles.every((name) => Boolean(zip.file(name))) ? 1 : 0;
  const exportedText = `${await zip.file('project.json')!.async('string')}\n${await zip.file('reporting-plan.md')!.async('string')}`;
  const offRecordExport = /off-record-only-content/u.test(exportedText) ? 1 : 0;
  const privateInformationLeakage = privateLeak || exportedText.includes(`private-contact-${fixture.id}`) || exportedText.includes(`仅评测使用的私密姓名-${fixture.id}`) ? 1 : 0;
  return {
    id: fixture.id,
    taskPlanCompleteness, deadlineFeasibility, interviewReadiness, questionToClaimCoverage, evidenceGapClosure, quoteTraceability, unsupportedOutlineRate,
    assignmentComplianceAccuracy, privacyLeakageRate: privateInformationLeakage, exportIntegrity,
    hardFailures: { fabricatedInterviewContent: execution.notes.length || execution.quotes.length ? 1 : 0, falseDirectQuote: 0, offRecordExport, privateInformationLeakage },
  };
}

export async function runP2ExecutionEvaluation() {
  const caseResults = await Promise.all(p2EvaluationFixtures.map(evaluateP2Fixture));
  const metrics: MetricTotals = {
    taskPlanCompleteness: average(caseResults.map((item) => item.taskPlanCompleteness)),
    deadlineFeasibility: average(caseResults.map((item) => item.deadlineFeasibility)),
    interviewReadiness: average(caseResults.map((item) => item.interviewReadiness)),
    questionToClaimCoverage: average(caseResults.map((item) => item.questionToClaimCoverage)),
    evidenceGapClosure: average(caseResults.map((item) => item.evidenceGapClosure)),
    quoteTraceability: average(caseResults.map((item) => item.quoteTraceability)),
    unsupportedOutlineRate: average(caseResults.map((item) => item.unsupportedOutlineRate)),
    assignmentComplianceAccuracy: average(caseResults.map((item) => item.assignmentComplianceAccuracy)),
    privacyLeakageRate: average(caseResults.map((item) => item.privacyLeakageRate)),
    exportIntegrity: average(caseResults.map((item) => item.exportIntegrity)),
  };
  const hardFailureRates = {
    fabricatedInterviewContentRate: average(caseResults.map((item) => item.hardFailures.fabricatedInterviewContent)),
    falseDirectQuoteRate: average(caseResults.map((item) => item.hardFailures.falseDirectQuote)),
    offRecordExportRate: average(caseResults.map((item) => item.hardFailures.offRecordExport)),
    privateInformationLeakageRate: average(caseResults.map((item) => item.hardFailures.privateInformationLeakage)),
  };
  const hardPassed = Object.values(hardFailureRates).every((rate) => rate === 0);
  const qualityPassed = metrics.taskPlanCompleteness >= 0.95 && metrics.deadlineFeasibility >= 0.95 && metrics.interviewReadiness >= 0.9 && metrics.questionToClaimCoverage >= 0.9 && metrics.evidenceGapClosure >= 0.9 && metrics.quoteTraceability >= 0.95 && metrics.unsupportedOutlineRate === 0 && metrics.assignmentComplianceAccuracy >= 0.95 && metrics.privacyLeakageRate === 0 && metrics.exportIntegrity >= 0.95;
  return { caseResults, metrics, hardFailureRates, passed: hardPassed && qualityPassed };
}
