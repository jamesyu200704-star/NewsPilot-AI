import type { StudentReportingPlan } from './学生报道模型.js';
import type {
  ExecutionWorkspaceState,
  ExportMode,
  InterviewNote,
  InterviewQuestion,
  InterviewSession,
  InterviewSourceType,
  QuoteCandidate,
  StoryStructureType,
} from './报道执行模型.js';
import { ExecutionPlanner } from './执行计划器.js';
import { assessInterviewQuestion } from './采访执行规则.js';

const isRecord = (value: unknown): value is Record<string, unknown> =>
  Boolean(value) && typeof value === 'object' && !Array.isArray(value);

const mapCategory = (stage: string): InterviewQuestion['category'] => {
  if (stage.includes('破冰')) return 'opening';
  if (stage.includes('事实')) return 'fact';
  if (stage.includes('经历')) return 'experience';
  if (stage.includes('原因')) return 'cause';
  if (stage.includes('冲突')) return 'conflict';
  if (stage.includes('验证')) return 'verification';
  if (stage.includes('追问')) return 'follow_up';
  return 'closing';
};

export const inferInterviewSourceType = (role: string): InterviewSourceType => {
  if (/学生/u.test(role)) return 'student' as const;
  if (/教师|老师/u.test(role)) return 'teacher' as const;
  if (/专家|学者|第三方解释/u.test(role)) return 'expert' as const;
  if (/政策|制定/u.test(role)) return 'policy_maker' as const;
  if (/学校|校方|管理|决策|执行者|负责部门/u.test(role)) return 'school_administrator' as const;
  if (/直接经历|受影响|当事|使用者|消费者/u.test(role)) return 'affected_group' as const;
  if (/商家|企业|平台/u.test(role)) return 'business' as const;
  return 'other' as const;
};

export const createEmptyExecutionWorkspace = (
  timestamp = new Date().toISOString(),
): ExecutionWorkspaceState => ({
  schemaVersion: 1,
  tasks: [],
  sources: [],
  outreachAttempts: [],
  sessions: [],
  questions: [],
  notes: [],
  transcripts: [],
  quotes: [],
  leads: [],
  evidenceGaps: [],
  outlines: [],
  assignmentChecks: [],
  updatedAt: timestamp,
});

export function createExecutionWorkspaceFromPlan(
  plan: StudentReportingPlan,
  timestamp = new Date().toISOString(),
): ExecutionWorkspaceState {
  const sources = plan.sourceMap.map((source, index) => ({
    id: source.id || `source-${index + 1}`,
    identity: '',
    publicLabel: source.role,
    role: source.role,
    sourceType: inferInterviewSourceType(source.role),
    status: 'identified' as const,
    accessibility: source.accessibility,
    informationValue: source.informationValue,
    relationshipToTopic: source.relationshipToTopic,
    possibleBias: source.possibleBias,
    contactMethods: [],
    attribution: { mode: 'unconfirmed' as const, publicLabel: source.role, identityPrivate: true },
    consent: null,
    alternativeSourceIds: [],
    nextAction: '确认具体人选并起草联系消息',
    privateNotes: '',
    createdAt: timestamp,
    updatedAt: timestamp,
  }));

  const claimIds = plan.claimEvidenceMatrix.map((_, index) => `claim-${index + 1}`);
  const generatedQuestions = plan.interviewPlans.flatMap((interviewPlan) =>
    interviewPlan.questions.map((question, index) =>
      assessInterviewQuestion({
        id: `question-${interviewPlan.sourceId}-${index + 1}`,
        sourceId: interviewPlan.sourceId,
        category: mapCategory(question.stage),
        text: question.question,
        purpose: question.purpose,
        expectedEvidence: question.expectedEvidence,
        claimIds: claimIds.length ? [claimIds[index % claimIds.length]!] : [],
        evidenceGapIds: [],
        followUps: [...question.followUps],
        riskFlags: [],
        order: index + 1,
        userConfirmed: false,
      }),
    ),
  );
  const questions = [...generatedQuestions];
  for (const source of sources) {
    if (questions.some((question) => question.sourceId === source.id)) continue;
    const claimBinding = claimIds[0] ? [claimIds[0]] : [];
    questions.push(
      assessInterviewQuestion({
        id: `question-${source.id}-fallback-1`, sourceId: source.id, category: 'fact',
        text: '请按时间顺序说明你亲自经历或负责的具体环节，并区分亲历与转述。',
        purpose: '建立可核对的基本时间线与信息边界。', expectedEvidence: '时间、地点、具体动作、文件名称和可交叉核验对象。',
        claimIds: claimBinding, evidenceGapIds: [], followUps: ['哪一部分是你亲自看到或负责的？'], riskFlags: [], order: 1, userConfirmed: false,
      }),
      assessInterviewQuestion({
        id: `question-${source.id}-fallback-2`, sourceId: source.id, category: 'verification',
        text: '有哪些公开文件、记录或其他采访对象可以帮助我们核对这段陈述？',
        purpose: '为采访陈述寻找独立验证路径。', expectedEvidence: '原始文件名称、可访问记录或独立信源角色。',
        claimIds: claimBinding, evidenceGapIds: [], followUps: ['这些材料的时间范围和适用对象是什么？'], riskFlags: [], order: 2, userConfirmed: false,
      }),
    );
  }

  const sessions = sources.map((source) => ({
    id: `session-${source.id}`,
    sourceId: source.id,
    status: 'planned' as const,
    purpose: source.informationValue,
    consent: null,
    questionIds: questions.filter((question) => question.sourceId === source.id).map((question) => question.id),
    createdAt: timestamp,
    updatedAt: timestamp,
  }));

  const structureType: StoryStructureType =
    plan.brief.assignmentType === '人物特稿'
      ? 'profile'
      : /政策|规定|制度/u.test(plan.brief.rawTopic)
        ? 'policy_implementation'
        : plan.brief.assignmentType === '消息'
          ? 'hard_news'
          : 'campus_phenomenon';

  return {
    ...createEmptyExecutionWorkspace(timestamp),
    sources,
    questions,
    sessions,
    tasks: new ExecutionPlanner().build({
      brief: plan.brief,
      sourceIds: sources.map((source) => source.id),
      now: timestamp,
    }),
    outlines: [{
      id: 'outline-main',
      structureType,
      workingTitle: plan.candidateAngles.find((angle) => angle.id === plan.recommendedAngleId)?.title || plan.brief.rawTopic,
      centralQuestion: plan.topicFrame.newsQuestion,
      sections: [],
      updatedAt: timestamp,
    }],
  };
}

export const isExecutionWorkspace = (value: unknown): value is ExecutionWorkspaceState => {
  if (!isRecord(value)) return false;
  return value.schemaVersion === 1 &&
    ['tasks', 'sources', 'outreachAttempts', 'sessions', 'questions', 'notes', 'transcripts', 'quotes', 'leads', 'evidenceGaps', 'outlines', 'assignmentChecks']
      .every((key) => Array.isArray(value[key])) &&
    (value.sources as unknown[]).every((source) =>
      isRecord(source) && typeof source.role === 'string' && typeof source.sourceType === 'string',
    ) &&
    typeof value.updatedAt === 'string' &&
    !Number.isNaN(Date.parse(value.updatedAt));
};

export function canCompleteInterview(
  session: InterviewSession,
  notes: InterviewNote[],
  questions: InterviewQuestion[],
) {
  const reasons: string[] = [];
  if (!session.consent?.materialUseAllowed) reasons.push('尚未确认材料使用同意。');
  if (!session.consent?.attributionConfirmed) reasons.push('尚未确认归因方式。');
  if (!notes.some((note) => note.sessionId === session.id && note.reviewStatus === 'confirmed')) {
    reasons.push('至少需要一条已复核采访笔记。');
  }
  const questionIds = questions.filter((question) => question.sourceId === session.sourceId).map((question) => question.id);
  const handledQuestionIds = new Set([
    ...(session.debrief?.unansweredQuestionIds || []),
    ...notes.filter((note) => note.sessionId === session.id && note.questionId).map((note) => note.questionId!),
  ]);
  if (questionIds.some((id) => !handledQuestionIds.has(id))) reasons.push('仍有问题既无回答记录也未标记为未回答。');
  if (!session.debrief?.completedAt) reasons.push('尚未完成采访后复盘。');
  return { ok: reasons.length === 0, reasons };
}

export function canUseAsDirectQuote(quote: QuoteCandidate) {
  const reasons: string[] = [];
  if (!quote.sourceNoteId && !quote.sourceTranscriptSegmentId) reasons.push('引语缺少可追溯的笔记或转写片段。');
  if (quote.reviewStatus !== 'confirmed') reasons.push('引语尚未人工确认。');
  if (quote.isOffRecord || quote.attributionMode === 'off_record') reasons.push('off-record 内容不可使用。');
  if (quote.isPrivate) reasons.push('私密内容不可使用。');
  if (quote.withdrawn) reasons.push('该引语已撤回。');
  if (!['named', 'anonymous', 'background'].includes(quote.attributionMode)) reasons.push('归因方式尚未确认。');
  return { ok: reasons.length === 0, reasons };
}

export function redactExecutionWorkspace(
  workspace: ExecutionWorkspaceState,
  mode: ExportMode,
): ExecutionWorkspaceState {
  const cloned = structuredClone(workspace);
  if (mode === 'full_private_backup') return cloned;
  const visibleSourceIds = new Set(cloned.sources.map((source) => source.id));
  cloned.sources = cloned.sources.map((source) => ({
    ...source,
    identity: source.attribution.identityPrivate ? '' : source.identity,
    contactMethods: [],
    privateNotes: '',
    consent: source.consent ? { ...source.consent, notes: undefined } : null,
  }));
  cloned.notes = cloned.notes.filter((note) =>
    visibleSourceIds.has(note.sourceId) && !note.isPrivate && !note.isOffRecord,
  );
  cloned.quotes = cloned.quotes.filter((quote) =>
    visibleSourceIds.has(quote.sourceId) && canUseAsDirectQuote(quote).ok,
  );
  cloned.transcripts = [];
  cloned.outreachAttempts = cloned.outreachAttempts.map((attempt) => ({
    ...attempt,
    message: '[联系内容已脱敏]',
    notes: undefined,
  }));
  return cloned;
}
