import type {
  BriefInput,
  GenerationContent,
  GenerationResult,
  PlanningContext,
  StoryAngle,
} from './generation.js';
import { buildPlanningContext } from './新闻方法论.js';
import { finalizePlanningResult } from './新闻工作流.js';
import {
  createAgentReview,
  createMockEditorialRevision,
  createMockVerificationReview,
} from './mockAgents.js';

export const DEFAULT_MOCK_DELAY = 800;

const wait = (milliseconds: number) =>
  new Promise<void>((resolve) => {
    globalThis.setTimeout(resolve, milliseconds);
  });

const clean = (value: string) => value.trim().replace(/\s+/g, ' ');

const shorten = (value: string, maxLength: number) =>
  value.length > maxLength ? value.slice(0, maxLength) + '…' : value;

const toReportingSubject = (topic: string) => {
  const subject = topic
    .replace(/(?:现象)?调查$/u, '')
    .replace(/效果研究$/u, '')
    .replace(/研究$/u, '')
    .trim();

  return subject || topic;
};

const detectTopicContext = (topic: string) => {
  if (/AI|人工智能|生成式|大模型/i.test(topic)) {
    return {
      participants: [
        '实际使用相关工具的学生',
        '承担相关课程教学的教师',
        '学校教务或学术规范负责人',
        '教育技术与学术诚信研究者',
      ],
      institution: '课程评价、作业规范与学术诚信机制',
      metric: '使用频率、使用环节、学习投入与评价变化',
    };
  }

  if (/搭子|社交|朋友|孤独/.test(topic)) {
    return {
      participants: [
        '有“搭子社交”经历的学生',
        '学生社团或校园活动组织者',
        '学校心理与学生工作教师',
        '青年文化或社会心理研究者',
      ],
      institution: '校园支持网络、社团机制与学生服务',
      metric: '参与比例、关系持续时间、互动场景与主观感受',
    };
  }

  if (/短视频|直播|社交媒体|平台/.test(topic)) {
    return {
      participants: [
        '具有不同使用习惯的学生',
        '校园内容创作者',
        '高校媒介素养课程教师',
        '平台研究或传播学研究者',
      ],
      institution: '校园媒介素养教育与平台使用规范',
      metric: '日均时长、内容偏好、使用场景与行为变化',
    };
  }

  if (/体育|赛事|运动|比赛/.test(topic)) {
    return {
      participants: [
        '参赛学生与现场观众',
        '赛事组织者和校园媒体编辑',
        '学校体育部门负责人',
        '体育传播或公共关系研究者',
      ],
      institution: '赛事组织、校园传播与资源配置机制',
      metric: '触达人数、互动数据、参与率与传播路径',
    };
  }

  return {
    participants: [
      '与议题直接相关的学生或当事人',
      '校园一线工作人员',
      '学校相关管理部门负责人',
      '该领域研究者或行业专家',
    ],
    institution: '校内相关规则、执行流程与反馈机制',
    metric: '群体规模、行为频率、时间变化与影响差异',
  };
};

const buildQuestions = (
  topic: string,
  reportType: string,
  audience: string,
  focus: 'people' | 'system' | 'trend',
  metric: string,
) => {
  const typeLabel = reportType || '报道';
  const audienceLabel = audience || '目标读者';

  if (focus === 'people') {
    return [
      '你第一次直接接触“' + topic + '”是在什么情境下？',
      '这件事给你的学习、工作或日常生活带来了哪些具体改变？',
      '过程中最关键的一次选择或冲突是什么？当时为什么这样决定？',
      '身边人如何看待你的经历？他们的反应是否影响了你？',
      '如果回到事情发生之前，你最希望获得哪一种帮助或信息？',
      '对于' + audienceLabel + '，你希望这篇' + typeLabel + '保留哪一个最真实的细节？',
    ];
  }

  if (focus === 'system') {
    return [
      '目前针对“' + topic + '”有哪些正式规则、处理流程或责任部门？',
      '现有制度制定时依据了哪些数据、案例或利益相关方意见？',
      '规则在实际执行中最常见的落差和争议分别是什么？',
      '不同院系、群体或场景是否采用一致标准？如果不同，原因是什么？',
      '当事人可以通过什么渠道反馈、申诉或获得支持？',
      '未来是否有调整计划？评估' + audienceLabel + '实际体验的指标是什么？',
    ];
  }

  return [
    '关于“' + topic + '”，目前能获得的样本规模和统计口径是什么？',
    metric + '在最近一年出现了什么变化？',
    '不同年级、专业或使用场景之间是否存在显著差异？',
    '哪些外部因素可能影响数据，如何排除把相关性误作因果关系？',
    '调查中的沉默群体或未覆盖样本有哪些？',
    '哪些趋势最值得' + audienceLabel + '关注，又需要怎样的后续数据验证？',
  ];
};

const createAngles = (input: BriefInput): StoryAngle[] => {
  const topic = clean(input.topic);
  const topicLabel = shorten(toReportingSubject(topic), 32);
  const reportType = clean(input.reportType) || '深度报道';
  const audience = clean(input.audience) || '高校学生';
  const scope = clean(input.scope) || '校园';
  const background = clean(input.background);
  const context = detectTopicContext(topic);
  const backgroundCue = background
    ? '同时追踪补充背景“' + shorten(background, 56) + '”在现实中的具体体现。'
    : '从可验证的近期案例切入，补足事件发生的时间线与现场细节。';

  return [
    {
      id: 'people',
      title: topicLabel + '：一个具体学生的选择与代价',
      perspective:
        '以' +
        scope +
        '范围内的真实个体经历为叙事轴，寻找“' +
        topicLabel +
        '”如何进入日常生活的关键时刻、现实冲突与个人应对。' +
        backgroundCue,
      newsValueScore: 4.8,
      whyWorthReporting:
        '“' +
        topicLabel +
        '”与' +
        audience +
        '的日常选择直接相关。用具体人物的经历切入，可以把抽象变化转化为可理解、可核验的新闻现场。',
      newsValue: [
        '公共价值：让' + audience + '看见抽象议题背后的真实处境与支持需求。',
        '现实意义：通过个人经历呈现“' + topicLabel + '”带来的机会、压力与选择成本。',
        '可报道性：适合以场景、细节和多方回应构成一篇有温度的' + reportType + '。',
      ],
      interviewees: context.participants,
      interviewQuestions: buildQuestions(
        topicLabel,
        reportType,
        audience,
        'people',
        context.metric,
      ),
      verificationChecklist: [
        '核对核心人物身份、时间线及关键经历，取得必要的采访授权。',
        '用至少一位独立信源交叉验证与“' + topicLabel + '”有关的关键事实。',
        '区分当事人的个人感受、可证实事实与记者分析。',
        '检查引用的聊天记录、图片或作品是否真实且获得使用许可。',
      ],
      risks: [
        '避免用单一个案代表全部' + audience + '，在文中明确样本边界。',
        '对涉及学业、心理、家庭或人际关系的细节进行隐私保护。',
        '避免为了戏剧性放大冲突，给受访者留出事实复核机会。',
      ],
      nextActions: [
        '在' + scope + '范围内联系 3 名具有不同经历的' + audience + '完成初访',
        '筛选 1 个与“' + topicLabel + '”相关且可核实的人物案例',
        '整理人物经历时间线，并向教师或管理方确认关键事实',
      ],
    },
    {
      id: 'system',
      title: '谁在定义边界？“' + topicLabel + '”背后的规则现场',
      perspective:
        '把视线从个体转向' +
        context.institution +
        '，比较制度文本、执行现场和使用者体验，追问规则由谁制定、如何落实、是否回应了' +
        audience +
        '的真实需求。',
      newsValueScore: 4.6,
      whyWorthReporting:
        '围绕“' +
        topicLabel +
        '”的讨论不只关乎个体选择，也涉及规则如何影响' +
        audience +
        '。制度文本与执行现场之间的差距具有明确公共价值。',
      newsValue: [
        '公共价值：厘清与“' + topicLabel + '”相关的权利、责任和可求助渠道。',
        '现实意义：呈现' + scope + '范围内制度设计与一线执行之间的差距。',
        '可报道性：可通过文件查证、部门回应和多方访谈形成结构完整的' + reportType + '。',
      ],
      interviewees: [
        context.participants[0],
        context.participants[1],
        context.participants[2],
        '熟悉相关政策或治理机制的独立专家',
      ],
      interviewQuestions: buildQuestions(
        topicLabel,
        reportType,
        audience,
        'system',
        context.metric,
      ),
      verificationChecklist: [
        '查找并保存与“' + topicLabel + '”相关的现行校规、通知或行业文件原文。',
        '确认规则的发布主体、生效时间、适用范围和最新修订状态。',
        '对管理方表述与实际执行案例进行交叉核验。',
        '明确' + scope + '样本能否外推，避免把局部规定写成普遍政策。',
      ],
      risks: [
        '避免只采用单一部门口径，保证受影响群体拥有充分表达空间。',
        '涉及争议处理时遵循回应权原则，并保留完整沟通记录。',
        '政策或校规可能更新，发布前再次核对版本与适用范围。',
      ],
      nextActions: [
        '寻找并核对与“' + topicLabel + '”相关的现行政策或管理文件',
        '预约学校相关管理部门，确认规则制定与执行流程',
        '收集' + scope + '范围内的执行案例，比对文本与现实差异',
      ],
    },
    {
      id: 'trend',
      title: '从个案到趋势：' + scope + '中的“' + topicLabel + '”',
      perspective:
        '以' +
        context.metric +
        '为观察维度，设计小型调查并结合公开资料，判断“' +
        topicLabel +
        '”是局部印象、短期波动，还是值得持续追踪的群体现象。',
      newsValueScore: 4.7,
      whyWorthReporting:
        '关于“' +
        topicLabel +
        '”的判断容易停留在个体感受。通过调查与公开数据，可以验证现象规模，为' +
        audience +
        '提供更可靠的趋势判断。',
      newsValue: [
        '公共价值：为' + audience + '提供超越个体经验的趋势判断与行动参考。',
        '现实意义：用可复核数据识别“' + topicLabel + '”的规模、差异与变化方向。',
        '可报道性：适合用问卷、数据图表和典型样本支撑' + reportType + '的核心判断。',
      ],
      interviewees: [
        '来自不同年级或背景的' + audience + '样本',
        '掌握相关校内数据的业务部门',
        context.participants[1],
        '具备调查方法或数据分析经验的研究者',
      ],
      interviewQuestions: buildQuestions(
        topicLabel,
        reportType,
        audience,
        'trend',
        context.metric,
      ),
      verificationChecklist: [
        '说明“' + topicLabel + '”相关数据的来源、时间范围、统计口径和缺失值。',
        '检查问卷样本结构、题目措辞与招募渠道是否造成偏差。',
        '用原始数据复算关键比例，并为重要结论寻找第二来源。',
        '区分趋势、相关关系与因果解释，标注数据无法回答的问题。',
      ],
      risks: [
        '小样本调查不得包装成全体' + audience + '的普遍结论。',
        '图表比例应从合理基线开始，避免视觉夸大微小变化。',
        '收集问卷时遵循最小必要原则，不记录无关个人敏感信息。',
      ],
      nextActions: [
        '围绕“' + topicLabel + '”设计一份 8-10 题的小型调查',
        '在' + scope + '范围内收集并清洗有效样本数据',
        '核对样本结构与统计口径，并寻找公开数据交叉验证',
      ],
    },
  ];
};

const unique = (items: string[]) => [...new Set(items)];

const completeList = (
  items: string[],
  fallbacks: string[],
  minimum: number,
  maximum: number,
) => {
  const completed = unique([...items, ...fallbacks]).slice(0, maximum);

  if (completed.length < minimum) {
    throw new Error('Mock 生成内容未达到最小清单数量。');
  }

  return completed;
};

export function createMockGenerationContent(
  context: PlanningContext,
): GenerationContent {
  const { input, ruleDecision } = context;
  const topic = clean(input.topic);
  const reportType = clean(input.reportType) || '深度报道';
  const audience = clean(input.audience) || '高校学生';
  const scope = clean(input.scope) || '校园';

  return {
    topicSummary:
      '围绕“' +
      topic +
      '”，面向' +
      audience +
      '，在' +
      scope +
      '范围内策划一组兼顾人物经验、制度机制与数据趋势的' +
      reportType +
      '方案。',
    angles: createAngles(input),
    dataNeeds: completeList(
      ruleDecision.requiredSources,
      [
        '事件发生与规则变化的完整时间线',
        '目标群体规模、样本结构与统计口径',
        '相关责任主体的正式回应与可联系渠道',
        '能够交叉验证关键判断的第二独立来源',
      ],
      4,
      10,
    ),
    verificationChecklist: completeList(
      ruleDecision.verificationPriorities,
      [
        '为每项事实判断记录原始来源、发布日期与访问时间',
        '区分用户线索、受访者观点、公开事实和记者推断',
        '向被质疑或承担责任的一方提供充分回应机会',
        '确认采访授权、匿名边界和个人信息使用范围',
      ],
      4,
      12,
    ),
    risks: completeList(
      ruleDecision.riskFlags,
      [
        '线索阶段的信息可能不完整，禁止将推测写成确定事实',
        '样本范围有限时不得外推为普遍结论',
        '涉及个人经历时应遵循最小必要披露原则',
      ],
      3,
      10,
    ),
    nextActions: [
      `从“${topic}”相关群体中完成至少 3 次探索性初访`,
      '收集规则引擎列出的原始文件、公开数据和时间线材料',
      '建立事实主张清单，逐项标记已支持、待核验或存在冲突',
      '根据初访与资料结果确认主角度，并向关键责任方发出采访请求',
    ],
  };
}

export function createMockGenerationResult(input: BriefInput): GenerationResult {
  const context = buildPlanningContext(input);
  const draft = createMockGenerationContent(context);
  const verification = createMockVerificationReview(context, draft);
  const editorial = createMockEditorialRevision(context, draft, verification);
  return finalizePlanningResult(
    context,
    editorial.content,
    'mock',
    createAgentReview('mock', verification, editorial.decision),
  );
}

export async function generateMockContent(
  context: PlanningContext,
  delayMs = 0,
): Promise<GenerationContent> {
  if (delayMs > 0) {
    await wait(delayMs);
  }

  return createMockGenerationContent(context);
}

export async function generateMockBrief(
  input: BriefInput,
  delayMs = DEFAULT_MOCK_DELAY,
): Promise<GenerationResult> {
  if (delayMs > 0) {
    await wait(delayMs);
  }

  return createMockGenerationResult(input);
}
