import type {
  BriefInput,
  NewsRuleMatch,
  RuleDecision,
} from '../shared/generation.js';

interface NewsRuleDefinition {
  id: string;
  title: string;
  pattern: RegExp;
  requiredInterviewees: string[];
  requiredSources: string[];
  verificationPriorities: string[];
  riskFlags: string[];
}

const NEWS_RULES: NewsRuleDefinition[] = [
  {
    id: 'campus-education',
    title: '校园与教育议题规则',
    pattern: /学生|校园|高校|大学|院校|教师|课程|作业|教务/iu,
    requiredInterviewees: [
      '直接受影响的学生',
      '一线教师',
      '学校管理者或教务负责人',
      '教育研究者或独立专家',
    ],
    requiredSources: [
      '学校正式通知、课程规范或管理制度原文',
      '覆盖不同年级或专业的学生一手采访记录',
    ],
    verificationPriorities: [
      '核对校规、课程要求和实际执行是否一致',
      '避免用少数学生经历代表全部高校群体',
    ],
    riskFlags: ['学生身份与学业隐私', '师生权力关系对采访表达的影响'],
  },
  {
    id: 'policy-governance',
    title: '政策与制度议题规则',
    pattern: /政策|规定|制度|条例|通知|规范|办法|管理|治理/iu,
    requiredInterviewees: [
      '政策或制度发布部门',
      '一线执行者',
      '直接受影响群体',
      '熟悉该领域的第三方专家',
    ],
    requiredSources: [
      '政策或制度原文、发布日期与适用范围',
      '执行记录、公开回应或申诉渠道说明',
    ],
    verificationPriorities: [
      '确认制度是否仍然有效以及适用边界',
      '分别核对制度目标、执行方式和实际影响',
    ],
    riskFlags: ['把制度目标误写成已经实现的效果', '忽略执行差异与受影响群体'],
  },
  {
    id: 'technology-accountability',
    title: '技术与人工智能议题规则',
    pattern: /AI|人工智能|生成式|大模型|算法|智能工具|自动化/iu,
    requiredInterviewees: [
      '实际使用相关技术的人',
      '技术产品或服务提供方',
      '研究技术影响的独立专家',
    ],
    requiredSources: [
      '产品官方说明、功能边界与数据处理政策',
      '可复核的使用案例、测试记录或公开数据',
    ],
    verificationPriorities: [
      '区分产品宣传、用户体验和可证实效果',
      '不得把模型生成内容作为事实来源',
    ],
    riskFlags: ['算法偏差与错误输出', '个人信息或未公开资料被提交给模型'],
  },
  {
    id: 'consumer-market',
    title: '消费与市场议题规则',
    pattern: /消费|消费者|商家|市场|价格|收费|商品|服务|平台交易/iu,
    requiredInterviewees: [
      '具有不同经历的消费者',
      '商家或服务提供方',
      '相关平台负责人',
      '消费者权益或行业专家',
    ],
    requiredSources: [
      '价格、合同、平台规则或商品说明原文',
      '投诉记录、行业数据或监管部门公开信息',
    ],
    verificationPriorities: [
      '保存交易、价格和服务承诺的原始证据',
      '给予被质疑的商家或平台充分回应机会',
    ],
    riskFlags: ['未经核实的指控影响个人或企业声誉', '个案被误写为行业普遍现象'],
  },
];

const GENERAL_RULE: NewsRuleDefinition = {
  id: 'general-public-interest',
  title: '通用公共议题规则',
  pattern: /[\s\S]/u,
  requiredInterviewees: [
    '与议题直接相关的当事人',
    '承担相关职责的机构或执行者',
    '能够提供独立判断的专家',
  ],
  requiredSources: ['事件时间线与原始材料', '至少两个相互独立的信息来源'],
  verificationPriorities: ['区分事实、观点和记者推断', '为关键结论保留可追溯来源'],
  riskFlags: ['单一信源造成事实偏差', '缺少回应导致报道失衡'],
};

const unique = (items: string[]) => [...new Set(items)];

const toRuleMatch = (rule: NewsRuleDefinition, sourceText: string): NewsRuleMatch => {
  const signal = sourceText.match(rule.pattern)?.[0] ?? '主题信息';
  return {
    id: rule.id,
    title: rule.title,
    reason: `线索中出现“${signal}”，需要执行${rule.title}。`,
  };
};

export const applyNewsRules = (input: BriefInput): RuleDecision => {
  const sourceText = [
    input.topic,
    input.reportType,
    input.audience,
    input.scope,
    input.background,
  ].join(' ');
  const matchedRules = NEWS_RULES.filter((rule) => rule.pattern.test(sourceText));
  const activeRules = matchedRules.length > 0 ? matchedRules : [GENERAL_RULE];

  return {
    matches: activeRules.map((rule) => toRuleMatch(rule, sourceText)),
    requiredInterviewees: unique(
      activeRules.flatMap((rule) => rule.requiredInterviewees),
    ),
    requiredSources: unique(activeRules.flatMap((rule) => rule.requiredSources)),
    verificationPriorities: unique(
      activeRules.flatMap((rule) => rule.verificationPriorities),
    ),
    riskFlags: unique(activeRules.flatMap((rule) => rule.riskFlags)),
  };
};
