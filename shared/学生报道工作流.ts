import { 报道策略库 } from '../strategy-library/报道策略.js';
import { buildClaimEvidenceMatrix } from '../rules/交叉验证规则.js';
import type {
  BriefInput,
  GenerationResult,
  NewsValueAssessment,
  RetrievalEvidence,
} from './generation.js';
import { buildPlanningContext } from './新闻方法论.js';
import type {
  AngleScore,
  CandidateAngle,
  EvidenceRecord,
  InterviewPlan,
  InterviewQuestion,
  InterviewStage,
  ReportingBrief,
  SourceMapItem,
  StrategyCard,
  StudentReportingPlan,
  TopicFrame,
  Verdict,
} from './学生报道模型.js';

const clean = (value = '') => value.trim().replace(/\s+/gu, ' ');
const unique = (items: string[]) => [...new Set(items.map(clean).filter(Boolean))];
const clamp = (value: number, minimum = 0, maximum = 10) =>
  Math.max(minimum, Math.min(maximum, value));

export const reportingBriefToLegacyInput = (brief: ReportingBrief): BriefInput => ({
  topic: clean(brief.rawTopic),
  reportType: brief.assignmentType,
  audience: clean(brief.targetAudience || '校园读者'),
  scope: clean(brief.geographicScope || brief.campusFocus || '校园'),
  background: clean(
    [
      brief.teacherRequirements,
      brief.currentHook,
      ...brief.existingMaterials,
      ...brief.ethicalConstraints,
    ].filter(Boolean).join('；'),
  ),
});

const buildAssignmentSummary = (brief: ReportingBrief) => {
  const deadline = brief.deadline || brief.publishAt || '尚未填写';
  if (brief.mode === 'course') {
    const extras = [
      brief.formatRequirements ? `提交格式：${brief.formatRequirements}` : '',
      brief.requiresInterviewOutline ? '需提交采访提纲' : '',
      brief.requiresInterviewSummary ? '需提交采访总结' : '',
    ].filter(Boolean);
    return `${brief.courseName || '课程作业'} · ${brief.assignmentType}；截止 ${deadline}；目标 ${brief.targetLength || '未限定'} 字；至少采访 ${brief.minimumInterviewees || 1} 人${extras.length ? `；${extras.join('；')}` : ''}。`;
  }
  return `${brief.platform || '校园媒体'} · ${brief.assignmentType}；面向${brief.targetAudience || '校园读者'}，计划于 ${deadline} 发布。`;
};

const resolveNewsQuestion = (brief: ReportingBrief) => {
  const topic = clean(brief.rawTopic);
  if (/AI|人工智能|生成式/iu.test(topic) && /作业|课程|教师|高校|学生/u.test(topic)) {
    return '生成式 AI 正在如何改变高校教师对课程作业的评价方式，学生又如何适应这些边界？';
  }
  if (/政策|规定|制度|门禁|新规|通知/u.test(topic)) {
    return `“${topic}”在校园实际执行中如何影响学生，规则目标与一线体验是否一致？`;
  }
  if (/服务|食堂|选课|摆渡车|出行/u.test(topic)) {
    return `“${topic}”能否解决学生的具体需求，哪些环节仍然构成障碍？`;
  }
  return `在${brief.geographicScope || '校园'}范围内，“${topic}”究竟发生了什么变化，谁受到影响，现有证据能说明到什么程度？`;
};

const buildTopicFrame = (brief: ReportingBrief): TopicFrame => {
  const materials = brief.existingMaterials;
  return {
    rawTopic: clean(brief.rawTopic),
    newsQuestion: resolveNewsQuestion(brief),
    workingHypothesis:
      '工作假设（不是事实）：现有规则、资源或评价方式可能正在变化，但变化的范围与效果需要通过采访和文件核实。',
    knownFacts: materials.length
      ? materials.map((item) => `用户已提供材料线索：${item}（仍需核对原件）`)
      : ['目前只确认用户提供了该报道线索，尚未完成独立核实。'],
    assumptions: [
      '该现象不只是单一个案。',
      '不同角色对问题存在可比较的经历或判断。',
    ],
    unknowns: [
      '现象首次出现或规则发生变化的准确时间',
      '受影响人群的实际范围与差异',
      '负责部门或相关主体的正式回应',
    ],
    verificationNeeds: [
      '取得规则、通知、课程要求或其他原始材料',
      '采访至少两类相互独立的直接相关者',
      '为核心判断保留时间、地点、行为和具体例子',
    ],
  };
};

const daysUntil = (date?: string) => {
  if (!date) return undefined;
  const value = Date.parse(date);
  if (Number.isNaN(value)) return undefined;
  return Math.ceil((value - Date.now()) / 86_400_000);
};

const buildVerdict = (brief: ReportingBrief, newsScore: number): Verdict => {
  const interviewTarget = brief.minimumInterviewees || 1;
  const reachable = brief.availableInterviewees.length;
  const days = daysUntil(brief.deadline || brief.publishAt);
  const noAccess = reachable === 0;
  const shortDeadline = days !== undefined && days < 2;
  const accessGap = reachable < interviewTarget;
  const status = noAccess
    ? 'HOLD'
    : shortDeadline && accessGap
      ? 'DROP'
      : accessGap || newsScore < 6
        ? 'REVISE'
        : 'GO';
  return {
    status,
    reasons: [
      `当前可联系 ${reachable} 类采访对象，任务要求至少 ${interviewTarget} 人。`,
      `六维新闻价值综合分为 ${newsScore.toFixed(1)} / 10。`,
      days === undefined ? '截止期尚未明确，需先确定采访窗口。' : `距离截止期约 ${Math.max(0, days)} 天。`,
    ],
    greatestStrength: reachable > 0
      ? '已有可接触的校园信源，能在短期内开始初访。'
      : '议题与校园生活直接相关，接近性较强。',
    greatestRisk: accessGap
      ? '可达采访对象不足，无法满足任务要求或完成交叉验证。'
      : '把学生感受或工作假设提前写成普遍事实。',
    narrowingAdvice: `把范围限定为“${brief.geographicScope || '本校'}、${brief.assignmentType}、一个明确变化或冲突”，不外推到所有高校。`,
    minimumViableVersion:
      '先采访 1 名直接经历者、1 名不同观点者，核对 1 份原始文件，再决定是否扩大样本。',
  };
};

const strategySignalScore = (card: StrategyCard, brief: ReportingBrief) => {
  const source = `${brief.rawTopic} ${brief.assignmentType} ${brief.teacherRequirements || ''} ${brief.currentHook || ''}`;
  const matches = card.signals.filter((signal) => source.includes(signal)).length;
  const typeBonus =
    (brief.assignmentType === '人物特稿' && card.id === 'profile') ||
    (brief.assignmentType === '校园调查' && card.id === 'campus-phenomenon') ||
    (brief.mode === 'campus_media' && card.id === 'localize-hotspot')
      ? 3
      : 0;
  return matches * 2 + typeBonus;
};

const scoreAngle = (
  card: StrategyCard,
  brief: ReportingBrief,
  assessment: NewsValueAssessment,
): AngleScore => {
  const access = brief.availableInterviewees.length;
  const materials = brief.existingMaterials.length;
  const days = daysUntil(brief.deadline || brief.publishAt);
  const riskPenalty = brief.ethicalConstraints.length > 1 ? 1 : 0;
  return {
    newsValue: clamp(assessment.overallScore),
    audienceRelevance: /校园|学生|高校|大学/u.test(`${brief.rawTopic} ${brief.targetAudience}`) ? 9 : 7,
    sourceAccessibility: clamp(4 + access * 1.5),
    evidenceAvailability: clamp(4 + materials * 1.4),
    deadlineFeasibility: days === undefined ? 6 : days >= 7 ? 9 : days >= 3 ? 7 : 4,
    scenePotential: card.id === 'scene-led' || brief.requiresHumanStory ? 9 : 7,
    ethicalSafety: clamp(8 - riskPenalty),
  };
};

const average = (score: AngleScore) =>
  Number((Object.values(score).reduce((sum, value) => sum + value, 0) / 7).toFixed(1));

const buildCandidateAngles = (
  brief: ReportingBrief,
  assessment: NewsValueAssessment,
): CandidateAngle[] => {
  const ranked = [...报道策略库]
    .map((card) => ({ card, match: strategySignalScore(card, brief) }))
    .sort((a, b) => b.match - a.match || a.card.name.localeCompare(b.card.name, 'zh-CN'))
    .slice(0, 3);

  return ranked
    .map(({ card, match }, index) => {
      const score = scoreAngle(card, brief, assessment);
      const question = resolveNewsQuestion(brief);
      const strategyFitBonus = Math.min(0.9, match * 0.12);
      return {
        id: `angle-${index + 1}`,
        strategyId: card.id,
        strategyName: card.name,
        title: `${card.name}：${clean(brief.rawTopic)}`,
        question,
        rationale: `该策略能把宽泛主题收缩为${card.recommendedStructure.slice(0, 2).join('、')}，并与学生现有资源匹配。`,
        coreConflict: buildPlanningContext(reportingBriefToLegacyInput(brief)).topicAnalysis.coreConflict,
        score,
        totalScore: Number(clamp(average(score) + strategyFitBonus).toFixed(1)),
        evidenceNeeded: card.requiredEvidence,
        sourceRoles: card.minimumSources,
        feasibilityNote: card.studentFeasibilityNotes[0],
        risks: card.commonRisks,
      };
    })
    .sort((a, b) => b.totalScore - a.totalScore);
};

const sourceItem = (
  id: string,
  role: string,
  informationValue: string,
  accessibility: SourceMapItem['accessibility'],
  bias: string,
  alternatives: string[],
  targets: string[],
): SourceMapItem => ({
  id,
  role,
  informationValue,
  relationshipToTopic: '用于回答新闻问题并与其他信源交叉核对。',
  accessibility,
  possibleBias: bias,
  alternativeSources: alternatives,
  verificationTargets: targets,
});

const buildSourceMap = (brief: ReportingBrief): SourceMapItem[] => {
  const available = brief.availableInterviewees.join(' ');
  const accessibilityFor = (pattern: RegExp): SourceMapItem['accessibility'] =>
    pattern.test(available) ? 'high' : 'medium';
  return [
    sourceItem('source-experiencer', '直接经历者', '提供具体时间、地点、行为、变化和后果。', accessibilityFor(/学生|当事人|经历者/u), '可能放大个人体验。', ['同类经历的另一名学生', '匿名问卷仅作线索补充'], ['事件时间线', '具体案例']),
    sourceItem('source-affected', '不同或受影响观点', '检验现象是否存在差异与反例。', accessibilityFor(/同学|学生|消费者/u), '可能受群体立场影响。', ['未参与者', '持反对意见的学生'], ['差异与反例']),
    sourceItem('source-executor', '决策者或规则执行者', '解释规则文本、适用范围与执行方式。', accessibilityFor(/教师|老师|管理|教务/u), '可能维护机构立场。', ['公开通知或会议纪要', '院系辅导员或课程负责人'], ['正式规则', '执行边界']),
    sourceItem('source-expert', '第三方解释者', '解释机制和研究限制。', 'low', '可能使用专业框架淡化个体差异。', ['相关专业教师', '公开学术研究作者', '行业协会材料'], ['机制解释', '概念边界']),
    sourceItem('source-documents', '文件与数据来源', '为关键说法提供可追溯原始证据。', brief.existingMaterials.length ? 'high' : 'medium', '文件可能过期或只表达制度目标。', ['学校官网存档', '课程平台通知', '信息公开申请'], ['发布时间', '适用范围', '原始口径']),
  ];
};

const questionTemplates: Array<[InterviewStage, string, string, string]> = [
  ['破冰问题', '你最早在什么情况下接触到这件事？', '建立时间线并确认受访者与议题的真实关系。', '最早时间和具体场景'],
  ['事实问题', '请按时间顺序描述当时发生了什么。', '获得可核对的事件经过。', '时间、地点、人物与行为'],
  ['经历问题', '哪一个具体时刻最能说明它对你的影响？', '获得可用于报道的场景与细节。', '具体例子和可观察细节'],
  ['原因问题', '当时有哪些条件影响了你的选择？', '理解原因但避免代替他人解释动机。', '受访者自己的判断依据'],
  ['冲突问题', '你遇到过哪些与规则、资源或他人期待不一致的情况？', '找到冲突和边界。', '冲突双方与具体事件'],
  ['验证问题', '哪些文件、记录或其他人可以帮助核实这段经历？', '把说法连接到证据。', '文件名称、联系人和证据线索'],
  ['追问建议', '你刚才提到“发生了变化”，变化前后分别是什么样？', '把抽象判断追问成可比较事实。', '变化前后对照'],
  ['收尾问题', '还有哪一件容易被忽略、但你认为必须核实的事？', '发现遗漏和反例。', '新增线索与保留意见'],
];

const adaptQuestionForSource = (
  baseQuestion: string,
  index: number,
  source: SourceMapItem,
  topic: string,
) => {
  if (index === 0) {
    return `作为${source.role}，你最早在什么情况下接触到“${topic}”相关情况？`;
  }
  if (index === 1) {
    return `围绕“${topic}”，请按时间顺序描述你作为${source.role}亲自经历、观察或负责的事实。`;
  }
  if (index === 5) {
    return `针对你以${source.role}身份提供的说法，哪些文件、记录或其他人可以帮助核实？`;
  }
  return `${baseQuestion}请从${source.role}的具体经历或职责出发回答。`;
};

const toQuestion = (
  template: (typeof questionTemplates)[number],
  index: number,
  source: SourceMapItem,
  topic: string,
): InterviewQuestion => {
  const [stage, question, purpose, evidence] = template;
  return {
    stage,
    question: adaptQuestionForSource(question, index, source, topic),
    purpose,
    expectedEvidence: evidence,
    followUps: ['能否说出准确时间或地点？', '是否有文件、记录或其他人可以佐证？'],
    risks: ['不要把受访者的判断写成已核实事实。'],
    isLeading: false,
    isDoubleBarreled: false,
  };
};

const buildInterviewPlans = (
  sourceMap: SourceMapItem[],
  brief: ReportingBrief,
): InterviewPlan[] =>
  sourceMap
    .filter((source) => source.id !== 'source-documents')
    .map((source) => ({
      sourceId: source.id,
      sourceRole: source.role,
      questions: questionTemplates.map((template, index) =>
        toQuestion(template, index, source, clean(brief.rawTopic)),
      ),
    }));

const buildEvidenceLedger = (brief: ReportingBrief): EvidenceRecord[] =>
  brief.existingMaterials.map((material, index) => ({
    id: `user-material-${index + 1}`,
    title: material,
    publisher: '用户提供，待核对原件',
    retrievedAt: new Date().toISOString(),
    sourceType: 'user_material',
    credibilityTier: 'C',
    summary: '这是用户已有材料线索；系统尚未读取原件，不能据此确认事实。',
    supports: [],
    contradicts: [],
  }));

const retrievalSourceType = (
  evidence: RetrievalEvidence,
): EvidenceRecord['sourceType'] => {
  if (evidence.sourceType === 'policy' || evidence.sourceType === 'data') {
    return 'primary_document';
  }
  if (evidence.sourceType === 'news') {
    return 'news_report';
  }
  if (evidence.sourceType === 'news-value') {
    return 'academic_source';
  }
  return 'user_material';
};

const retrievalToEvidenceLedger = (
  generation: GenerationResult,
): EvidenceRecord[] =>
  generation.retrievalContext.evidence.map((evidence) => ({
    id: evidence.id,
    title: evidence.title,
    publisher: evidence.sourceName || '知识库或检索结果，待打开原文核对',
    ...(evidence.publishedAt ? { publishedAt: evidence.publishedAt } : {}),
    ...(evidence.sourceUrl ? { url: evidence.sourceUrl } : {}),
    retrievedAt: generation.retrievalContext.retrievedAt,
    sourceType: retrievalSourceType(evidence),
    credibilityTier: evidence.origin === 'search' ? 'C' : 'lead_only',
    summary: `${evidence.summary}（仅作线索；系统未核对原文，不支持自动确认事实。）`,
    supports: [],
    contradicts: [],
  }));

const buildActionPlan = (brief: ReportingBrief) => [
  { order: 1, when: '现在—2 小时', action: '把新闻问题发给一名直接经历者做 15 分钟初访。', output: '一条可验证时间线和两个待核实说法' },
  { order: 2, when: '今天', action: '取得规则、通知或课程要求原件，并记录发布日期和适用范围。', output: '至少一条原始证据记录' },
  { order: 3, when: '24 小时内', action: `联系至少 ${Math.max(2, brief.minimumInterviewees || 2)} 名不同角色的受访者。`, output: '确认采访时间与替代信源' },
  { order: 4, when: '48 小时内', action: '更新证据矩阵：区分已核实、部分核实、未核实和冲突。', output: '可继续执行或需要收缩的编辑判断' },
];

export const createStudentReportingPlan = (
  brief: ReportingBrief,
  mode: StudentReportingPlan['mode'] = 'mock',
  fallbackNotice?: string,
): StudentReportingPlan => {
  const legacyInput = reportingBriefToLegacyInput(brief);
  const planningContext = buildPlanningContext(legacyInput);
  const topicFrame = buildTopicFrame(brief);
  const candidateAngles = buildCandidateAngles(brief, planningContext.newsValueAssessment);
  const sourceMap = buildSourceMap(brief);
  const evidenceLedger = buildEvidenceLedger(brief);
  return {
    brief: { ...brief, rawTopic: clean(brief.rawTopic) },
    assignmentSummary: buildAssignmentSummary(brief),
    topicFrame,
    verdict: buildVerdict(brief, planningContext.newsValueAssessment.overallScore),
    newsValueAssessment: planningContext.newsValueAssessment,
    feasibilityScore: Number((candidateAngles[0]?.totalScore || 0).toFixed(1)),
    candidateAngles,
    recommendedAngleId: candidateAngles[0]?.id || '',
    sourceMap,
    interviewPlans: buildInterviewPlans(sourceMap, brief),
    evidenceLedger,
    claimEvidenceMatrix: buildClaimEvidenceMatrix(
      [...topicFrame.knownFacts, ...topicFrame.assumptions],
      evidenceLedger,
    ),
    factCheckChecklist: [
      '关键事实必须由一个原始来源或两个独立可靠来源支持。',
      '观点明确归因；社交媒体内容仅作为线索。',
      '没有真实采访时不生成引语，也不声称采访已经完成。',
      '每条事实性表述都链接到 evidenceId；无法链接则标记 unverified。',
    ],
    ethicalRisks: unique([
      ...brief.ethicalConstraints,
      '避免暴露学生身份、学业记录和未经同意的私人信息。',
      '避免污名化群体，并给被质疑一方充分回应机会。',
    ]),
    missingInformation: unique([
      ...topicFrame.unknowns,
      ...(brief.availableInterviewees.length < (brief.minimumInterviewees || 1)
        ? ['尚未满足最低采访人数要求。']
        : []),
    ]),
    actionPlan: buildActionPlan(brief),
    submissionChecklist: [
      '新闻问题明确且不是价值判断。',
      `采访人数达到 ${brief.minimumInterviewees || 1} 人，并说明信源类型。`,
      '工作假设没有被写成事实。',
      '所有引语来自真实采访记录。',
      '已完成隐私、回应权和利益冲突检查。',
      ...(brief.requiresPlanningDocument ? ['已导出课程采访策划案。'] : []),
      ...(brief.requiresInterviewOutline ? ['采访提纲已按信源角色整理并完成核对。'] : []),
      ...(brief.requiresInterviewSummary ? ['采访总结中区分事实、观点和未核实线索。'] : []),
      ...(brief.formatRequirements ? [`提交文件符合格式要求：${brief.formatRequirements}。`] : []),
      ...(brief.otherHardConstraints || []).map((constraint) => `已核对硬性要求：${constraint}`),
    ],
    generatedAt: new Date().toISOString(),
    mode,
    ...(fallbackNotice ? { fallbackNotice } : {}),
  };
};

/**
 * 将现有 Provider 输出约束到学生报道工作流中。
 * Provider 可以补充评分与资料线索，但不会直接改变工作假设或把摘要认定为事实。
 */
export const createStudentReportingPlanWithGeneration = (
  brief: ReportingBrief,
  generation: GenerationResult,
): StudentReportingPlan => {
  const plan = createStudentReportingPlan(
    brief,
    generation.mode,
    generation.fallbackNotice,
  );
  const evidenceLedger = [
    ...plan.evidenceLedger,
    ...retrievalToEvidenceLedger(generation),
  ];
  return {
    ...plan,
    newsValueAssessment: generation.newsValueAssessment,
    evidenceLedger,
    claimEvidenceMatrix: buildClaimEvidenceMatrix(
      [...plan.topicFrame.knownFacts, ...plan.topicFrame.assumptions],
      evidenceLedger,
    ),
  };
};
