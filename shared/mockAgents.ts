import type {
  AgentReview,
  AgentTraceStep,
  EditorialRevision,
  GenerationContent,
  GenerationMode,
  PlanningContext,
  VerificationReview,
} from './generation.js';

const unique = (items: string[]) => [...new Set(items)];

const cap = (items: string[], maximum: number) => unique(items).slice(0, maximum);

export const createMockVerificationReview = (
  context: PlanningContext,
  draft: GenerationContent,
): VerificationReview => {
  const evidenceIds = context.retrievalContext.evidence
    .slice(0, 4)
    .map((item) => item.id);
  const hasLiveSearch = context.retrievalContext.searchStatus === 'live';
  const ruleRisks = context.ruleDecision.riskFlags.slice(0, 6);
  const riskDescriptions =
    ruleRisks.length >= 2
      ? ruleRisks
      : [...ruleRisks, '线索阶段的信息尚未完成多源交叉核验', '应保障被报道对象的回应权'];

  return {
    factCheck: {
      summary: hasLiveSearch
        ? '已将策划草案与检索摘要逐项对照；搜索结果只能作为线索，正式报道仍需打开原文并复核。'
        : '当前仅有本地方法知识，没有实时外部来源；所有事件性事实均保持待核验状态。',
      findings: [
        {
          id: 'fact-topic-existence',
          severity: 'high',
          category: 'source',
          claim: `用户线索“${context.input.topic}”及其发生范围`,
          status: hasLiveSearch ? 'partially-supported' : 'needs-verification',
          assessment: hasLiveSearch
            ? '检索摘要提供相关线索，但尚未核对原始页面、发布主体和适用范围。'
            : '没有实时公开来源支持，不能将用户输入直接写成已发生事实。',
          requiredAction: '打开原始来源，记录发布主体、日期、原文位置和访问时间。',
          evidenceIds,
        },
        {
          id: 'fact-data-boundary',
          severity: 'high',
          category: 'data',
          claim: `策划中的 ${draft.dataNeeds.length} 项资料需求所涉及的影响规模、比例、趋势和效果判断`,
          status: 'unsupported',
          assessment: '草案只提出数据需求，没有提供可复算的原始数据和统计口径。',
          requiredAction: '取得原始数据、样本说明与统计方法后再形成数字结论。',
          evidenceIds: [],
        },
        {
          id: 'fact-balance-response',
          severity: 'medium',
          category: 'balance',
          claim: '各责任主体的立场、规则解释与实际执行情况',
          status: 'needs-verification',
          assessment: '采访对象已经规划，但尚未完成当事人、执行者和责任方的正式采访。',
          requiredAction: '完成多方采访并给予被质疑主体充分、可记录的回应机会。',
          evidenceIds,
        },
      ],
      unsupportedClaims: [
        '用户输入的事件描述尚不能作为已核实事实',
        '任何影响比例、因果关系或普遍趋势都需要独立数据支持',
      ],
      ethicsNotes: [
        '对学生、未成年人或弱势受访者采用知情同意与最小必要披露。',
        '区分采访事实、受访者观点、模型建议和记者判断。',
      ],
    },
    riskReview: {
      overallRisk: hasLiveSearch ? 'medium' : 'high',
      releaseGate: 'hold',
      items: riskDescriptions.slice(0, 10).map((description, index) => ({
        id: `risk-${index + 1}`,
        severity: index === 0 ? 'high' : 'medium',
        category: index === 0 ? 'privacy' : index === 1 ? 'balance' : 'ethics',
        description,
        mitigation:
          index === 0
            ? '匿名化非必要身份信息，并在引用前再次确认授权边界。'
            : '增加独立信源与责任方回应，在成稿前完成逐项事实复核。',
      })),
    },
  };
};

export const createMockEditorialRevision = (
  context: PlanningContext,
  draft: GenerationContent,
  verification: VerificationReview,
): EditorialRevision => {
  const requiredActions = verification.factCheck.findings.map(
    (finding) => finding.requiredAction,
  );
  const mitigations = verification.riskReview.items.map(
    (item) => item.mitigation,
  );
  const finalChecklist = cap(
    [
      ...requiredActions,
      ...mitigations,
      ...context.ruleDecision.verificationPriorities,
      '核对全部引用、链接、日期、姓名、机构名称和数据口径',
    ],
    12,
  );

  return {
    content: {
      ...draft,
      topicSummary: `围绕“${context.input.topic}”形成经事实与风险审核的采访策划；当前结论均为待报道、待核验事项。`,
      verificationChecklist: cap(
        [...requiredActions, ...draft.verificationChecklist],
        12,
      ),
      risks: cap(
        [...verification.riskReview.items.map((item) => item.description), ...draft.risks],
        10,
      ),
      nextActions: cap(
        [
          '优先完成高风险事实主张的原始来源核验',
          ...draft.nextActions,
          '完成事实核查表后再进入写作与发布流程',
        ],
        8,
      ),
    },
    decision: {
      disposition: 'needs-reporting',
      priorityAngleId: 'system',
      rationale:
        '制度切口最适合先核对规则原文、执行责任和受影响群体，再决定是否扩展人物或趋势叙事。',
      changes: [
        '把未经核验的事实断言改为采访与资料任务。',
        '将高风险来源、数据和回应权要求前置到执行清单。',
        '保留人物、制度、趋势三个互补角度，但明确制度角度优先。',
      ],
      finalChecklist,
    },
  };
};

export const createAgentReview = (
  mode: GenerationMode,
  verification: VerificationReview,
  editorial: EditorialRevision['decision'],
  statuses: AgentTraceStep['status'][] = [
    'completed',
    'completed',
    'completed',
  ],
): AgentReview => ({
  workflowVersion: 'news-agent-v1',
  verification,
  editorial,
  trace: [
    {
      agent: 'planning',
      status: statuses[0] ?? 'completed',
      mode,
      summary: '新闻策划 Agent 已生成结构化报道草案。',
    },
    {
      agent: 'fact-check',
      status: statuses[1] ?? 'completed',
      mode,
      summary: '事实核查 Agent 已检查来源、数据、伦理与平衡风险。',
    },
    {
      agent: 'editor',
      status: statuses[2] ?? 'completed',
      mode,
      summary: '新闻编辑 Agent 已根据核查结果完成终审与执行排序。',
    },
  ],
});
