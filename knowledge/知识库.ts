import type {
  BriefInput,
  KnowledgeMatch,
} from '../shared/generation.js';
import { 优秀报道案例库 } from './优秀报道案例.js';
import { 采访策略库 } from './采访策略.js';
import { 新闻价值理论库 } from './新闻价值理论.js';

const KNOWLEDGE_BASE = [
  ...新闻价值理论库,
  ...优秀报道案例库,
  ...采访策略库,
];

const normalize = (value: string) => value.trim().toLocaleLowerCase('zh-CN');

const scoreEntry = (sourceText: string, tags: string[]) => {
  const matches = tags.filter((tag) => sourceText.includes(normalize(tag))).length;
  return Number(Math.min(1, 0.25 + matches * 0.18).toFixed(2));
};

export const getKnowledgeBaseStats = () => ({
  newsValueDimensions: 新闻价值理论库.length,
  casePatterns: 优秀报道案例库.length,
  interviewStrategies: 采访策略库.length,
});

export const retrieveKnowledge = (
  input: BriefInput,
  limit = 8,
): KnowledgeMatch[] => {
  const sourceText = normalize(
    [
      input.topic,
      input.reportType,
      input.audience,
      input.scope,
      input.background,
    ].join(' '),
  );

  return KNOWLEDGE_BASE.map((entry) => ({
    ...entry,
    relevanceScore: scoreEntry(sourceText, entry.tags),
  }))
    .sort((left, right) => {
      if (right.relevanceScore !== left.relevanceScore) {
        return right.relevanceScore - left.relevanceScore;
      }
      return left.id.localeCompare(right.id);
    })
    .filter((entry, index) => entry.relevanceScore > 0.25 || index < 3)
    .slice(0, Math.max(1, Math.min(limit, 12)));
};
