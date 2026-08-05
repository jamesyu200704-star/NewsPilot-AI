import type { KnowledgeMatch } from '../shared/generation.js';

export const 新闻价值理论库: Omit<KnowledgeMatch, 'relevanceScore'>[] = [
  {
    id: 'news-value-timeliness',
    kind: 'news-value',
    title: '时效性判断',
    summary:
      '确认事件发生、政策发布和数据更新的时间；缺少明确时间线时，不把旧现象包装成最新变化。',
    tags: ['近期', '发布', '变化', '政策', '数据'],
  },
  {
    id: 'news-value-significance',
    kind: 'news-value',
    title: '重要性判断',
    summary:
      '评估影响人数、影响深度、公共资源和权利责任，不以网络热度替代公共重要性。',
    tags: ['公共', '影响', '教育', '政策', '安全'],
  },
  {
    id: 'news-value-proximity',
    kind: 'news-value',
    title: '接近性判断',
    summary:
      '判断议题与目标读者在地理、身份、利益和情感上的距离，并说明报道范围。',
    tags: ['学生', '校园', '高校', '本地', '社区'],
  },
  {
    id: 'news-value-conflict',
    kind: 'news-value',
    title: '冲突性判断',
    summary:
      '寻找真实存在的利益、规则或责任张力；冲突必须由可核验事实和多方采访支持。',
    tags: ['规则', '争议', '公平', '责任', '边界'],
  },
  {
    id: 'news-value-human-interest',
    kind: 'news-value',
    title: '人物性判断',
    summary:
      '寻找能够接触、愿意表达且与事件直接相关的人物，以具体经历呈现抽象议题。',
    tags: ['学生', '教师', '消费者', '当事人', '人物'],
  },
  {
    id: 'news-value-interest',
    kind: 'news-value',
    title: '趣味性判断',
    summary:
      '通过认知反差、新现象和现场细节增强可读性，但不牺牲准确性或夸大猎奇。',
    tags: ['AI', '人工智能', '新技术', '趋势', '反差'],
  },
];
