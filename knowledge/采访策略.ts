import type { KnowledgeMatch } from '../shared/generation.js';

export const 采访策略库: Omit<KnowledgeMatch, 'relevanceScore'>[] = [
  {
    id: 'interview-education',
    kind: 'interview-strategy',
    title: '教育类采访策略',
    summary:
      '至少覆盖学生、教师、学校管理者和教育专家。先以学生经历定位规则现场，再用教师和管理者核对执行逻辑，最后由独立专家解释边界与影响。',
    tags: ['学生', '教师', '学校', '高校', '课程', '教育'],
  },
  {
    id: 'interview-policy',
    kind: 'interview-strategy',
    title: '政策类采访策略',
    summary:
      '至少覆盖政策制定者、一线执行者、直接受影响群体和第三方专家。问题分别聚焦制度目标、执行方式、实际影响和独立评价。',
    tags: ['政策', '规定', '制度', '执行', '治理'],
  },
  {
    id: 'interview-consumer',
    kind: 'interview-strategy',
    title: '消费类采访策略',
    summary:
      '至少覆盖消费者、商家、平台和行业或权益专家。以原始交易证据为起点，分别核对承诺、履约、平台处置和行业规则。',
    tags: ['消费', '市场', '商家', '平台', '价格'],
  },
  {
    id: 'interview-technology',
    kind: 'interview-strategy',
    title: '技术类采访策略',
    summary:
      '至少覆盖实际使用者、产品或服务提供方、受影响群体和独立技术专家。区分产品能力、宣传说法、用户体验和可复现实验结果。',
    tags: ['AI', '人工智能', '生成式', '算法', '技术', '产品'],
  },
];
