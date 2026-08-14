import type { StudentReportingPlan } from './学生报道模型.js';
import type { EvidenceWorkspaceState } from './证据领域模型.js';
import type {
  EvidenceGap,
  ExecutionWorkspaceState,
  StoryOutline,
  StoryOutlineSection,
  StoryStructureType,
} from './报道执行模型.js';
import { canUseAsDirectQuote } from './报道执行工作区.js';
import { evaluateOutlineSupport } from './报道提交检查.js';

const gapTypeFor = (value: string): EvidenceGap['type'] => {
  if (/原始|文件|通知|规定|制度/u.test(value)) return 'original_document';
  if (/回应|当事方|校方|平台|商家/u.test(value)) return 'party_response';
  if (/不同|反方|相反|对立/u.test(value)) return 'opposing_view';
  if (/数字|数据|比例|人数|统计/u.test(value)) return 'data';
  if (/时间|先后|日期/u.test(value)) return 'timeline';
  if (/范围|地域|人群|口径/u.test(value)) return 'scope_mismatch';
  return 'corroboration';
};

export function deriveEvidenceGaps(input: {
  evidenceWorkspace: EvidenceWorkspaceState;
  executionWorkspace: ExecutionWorkspaceState;
  now?: string;
}): EvidenceGap[] {
  const timestamp = input.now || new Date().toISOString();
  const candidates: Array<Omit<EvidenceGap, 'id' | 'createdAt' | 'updatedAt'>> = [];
  for (const claim of input.evidenceWorkspace.claims) {
    const matrix = input.evidenceWorkspace.claimEvidenceMatrix.find((row) => row.claimId === claim.id);
    const remaining = matrix?.remainingWork.length ? matrix.remainingWork : claim.missingEvidence;
    if (claim.verificationStatus !== 'verified' && remaining.length) {
      for (const item of remaining.slice(0, 3)) {
        candidates.push({
          type: gapTypeFor(item),
          claimIds: [claim.id],
          description: item,
          status: 'open',
          requiredAction: `为主张 ${claim.id} 补充：${item}`,
        });
      }
    }
  }
  for (const conflict of input.evidenceWorkspace.conflicts.filter((item) => item.status === 'open')) {
    candidates.push({
      type: conflict.type === 'numeric' ? 'numeric_conflict' : conflict.type === 'scope' ? 'scope_mismatch' : 'corroboration',
      claimIds: [conflict.claimId],
      description: conflict.explanation,
      status: 'open',
      requiredAction: conflict.nextSteps.join('；') || '寻找独立来源解释冲突。',
    });
  }
  for (const source of input.executionWorkspace.sources) {
    if (source.status === 'unreachable') {
      candidates.push({
        type: 'source_unreachable', claimIds: [], sourceIds: [source.id],
        description: `${source.publicLabel || source.role} 暂时无法联系`, status: 'open',
        requiredAction: '记录已尝试渠道并启用替代信源。',
      });
    }
    if (source.attribution.mode === 'anonymous') {
      candidates.push({
        type: 'anonymous_source_risk', claimIds: [], sourceIds: [source.id],
        description: `${source.publicLabel || source.role} 使用匿名归因`, status: 'open',
        requiredAction: '记录匿名必要性、身份核验方式和可能的编辑风险。',
      });
    }
    if (source.attribution.mode === 'unconfirmed') {
      candidates.push({
        type: 'attribution_unconfirmed', claimIds: [], sourceIds: [source.id],
        description: `${source.publicLabel || source.role} 尚未确认归因边界`, status: 'open',
        requiredAction: '采访开始前确认 named、anonymous、background 或 off-record。',
      });
    }
  }
  for (const quote of input.executionWorkspace.quotes.filter((item) => !canUseAsDirectQuote(item).ok)) {
    candidates.push({
      type: 'quote_unconfirmed', claimIds: [], sourceIds: [quote.sourceId],
      description: `候选引语 ${quote.id} 尚不可直接使用`, status: 'open',
      requiredAction: '回听或逐字复核，确认文本和归因；否则删除直接引语。',
    });
  }
  const seen = new Set<string>();
  return candidates.filter((gap) => {
    const key = `${gap.type}:${gap.claimIds.join('|')}:${gap.sourceIds?.join('|') || ''}:${gap.description}`;
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  }).map((gap, index) => ({
    ...gap,
    id: `gap-${String(index + 1).padStart(3, '0')}`,
    createdAt: timestamp,
    updatedAt: timestamp,
  }));
}

const outlineTemplates: Record<StoryStructureType, Array<{ title: string; purpose: string }>> = {
  profile: [
    { title: '人物场景', purpose: '用已记录的真实场景建立人物入口。' },
    { title: '关键经历', purpose: '按时间线呈现已核实的关键经历。' },
    { title: '制度与环境', purpose: '解释人物处境背后的规则和环境。' },
    { title: '回应与复杂性', purpose: '纳入不同观点、矛盾和未解问题。' },
  ],
  campus_phenomenon: [
    { title: '可观察场景', purpose: '从真实场景说明现象如何发生。' },
    { title: '影响范围', purpose: '用采访与数据限定影响对象和范围。' },
    { title: '原因与机制', purpose: '区分事实、解释和工作假设。' },
    { title: '不同立场与下一步', purpose: '保留不同回应和待核验缺口。' },
  ],
  policy_implementation: [
    { title: '政策与时间线', purpose: '交代原始政策、适用范围和实施节点。' },
    { title: '执行现场', purpose: '用可核实的执行细节展示规则落地。' },
    { title: '受影响群体', purpose: '呈现不同群体的具体经历与差异。' },
    { title: '制定者与专家回应', purpose: '纳入政策目的、回应和独立解释。' },
  ],
  data_investigation: [
    { title: '核心发现', purpose: '只呈现有口径和出处的数据发现。' },
    { title: '数据方法', purpose: '说明数据来源、时间、范围和限制。' },
    { title: '人物验证', purpose: '用采访检验数据在现实中的含义。' },
    { title: '反例与限制', purpose: '保留冲突、反例和不能支持的结论。' },
  ],
  hard_news: [
    { title: '最新事实', purpose: '回答何时、何地、何事及已确认影响。' },
    { title: '关键细节', purpose: '补充已核实的时间线与现场信息。' },
    { title: '各方回应', purpose: '呈现相关方可归因回应。' },
    { title: '背景与待核实', purpose: '提供必要背景并明确仍未知之处。' },
  ],
  change_story: [
    { title: '变化前后', purpose: '用可比较证据说明变化。' },
    { title: '变化如何发生', purpose: '建立有证据支持的时间线和机制。' },
    { title: '谁受到影响', purpose: '用人物材料呈现影响差异。' },
    { title: '争议与后续', purpose: '保留不同判断和下一步观察点。' },
  ],
};

const chooseStructure = (plan: StudentReportingPlan): StoryStructureType => {
  if (plan.brief.assignmentType === '人物特稿') return 'profile';
  if (plan.brief.assignmentType === '消息') return 'hard_news';
  if (/政策|规定|制度|通知/u.test(plan.brief.rawTopic)) return 'policy_implementation';
  if (/数据|比例|人数|统计/u.test(plan.brief.rawTopic)) return 'data_investigation';
  if (/变化|前后|改革/u.test(plan.brief.rawTopic)) return 'change_story';
  return 'campus_phenomenon';
};

export function createEvidenceBackedOutline(input: {
  plan: StudentReportingPlan;
  evidenceWorkspace: EvidenceWorkspaceState;
  executionWorkspace: ExecutionWorkspaceState;
  structureType?: StoryStructureType;
  now?: string;
}): StoryOutline {
  const timestamp = input.now || new Date().toISOString();
  const structureType = input.structureType || chooseStructure(input.plan);
  const claimIds = input.evidenceWorkspace.claims.map((claim) => claim.id);
  const evidenceIds = input.evidenceWorkspace.evidence.filter((item) => item.userConfirmed).map((item) => item.id);
  const quoteIds = input.executionWorkspace.quotes.filter((quote) => canUseAsDirectQuote(quote).ok).map((quote) => quote.id);
  const openGapIds = input.executionWorkspace.evidenceGaps.filter((gap) => gap.status === 'open' || gap.status === 'in_progress').map((gap) => gap.id);
  const sections = outlineTemplates[structureType].map((template, index): StoryOutlineSection => {
    const section: StoryOutlineSection = {
      id: `outline-section-${index + 1}`,
      title: template.title,
      purpose: template.purpose,
      materialIds: [],
      claimIds: index === 0 ? claimIds.slice(0, 1) : claimIds.slice(index, index + 1),
      quoteIds: index === 0 ? quoteIds.slice(0, 1) : [],
      evidenceIds: index === 0 ? evidenceIds.slice(0, 2) : evidenceIds.slice(index, index + 1),
      gapIds: openGapIds.slice(index, index + 1),
      draftNotes: '',
      supportStatus: 'unsupported',
      order: index + 1,
    };
    const assessment = evaluateOutlineSupport({
      section,
      claims: input.evidenceWorkspace.claims,
      evidence: input.evidenceWorkspace.evidence,
      quotes: input.executionWorkspace.quotes,
      conflicts: input.evidenceWorkspace.conflicts,
    });
    return { ...section, supportStatus: assessment.status };
  });
  return {
    id: 'outline-main',
    structureType,
    workingTitle: input.plan.candidateAngles.find((angle) => angle.id === input.plan.recommendedAngleId)?.title || input.plan.brief.rawTopic,
    centralQuestion: input.plan.topicFrame.newsQuestion,
    sections,
    updatedAt: timestamp,
  };
}

export function createInterviewSummary(workspace: ExecutionWorkspaceState, sourceId: string) {
  const source = workspace.sources.find((item) => item.id === sourceId);
  const sessionIds = new Set(workspace.sessions.filter((session) => session.sourceId === sourceId).map((session) => session.id));
  const notes = workspace.notes.filter((note) => sessionIds.has(note.sessionId) && note.reviewStatus === 'confirmed' && !note.isPrivate && !note.isOffRecord);
  const debriefs = workspace.sessions.filter((session) => sessionIds.has(session.id) && session.debrief).map((session) => session.debrief!);
  const lines = [
    `# ${source?.publicLabel || source?.role || '采访对象'}｜采访总结`,
    '',
    '以下内容只来自已记录并复核的采访笔记，仍是受访者陈述，仍须独立核验并明确归因。',
    '',
    '## 已记录要点',
    ...(notes.length ? notes.map((note) => `- [${note.kind}] ${note.text}`) : ['- 尚无已复核要点']),
    '',
    '## 未回答问题',
    ...debriefs.flatMap((debrief) => debrief.unansweredQuestionIds).map((id) => `- ${id}`),
    '',
    '## 后续行动',
    ...debriefs.flatMap((debrief) => debrief.followUpTaskIds).map((id) => `- ${id}`),
  ];
  return lines.join('\n');
}
