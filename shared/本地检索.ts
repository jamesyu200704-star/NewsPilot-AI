import { retrieveKnowledge } from '../knowledge/知识库.js';
import type {
  BriefInput,
  RetrievalContext,
  RetrievalEvidence,
} from './generation.js';
import { buildSearchQueries } from './检索查询.js';

export const createLocalRetrievalContext = (
  input: BriefInput,
  now: () => Date = () => new Date(),
): RetrievalContext => {
  const evidence: RetrievalEvidence[] = retrieveKnowledge(input).map((item) => ({
    id: `knowledge:${item.id}`,
    origin: 'knowledge',
    sourceType: item.kind,
    title: item.title,
    summary: item.summary,
    relevanceScore: item.relevanceScore,
  }));

  return {
    queries: buildSearchQueries(input),
    evidence,
    searchProvider: 'mock',
    searchStatus: 'mock',
    retrievedAt: now().toISOString(),
    notice: 'Demo 模式仅使用内置新闻方法知识库，不代表已经完成实时网络检索。',
  };
};
