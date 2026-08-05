import { retrieveKnowledge } from '../../knowledge/知识库.js';
import type {
  BriefInput,
  RetrievalContext,
  RetrievalEvidence,
  SearchResult,
} from '../../shared/generation.js';
import { buildSearchQueries } from '../../shared/检索查询.js';
import type { SearchProvider } from '../search/SearchProvider.js';

const isPublicWebUrl = (value: string) => {
  try {
    const url = new URL(value);
    return url.protocol === 'https:' || url.protocol === 'http:';
  } catch {
    return false;
  }
};

const toSearchEvidence = (
  result: SearchResult,
  query: string,
): RetrievalEvidence | null => {
  if (!isPublicWebUrl(result.url)) return null;

  return {
    id: `search:${result.id}`,
    origin: 'search',
    sourceType: result.sourceType,
    title: result.title.slice(0, 240),
    summary: result.snippet.slice(0, 1200),
    relevanceScore: 1,
    query,
    sourceName: result.sourceName.slice(0, 120),
    sourceUrl: result.url,
    ...(result.publishedAt ? { publishedAt: result.publishedAt } : {}),
  };
};

const deduplicate = (items: RetrievalEvidence[]) => {
  const seen = new Set<string>();
  return items.filter((item) => {
    const key = item.sourceUrl ?? item.id;
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });
};

export class RetrievalService {
  constructor(
    private readonly searchProvider: SearchProvider,
    private readonly now: () => Date = () => new Date(),
  ) {}

  get providerName() {
    return this.searchProvider.name;
  }

  async retrieve(input: BriefInput): Promise<RetrievalContext> {
    const queries = buildSearchQueries(input);
    const knowledgeEvidence: RetrievalEvidence[] = retrieveKnowledge(input).map(
      (item) => ({
        id: `knowledge:${item.id}`,
        origin: 'knowledge',
        sourceType: item.kind,
        title: item.title,
        summary: item.summary,
        relevanceScore: item.relevanceScore,
      }),
    );

    try {
      const searchQuery = queries.join(' OR ').slice(0, 400);
      const results = await this.searchProvider.search(searchQuery, 8);
      const searchEvidence = results
        .map((result) => toSearchEvidence(result, searchQuery))
        .filter((item): item is RetrievalEvidence => item !== null);

      return {
        queries,
        evidence: deduplicate([...searchEvidence, ...knowledgeEvidence]).slice(
          0,
          16,
        ),
        searchProvider: this.searchProvider.name,
        searchStatus: this.searchProvider.name === 'brave' ? 'live' : 'mock',
        retrievedAt: this.now().toISOString(),
      };
    } catch {
      return {
        queries,
        evidence: knowledgeEvidence,
        searchProvider: this.searchProvider.name,
        searchStatus: 'failed',
        retrievedAt: this.now().toISOString(),
        notice: '外部检索暂时不可用，已仅使用本地新闻方法知识库。',
      };
    }
  }
}
