import type { ReportingBrief } from './学生报道模型.js';
import type {
  Claim,
  SearchPlan,
  SearchQuery,
  SourceRecord,
  SourceType,
} from './证据领域模型.js';
import { canonicalizeSourceUrl } from './来源去重.js';

const clean = (value: string) => value.trim().replace(/\s+/gu, ' ');
const id = (prefix: string, index: number) => `${prefix}-${String(index + 1).padStart(3, '0')}`;

const allegationLike = (text: string) =>
  /很多|都在|全部|所有|普遍|大量|作弊|听说|据说|网传|传闻/u.test(text);

export function createClaimsFromBrief(
  brief: ReportingBrief,
  now: () => string = () => new Date().toISOString(),
): Claim[] {
  const timestamp = now();
  const topic = clean(brief.rawTopic);
  const geographicScope = clean(brief.geographicScope || brief.campusFocus || '校园');
  const mainType = allegationLike(topic) ? 'allegation' : 'hypothesis';
  const normalizedQuestion = allegationLike(topic)
    ? `${geographicScope}是否存在${topic.replace(/[。！？?]+$/gu, '').replace(/^(?:我们|本)学校/u, '')}的现象？`
    : `在${geographicScope}范围内，“${topic.replace(/[。！？?]+$/gu, '')}”是否成立，影响范围是什么？`;
  const seed: Array<Pick<Claim, 'text' | 'type' | 'importance' | 'source' | 'missingEvidence'>> = [
    {
      text: normalizedQuestion,
      type: mainType,
      importance: 'critical',
      source: 'user_input',
      missingEvidence: ['适用规则或原始文件', '直接经历者访谈', '教师或执行者访谈', '可验证个案或数据'],
    },
    {
      text: `${brief.assignmentType}任务的适用范围、截止时间和提交要求是什么？`,
      type: 'fact',
      importance: 'major',
      source: 'assignment',
      missingEvidence: ['课程作业要求或编辑任务单原件'],
    },
    {
      text: `该现象对${brief.targetAudience || '校园读者'}造成了哪些可观察影响？`,
      type: 'hypothesis',
      importance: 'major',
      source: 'generated_plan',
      missingEvidence: ['不同角色访谈', '能说明影响的原始数据或记录'],
    },
  ];
  return seed.map((item, index) => ({
    id: id('C', index),
    ...item,
    geographicScope,
    isUserConfirmed: false,
    evidenceIds: [],
    verificationStatus: 'unverified',
    createdAt: timestamp,
    updatedAt: timestamp,
  }));
}

const sourcePriority: SourceType[] = [
  'primary_document',
  'official_data',
  'official_statement',
];

export function createSearchPlan(
  projectId: string,
  brief: ReportingBrief,
  claims: Claim[],
  now: () => string = () => new Date().toISOString(),
): SearchPlan {
  const topic = clean(brief.rawTopic).replace(/[。！？?]+$/gu, '');
  const scope = clean(brief.geographicScope || brief.campusFocus || '本校');
  const critical = claims[0]?.id ? [claims[0].id] : [];
  const assignment = claims[1]?.id ? [claims[1].id] : critical;
  const queries: SearchQuery[] = [
    {
      id: 'SQ-001', claimIds: critical, query: `${scope} ${topic} 规定 通知`,
      purpose: '优先寻找适用的原始政策、学校通知或正式制度文本。',
      targetSourceTypes: sourcePriority, preferredDomains: ['edu.cn'], priority: 'high', userEditable: true,
    },
    {
      id: 'SQ-002', claimIds: assignment, query: `${scope} 教务处 ${topic} 文件`,
      purpose: '寻找负责机构发布的正式文件、解释或执行口径。',
      targetSourceTypes: ['primary_document', 'official_statement'], priority: 'high', userEditable: true,
    },
    {
      id: 'SQ-003', claimIds: critical, query: `site:edu.cn ${topic} 课程作业 规范`,
      purpose: '在高校域名中检索可追溯原文，减少泛化网页和无来源汇总。',
      targetSourceTypes: ['primary_document', 'official_statement'], preferredDomains: ['edu.cn'], priority: 'high', userEditable: true,
    },
    {
      id: 'SQ-004', claimIds: critical, query: `${topic} 统计 调查 报告`,
      purpose: '寻找能说明规模、时间和样本范围的官方数据或研究资料。',
      targetSourceTypes: ['official_data', 'academic_source'], priority: 'medium', userEditable: true,
    },
    {
      id: 'SQ-005', claimIds: critical, query: `${topic} 近期 报道 校园`,
      purpose: '补充可靠媒体的独立采访与近期案例，但不能替代原始来源。',
      targetSourceTypes: ['news_report'], priority: 'low', userEditable: true,
    },
  ];
  return {
    id: `SP-${projectId || 'local'}`,
    projectId,
    topic,
    queries,
    createdAt: now(),
    generatedBy: 'rules',
  };
}

export function createSourceRecord(input: {
  id: string;
  title: string;
  url?: string;
  publisher?: string;
  author?: string;
  publishedAt?: string;
  shortSummary: string;
  extractedText?: string;
  retrievedAt?: string;
}): SourceRecord & { extractedText?: string } {
  const canonicalUrl = input.url ? canonicalizeSourceUrl(input.url) : undefined;
  return {
    id: input.id,
    title: clean(input.title).slice(0, 300),
    ...(input.url ? { url: input.url } : {}),
    ...(canonicalUrl ? { canonicalUrl, domain: new URL(canonicalUrl).hostname } : {}),
    ...(input.publisher ? { publisher: clean(input.publisher) } : {}),
    ...(input.author ? { author: clean(input.author) } : {}),
    ...(input.publishedAt ? { publishedAt: input.publishedAt } : {}),
    retrievedAt: input.retrievedAt || new Date().toISOString(),
    sourceType: 'unknown',
    credibilityTier: 'unrated',
    isLikelyRepost: false,
    originStatus: 'origin_unresolved',
    shortSummary: clean(input.shortSummary).slice(0, 1200),
    supportsClaimIds: [],
    contradictsClaimIds: [],
    userAccepted: false,
    userRejected: false,
    extractionStatus: input.extractedText ? 'success' : 'metadata_only',
    warnings: [],
    classificationHistory: [],
    ...(input.extractedText ? { extractedText: input.extractedText } : {}),
  };
}
