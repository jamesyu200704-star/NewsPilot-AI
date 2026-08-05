import { applyNewsRules } from '../rules/新闻规则.js';
import type {
  BriefInput,
  NewsTopicCategory,
  NewsValueAssessment,
  NewsValueDimension,
  PlanningContext,
  RuleDecision,
  TopicAnalysis,
} from './generation.js';
import { createLocalRetrievalContext } from './本地检索.js';

const clean = (value: string) => value.trim().replace(/\s+/gu, ' ');

const normalizeInput = (input: BriefInput): BriefInput => ({
  topic: clean(input.topic),
  reportType: clean(input.reportType),
  audience: clean(input.audience),
  scope: clean(input.scope),
  background: clean(input.background),
});

const hasRule = (decision: RuleDecision, id: string) =>
  decision.matches.some((match) => match.id === id);

const resolveCategory = (decision: RuleDecision): NewsTopicCategory => {
  if (hasRule(decision, 'campus-education')) return 'education';
  if (hasRule(decision, 'policy-governance')) return 'policy';
  if (hasRule(decision, 'consumer-market')) return 'consumer';
  if (hasRule(decision, 'technology-accountability')) return 'technology';
  return 'general';
};

const resolveCoreConflict = (
  input: BriefInput,
  category: NewsTopicCategory,
  decision: RuleDecision,
) => {
  if (
    category === 'education' &&
    hasRule(decision, 'technology-accountability')
  ) {
    return '技术提升学习效率的现实需求，与课程规范、独立完成要求和评价公平之间的张力。';
  }

  const conflicts: Record<NewsTopicCategory, string> = {
    education: '学生的学习与发展需求，与学校规则、教学资源和评价方式之间的张力。',
    policy: '制度目标与一线执行方式、受影响群体实际体验之间的落差。',
    consumer: '商业效率与消费者知情权、选择权和公平交易之间的张力。',
    technology: '技术便利与可靠性、责任边界、隐私保护之间的张力。',
    general: `“${input.topic}”的公共意义，与现有信息不足、不同主体立场之间的张力。`,
  };
  return conflicts[category];
};

const analyzeTopic = (
  input: BriefInput,
  ruleDecision: RuleDecision,
): TopicAnalysis => {
  const category = resolveCategory(ruleDecision);
  const scope = input.scope || '用户指定范围';
  const audience = input.audience || '目标读者';

  return {
    category,
    summary: `围绕“${input.topic}”，在${scope}范围内分析其对${audience}的现实影响、责任主体与可验证证据。`,
    coreConflict: resolveCoreConflict(input, category, ruleDecision),
    stakeholders: ruleDecision.requiredInterviewees,
    evidenceGaps: ruleDecision.requiredSources,
  };
};

const clampScore = (score: number) => Math.max(0, Math.min(5, score));

const dimension = (
  id: NewsValueDimension['id'],
  label: string,
  score: number,
  weight: number,
  rationale: string,
): NewsValueDimension => ({
  id,
  label,
  score: clampScore(score),
  weight,
  rationale,
});

const assessNewsValue = (
  input: BriefInput,
  ruleDecision: RuleDecision,
): NewsValueAssessment => {
  const sourceText = `${input.topic} ${input.background}`;
  const recent = /近期|最近|今日|昨天|本周|本月|今年|新规|发布|上线|正在|当前|202[4-9]/u.test(
    sourceText,
  );
  const broadImpact = /政策|教育|就业|安全|健康|公共|校园|高校|消费者/u.test(
    sourceText,
  );
  const closeToAudience = /学生|校园|高校|大学|本地|社区/u.test(
    `${sourceText} ${input.audience} ${input.scope}`,
  );
  const conflictSignal = /争议|冲突|矛盾|投诉|禁止|限制|公平|伦理|风险|不同|边界|规定/u.test(
    sourceText,
  );
  const peopleSignal = /学生|教师|家长|居民|消费者|员工|患者|当事人/u.test(
    sourceText,
  );
  const interestSignal = /AI|人工智能|生成式|大模型|短视频|直播|新型|潮流|热门/iu.test(
    sourceText,
  );

  const dimensions: NewsValueDimension[] = [
    dimension(
      'timeliness',
      '时效性',
      recent ? 4.5 : input.background ? 3.2 : 2.5,
      0.2,
      recent
        ? '线索包含近期事件、发布或正在发生的变化。'
        : '尚未提供明确发生时间，需要补充时间线和最新进展。',
    ),
    dimension(
      'significance',
      '重要性',
      broadImpact || ruleDecision.matches.length >= 2 ? 4.4 : 3.1,
      0.25,
      broadImpact
        ? '议题涉及教育、政策或公共利益，可能影响明确群体。'
        : '当前影响范围仍需通过样本和公开资料进一步确认。',
    ),
    dimension(
      'proximity',
      '接近性',
      closeToAudience ? 4.6 : input.scope ? 3.6 : 2.8,
      0.2,
      closeToAudience
        ? '议题与校园、高校学生或本地使用场景直接相关。'
        : '已指定报道范围，但与目标读者的直接关系仍需验证。',
    ),
    dimension(
      'conflict',
      '冲突性',
      conflictSignal ? 4.3 : ruleDecision.matches.length >= 2 ? 3.7 : 2.8,
      0.15,
      conflictSignal
        ? '线索出现规则边界、不同立场或公平性问题。'
        : '存在潜在利益差异，但核心矛盾需要通过采访确认。',
    ),
    dimension(
      'humanInterest',
      '人物性',
      peopleSignal ? 4.4 : 3.1,
      0.1,
      peopleSignal
        ? '线索涉及可接触的真实人物及其具体选择和影响。'
        : '人物入口尚不清晰，需要寻找直接受影响者。',
    ),
    dimension(
      'interest',
      '趣味性',
      interestSignal ? 4.1 : 3,
      0.1,
      interestSignal
        ? '议题包含新技术或快速变化的媒介现象，具有认知反差。'
        : '议题的独特性需要通过案例、数据或现场细节增强。',
    ),
  ];

  const overallScore = Number(
    (
      dimensions.reduce(
        (total, item) => total + item.score * item.weight,
        0,
      ) * 2
    ).toFixed(1),
  );
  const confidence =
    input.background.length >= 30 && ruleDecision.matches.length >= 2
      ? 'high'
      : input.background || ruleDecision.matches.length >= 2
        ? 'medium'
        : 'low';

  return {
    dimensions,
    overallScore,
    confidence,
    summary:
      confidence === 'high'
        ? '线索信息和规则信号较完整，评分可用于确定初步采访优先级。'
        : '评分基于当前线索，完成检索和初访后应重新评估。',
  };
};

export const buildPlanningContext = (rawInput: BriefInput): PlanningContext => {
  const input = normalizeInput(rawInput);
  const ruleDecision = applyNewsRules(input);
  return {
    input,
    topicAnalysis: analyzeTopic(input, ruleDecision),
    newsValueAssessment: assessNewsValue(input, ruleDecision),
    ruleDecision,
    retrievalContext: createLocalRetrievalContext(input),
  };
};
