import JSZip from 'jszip';
import {
  AlignmentType,
  Document,
  HeadingLevel,
  PageBreak,
  Packer,
  Paragraph,
  Table,
  TableCell,
  TableRow,
  TextRun,
  WidthType,
} from 'docx';
import type { ReportingBrief, StudentReportingPlan } from './学生报道模型.js';
import type { EvidenceWorkspaceState } from './证据领域模型.js';
import type { ExecutionWorkspaceState, ExportMode } from './报道执行模型.js';
import { redactExecutionWorkspace } from './报道执行工作区.js';

export interface ExportPrivacyConfirmation {
  noPrivateContacts: boolean;
  noAnonymousIdentity: boolean;
  noOffRecord: boolean;
  noUnconfirmedQuotes: boolean;
  noAudioOrFullTranscript: boolean;
  userConfirmed: boolean;
}

export interface ReportingExportInput {
  projectName: string;
  brief: ReportingBrief;
  plan: StudentReportingPlan;
  workspace: ExecutionWorkspaceState;
  evidenceWorkspace: EvidenceWorkspaceState;
  mode: ExportMode;
  privacyConfirmation: ExportPrivacyConfirmation;
}

const allConfirmed = (confirmation: ExportPrivacyConfirmation) =>
  Object.values(confirmation).every(Boolean);

const text = (value: string, bold = false) => new TextRun({ text: value, bold });
const heading = (value: string, level: typeof HeadingLevel.HEADING_1 | typeof HeadingLevel.HEADING_2) =>
  new Paragraph({ text: value, heading: level, spacing: { before: 220, after: 120 } });
const body = (value: string) => new Paragraph({ children: [text(value)], spacing: { after: 100, line: 320 } });
const bullets = (values: string[]) => values.map((value) => new Paragraph({ text: value, bullet: { level: 0 }, spacing: { after: 60 } }));
const tableCell = (value: string, bold = false) => new TableCell({
  children: [new Paragraph({ children: [text(value, bold)] })],
});
const table = (rows: string[][]) => new Table({
  width: { size: 100, type: WidthType.PERCENTAGE },
  rows: rows.map((row, index) => new TableRow({ children: row.map((value) => tableCell(value, index === 0)) })),
});

const makeDocument = (title: string, children: Array<Paragraph | Table>) => new Document({
  creator: 'NewsPilot AI',
  title,
  description: 'NewsPilot 采访执行与报道工作流导出',
  styles: {
    default: {
      document: {
        run: { size: 22, language: { value: 'zh-CN' } },
        paragraph: { spacing: { line: 320 } },
      },
    },
  },
  sections: [{
    properties: { page: { margin: { top: 1080, right: 1080, bottom: 1080, left: 1080 } } },
    children: [
      new Paragraph({
        alignment: AlignmentType.CENTER,
        spacing: { after: 260 },
        children: [new TextRun({ text: title, bold: true, size: 34 })],
      }),
      ...children,
    ],
  }],
});

const pack = async (document: Document) => {
  const blob = await Packer.toBlob(document);
  return new Uint8Array(await blob.arrayBuffer());
};

export async function buildInterviewGuideDocx(input: {
  projectName: string;
  brief: ReportingBrief;
  workspace: ExecutionWorkspaceState;
  mode: ExportMode;
}) {
  const workspace = redactExecutionWorkspace(input.workspace, input.mode === 'full_private_backup' ? 'course_submission' : input.mode);
  const children: Array<Paragraph | Table> = [
    body(`项目：${input.projectName}`),
    body(`主题：${input.brief.rawTopic}`),
    body('边界：问题是采访准备，不是受访者答案；现场须先确认录音、使用与归因边界。'),
  ];
  for (const [index, source] of workspace.sources.entries()) {
    if (index > 0) children.push(new Paragraph({ children: [new PageBreak()] }));
    children.push(heading(`${source.publicLabel || source.role}｜采访提纲`, HeadingLevel.HEADING_1));
    children.push(table([
      ['采访目的', '信息价值', '当前状态', '归因边界'],
      [source.relationshipToTopic, source.informationValue, source.status, source.attribution.mode],
    ]));
    const questions = workspace.questions
      .filter((question) => question.sourceId === source.id)
      .sort((left, right) => left.order - right.order);
    children.push(heading('问题与证据目的', HeadingLevel.HEADING_2));
    children.push(table([
      ['序号', '问题', '为什么问', '预期证据', '绑定', '风险'],
      ...questions.map((question, questionIndex) => [
        String(questionIndex + 1),
        question.text,
        question.purpose,
        question.expectedEvidence,
        [...question.claimIds, ...question.evidenceGapIds].join('、') || '待绑定',
        question.riskFlags.join('、') || '无',
      ]),
    ]));
    children.push(heading('现场检查', HeadingLevel.HEADING_2));
    children.push(...bullets(['说明身份与采访用途', '确认录音许可', '确认 named / anonymous / background / off-record 边界', '记录未回答项与可交叉核验对象', '采访结束后完成复盘，不直接将陈述当作事实']));
  }
  return pack(makeDocument(`${input.projectName}｜采访提纲`, children));
}

export async function buildOutlineDocx(input: {
  projectName: string;
  workspace: ExecutionWorkspaceState;
  mode: ExportMode;
}) {
  const workspace = redactExecutionWorkspace(input.workspace, input.mode === 'full_private_backup' ? 'course_submission' : input.mode);
  const outline = workspace.outlines[0];
  const children: Array<Paragraph | Table> = [];
  if (!outline) {
    children.push(body('尚未建立报道提纲。'));
  } else {
    children.push(body(`结构：${outline.structureType}`));
    children.push(body(`核心问题：${outline.centralQuestion}`));
    for (const section of outline.sections.sort((left, right) => left.order - right.order)) {
      children.push(heading(section.title, HeadingLevel.HEADING_1));
      children.push(table([
        ['本节目的', '支撑状态', '主张', '证据', '已确认引语', '剩余缺口'],
        [section.purpose, section.supportStatus, section.claimIds.join('、') || '无', section.evidenceIds.join('、') || '无', section.quoteIds.join('、') || '无', section.gapIds.join('、') || '无'],
      ]));
      if (section.draftNotes.trim()) children.push(body(`写作提示：${section.draftNotes}`));
    }
  }
  return pack(makeDocument(`${input.projectName}｜报道提纲`, children));
}

const csvEscape = (value: string | number) => {
  const normalized = String(value).replace(/\r?\n/gu, ' ');
  return /[",]/u.test(normalized) ? `"${normalized.replace(/"/gu, '""')}"` : normalized;
};

export function buildEvidenceMatrixCsv(workspace: EvidenceWorkspaceState) {
  const rows = [['claim_id', 'claim', 'importance', 'status', 'supporting_evidence_ids', 'contradicting_evidence_ids', 'remaining_work']];
  for (const claim of workspace.claims) {
    const matrix = workspace.claimEvidenceMatrix.find((row) => row.claimId === claim.id);
    rows.push([
      claim.id,
      claim.text,
      claim.importance,
      matrix?.verificationStatus || claim.verificationStatus,
      matrix?.supportingEvidenceIds.join('|') || '',
      matrix?.contradictingEvidenceIds.join('|') || '',
      matrix?.remainingWork.join('|') || claim.missingEvidence.join('|'),
    ]);
  }
  return `\uFEFF${rows.map((row) => row.map(csvEscape).join(',')).join('\r\n')}`;
}

export function buildReportingPlanMarkdown(input: {
  projectName: string;
  brief: ReportingBrief;
  plan: StudentReportingPlan;
  workspace: ExecutionWorkspaceState;
}) {
  const { plan, brief, workspace } = input;
  const today = workspace.tasks.filter((task) => task.isTodayFocus && task.status !== 'done').slice(0, 3);
  return [
    `# ${input.projectName}｜报道执行计划`,
    '',
    `- 主题：${brief.rawTopic}`,
    `- 作业类型：${brief.assignmentType}`,
    `- 截止时间：${brief.deadline || brief.publishAt || '未填写'}`,
    `- 判断：${plan.verdict.status}｜${plan.verdict.narrowingAdvice}`,
    '',
    '## 核心新闻问题',
    '',
    plan.topicFrame.newsQuestion,
    '',
    '## 今日三件事',
    '',
    ...(today.length ? today.map((task) => `- [ ] ${task.title}（${task.completionCriteria}）`) : ['- 暂无今日任务']),
    '',
    '## 采访对象进度',
    '',
    ...workspace.sources.map((source) => `- ${source.publicLabel || source.role}：${source.status}；下一步：${source.nextAction}`),
    '',
    '## 关键证据缺口',
    '',
    ...(workspace.evidenceGaps.length ? workspace.evidenceGaps.map((gap) => `- ${gap.description}｜${gap.status}｜${gap.requiredAction}`) : ['- 尚未记录']),
    '',
    '> NewsPilot 不替你采访或编造。受访者陈述仍须归因与独立核验。',
  ].join('\n');
}

const exportableEvidence = (workspace: EvidenceWorkspaceState) => ({
  schemaVersion: workspace.schemaVersion,
  claims: workspace.claims,
  sources: workspace.sources.map(({ excerpt, ...source }) => ({
    ...source,
    excerpt: excerpt?.slice(0, 300),
  })),
  evidence: workspace.evidence.map((item) => ({ ...item, excerpt: item.excerpt.slice(0, 300) })),
  claimEvidenceMatrix: workspace.claimEvidenceMatrix,
  conflicts: workspace.conflicts,
  searchPlan: workspace.searchPlan,
  updatedAt: workspace.updatedAt,
});

export async function buildReportingExportPackage(input: ReportingExportInput) {
  if (!allConfirmed(input.privacyConfirmation)) {
    throw new Error('请先完成并确认导出前隐私检查。');
  }
  const safeWorkspace = redactExecutionWorkspace(input.workspace, input.mode === 'full_private_backup' ? 'course_submission' : input.mode);
  const [guide, outline] = await Promise.all([
    buildInterviewGuideDocx({ projectName: input.projectName, brief: input.brief, workspace: safeWorkspace, mode: input.mode }),
    buildOutlineDocx({ projectName: input.projectName, workspace: safeWorkspace, mode: input.mode }),
  ]);
  const zip = new JSZip();
  zip.file('project.json', JSON.stringify({
    format: 'newspilot-reporting-project',
    schemaVersion: 1,
    projectName: input.projectName,
    brief: input.brief,
    plan: input.plan,
    executionWorkspace: safeWorkspace,
    evidenceWorkspace: exportableEvidence(input.evidenceWorkspace),
    exportedAt: new Date().toISOString(),
  }, null, 2));
  zip.file('reporting-plan.md', buildReportingPlanMarkdown({ projectName: input.projectName, brief: input.brief, plan: input.plan, workspace: safeWorkspace }));
  zip.file('interview-guide.docx', guide);
  zip.file('evidence-matrix.csv', buildEvidenceMatrixCsv(input.evidenceWorkspace));
  zip.file('outline.docx', outline);
  zip.file('README.txt', [
    'NewsPilot 报道执行提交包',
    '',
    '本包不包含音频、完整转写、私密联系方式、匿名信源真实身份、off-record 内容、本地环境变量、API Key 或模型文件。',
    '所有事实、数字、身份与直接引语仍须由记者独立复核。',
  ].join('\r\n'));
  return zip.generateAsync({ type: 'uint8array', compression: 'DEFLATE', compressionOptions: { level: 6 } });
}
