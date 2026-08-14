import type { ReportingBrief } from './学生报道模型.js';
import type { EvidenceWorkspaceState, Claim, EvidenceItem, ConflictRecord } from './证据领域模型.js';
import type {
  AssignmentCheckItem,
  ExecutionWorkspaceState,
  QuoteCandidate,
  StoryOutlineSection,
} from './报道执行模型.js';
import { canUseAsDirectQuote } from './报道执行工作区.js';

export function evaluateOutlineSupport(input: {
  section: StoryOutlineSection;
  claims: Claim[];
  evidence: EvidenceItem[];
  quotes: QuoteCandidate[];
  conflicts: ConflictRecord[];
}) {
  const reasons: string[] = [];
  const validClaimIds = new Set(input.claims.map((claim) => claim.id));
  const validEvidenceIds = new Set(input.evidence.filter((item) => item.userConfirmed).map((item) => item.id));
  const validQuoteIds = new Set(input.quotes.filter((quote) => canUseAsDirectQuote(quote).ok).map((quote) => quote.id));
  const unresolvedConflicts = input.conflicts.filter((conflict) =>
    conflict.status === 'open' && input.section.claimIds.includes(conflict.claimId),
  );
  if (input.section.claimIds.some((id) => !validClaimIds.has(id))) reasons.push('包含不存在或未保留的主张。');
  if (input.section.claimIds.length && !input.section.evidenceIds.some((id) => validEvidenceIds.has(id))) reasons.push('主张缺少已确认、可定位的证据。');
  if (input.section.quoteIds.some((id) => !validQuoteIds.has(id))) reasons.push('包含未确认或不可使用的直接引语。');
  if (unresolvedConflicts.length) reasons.push('关键主张仍有未解决的来源冲突。');
  const hasAnySupport = input.section.evidenceIds.some((id) => validEvidenceIds.has(id)) || input.section.quoteIds.some((id) => validQuoteIds.has(id));
  const status = unresolvedConflicts.length
    ? 'conflicted'
    : reasons.length === 0 && hasAnySupport
      ? 'supported'
      : hasAnySupport
        ? 'partial'
        : 'unsupported';
  return { status: status as StoryOutlineSection['supportStatus'], reasons };
}

const check = (
  key: AssignmentCheckItem['key'],
  label: string,
  status: AssignmentCheckItem['status'],
  detail: string,
  action?: string,
): AssignmentCheckItem => ({ id: `check-${key}`, key, label, status, detail, action });

export function runAssignmentCheck(input: {
  brief: ReportingBrief;
  workspace: ExecutionWorkspaceState;
  evidenceWorkspace: EvidenceWorkspaceState;
}): AssignmentCheckItem[] {
  const { brief, workspace, evidenceWorkspace } = input;
  const completedSessions = workspace.sessions.filter((session) => session.status === 'completed');
  const completedSourceTypes = new Set(
    completedSessions
      .map((session) => workspace.sources.find((source) => source.id === session.sourceId)?.sourceType)
      .filter(Boolean),
  );
  const minimum = brief.minimumInterviewees || 0;
  const deadline = brief.deadline || brief.publishAt;
  const criticalRows = evidenceWorkspace.claimEvidenceMatrix.filter((row) =>
    evidenceWorkspace.claims.find((claim) => claim.id === row.claimId)?.importance === 'critical',
  );
  const invalidQuotes = workspace.quotes.filter((quote) => !canUseAsDirectQuote(quote).ok);
  const hasPrivacy = workspace.notes.some((note) => note.isPrivate);
  const hasOffRecord = workspace.notes.some((note) => note.isOffRecord) || workspace.quotes.some((quote) => quote.isOffRecord);
  const completedSourceIds = new Set(completedSessions.map((session) => session.sourceId));
  const sourcesRequiringGuide = completedSessions.length >= minimum && completedSessions.length > 0
    ? workspace.sources.filter((source) => completedSourceIds.has(source.id))
    : workspace.sources.filter((source) => !['dropped', 'declined'].includes(source.status));
  const questionsReady = sourcesRequiringGuide.length > 0 && sourcesRequiringGuide.every((source) => {
    const sourceQuestions = workspace.questions.filter((question) => question.sourceId === source.id);
    return sourceQuestions.length > 0 && sourceQuestions.every((question) => question.userConfirmed);
  });
  const outline = workspace.outlines[0];

  return [
    check('assignment_type', '作业类型', brief.assignmentType ? 'passed' : 'blocking', brief.assignmentType || '未填写', '回到任务页填写作业类型。'),
    check('deadline', '截止时间', deadline && !Number.isNaN(Date.parse(deadline)) ? 'passed' : 'blocking', deadline || '未填写', '填写有效截止时间。'),
    check('minimum_interviews', '最低采访数量', completedSessions.length >= minimum ? 'passed' : 'blocking', `已完成 ${completedSessions.length}/${minimum} 次采访`, '完成采访并通过采访后复盘门槛。'),
    check('source_diversity', '信源多样性', !brief.requiresDifferentSourceTypes || completedSourceTypes.size >= Math.min(2, minimum) ? 'passed' : 'blocking', `已完成 ${completedSourceTypes.size} 类信源`, '补充不同关系和立场的采访对象。'),
    check('protagonist', '人物入口', !brief.requiresHumanStory || completedSessions.length > 0 ? 'passed' : 'warning', completedSessions.length ? '已有真实采访材料' : '尚无真实人物材料', '完成至少一次与受影响者的采访。'),
    check('different_views', '不同观点', completedSourceTypes.size >= 2 ? 'passed' : 'warning', completedSourceTypes.size >= 2 ? '已有不同类型信源' : '观点结构仍单一', '补一类立场或关系不同的信源。'),
    check('scene', '场景材料', workspace.notes.some((note) => note.kind === 'fact' || note.kind === 'paraphrase') ? 'passed' : 'warning', '根据已复核采访笔记判断', '记录具体时间、地点、动作与感官细节。'),
    check('interview_guide', '采访提纲', questionsReady ? 'passed' : 'blocking', questionsReady ? '关键对象提纲已确认' : '存在未人工确认的提纲', '逐题检查绑定和风险后确认。'),
    check('interview_summary', '采访总结', !brief.requiresInterviewSummary || completedSessions.every((session) => Boolean(session.debrief)) ? 'passed' : 'blocking', '按真实采访复盘记录判断', '完成采访后复盘。'),
    check('word_count', '字数记录', brief.targetLength ? 'passed' : 'warning', brief.targetLength ? `目标 ${brief.targetLength} 字` : '未记录', '填写目标字数。'),
    check('critical_claims', '关键主张', criticalRows.every((row) => row.verificationStatus === 'verified') && criticalRows.length > 0 ? 'passed' : 'blocking', `${criticalRows.filter((row) => row.verificationStatus === 'verified').length}/${criticalRows.length} 已核实`, '关闭关键证据缺口或删去不能支撑的主张。'),
    check('conflicts', '来源冲突', evidenceWorkspace.conflicts.some((conflict) => conflict.status === 'open') ? 'blocking' : 'passed', evidenceWorkspace.conflicts.some((conflict) => conflict.status === 'open') ? '仍有未解决冲突' : '无开放冲突', '保留冲突并继续核验，不能自动裁决。'),
    check('unconfirmed_quote', '引语确认', invalidQuotes.length ? 'blocking' : 'passed', invalidQuotes.length ? `${invalidQuotes.length} 条不可用引语` : '无不可用引语', '回听、复核并确认归因，或移除引语。'),
    check('off_record', 'Off-record', hasOffRecord ? 'warning' : 'passed', hasOffRecord ? '存在仅限内部材料，导出必须排除' : '无 off-record 材料', '使用提交或脱敏导出模式。'),
    check('privacy', '隐私', hasPrivacy ? 'warning' : 'passed', hasPrivacy ? '存在私密笔记，导出必须排除' : '未发现私密笔记', '提交前确认隐私检查清单。'),
    check('file_format', '提交格式', /docx/i.test(brief.formatRequirements || '') ? 'passed' : 'warning', brief.formatRequirements || '未明确', '确认课程要求的文件格式。'),
    check('file_name', '文件命名', outline?.workingTitle.trim() ? 'passed' : 'warning', outline?.workingTitle || '尚未命名', '设置清晰的报道标题和导出文件名。'),
  ];
}
