import {
  createMockEditorialTaskResult,
  type EditorialTaskRequest,
  type EditorialTaskResult,
} from '../../shared/编辑任务模型.js';
import type { GenerationProvider } from '../providers/GenerationProvider.js';
import type { EditorialTaskProvider } from '../providers/EditorialTaskProvider.js';
import type { SearchProviderResult } from '../search/p1/SearchProvider.js';

interface ServiceLogger {
  warn(message: string): void;
}

type Provider = GenerationProvider & Partial<EditorialTaskProvider>;
interface InterviewSearchService {
  search(query: {
    id: string;
    claimIds: string[];
    query: string;
    purpose: string;
    targetSourceTypes: ['official_statement', 'news_report'];
    priority: 'high';
    userEditable: false;
  }, options: { limit: number }): Promise<SearchProviderResult>;
}

const extractInterviewTopic = (sourceText: string) => {
  const cleaned = sourceText
    .trim()
    .replace(/[“”"']/gu, '')
    .replace(/^(?:我(?:现在)?想(?:去)?|请帮我)?采访/u, '')
    .replace(/^关于/u, '')
    .replace(/[，,。！？?].*$/u, '')
    .replace(/(?:的)?采访(?:提纲|问题)?$/u, '')
    .trim();
  return cleaned || sourceText.trim().replace(/[“”"']/gu, '');
};

const buildInterviewSearchTerms = (sourceText: string) => {
  const topic = extractInterviewTopic(sourceText);
  return [topic, `${topic} 新闻 背景`, `${topic} 走红 起因 人物经历`];
};

const isRelevantSource = (topic: string, title: string, snippet: string) => {
  const normalizedTopic = topic.replace(/[^\p{L}\p{N}]/gu, '').toLowerCase();
  const haystack = `${title}${snippet}`.replace(/[^\p{L}\p{N}]/gu, '').toLowerCase();
  if (!normalizedTopic || haystack.includes(normalizedTopic)) return true;
  const entity = normalizedTopic.match(/^(.{2,12}?)(?=赢|输|夺|获|发布|宣布|回应|参加|发生|调整|新增|上映)/u)?.[1];
  if (entity && haystack.includes(entity)) return true;
  if (normalizedTopic.length < 3) return false;
  const pairs = [...normalizedTopic].slice(0, -1).map((character, index) => character + [...normalizedTopic][index + 1]);
  const matched = pairs.filter((pair) => haystack.includes(pair)).length;
  return matched >= Math.min(2, pairs.length);
};

export class EditorialService {
  constructor(
    private readonly primaryProvider: Provider,
    private readonly fallbackProvider?: Provider,
    private readonly logger: ServiceLogger = console,
    private readonly searchService?: InterviewSearchService,
  ) {}

  private async research(input: EditorialTaskRequest) {
    if (input.taskType !== 'interview' || !this.searchService) return undefined;
    try {
      const results = await Promise.all(buildInterviewSearchTerms(input.sourceText).map((query, index) =>
        this.searchService!.search({
          id: `editor-interview-${index + 1}`,
          claimIds: [],
          query,
          purpose: '了解事件背景并发现可采访的问题',
          targetSourceTypes: ['official_statement', 'news_report'],
          priority: 'high',
          userEditable: false,
        }, { limit: 6 }),
      ));
      const maxPerQuery = Math.max(1, Math.floor(8 / results.length));
      const topic = extractInterviewTopic(input.sourceText);
      const interleaved = Array.from(
        { length: Math.max(...results.map((result) => Math.min(result.results.length, maxPerQuery))) },
        (_, index) => results.flatMap((result) => result.results[index] ? [result.results[index]] : []),
      ).flat();
      const seen = new Set<string>();
      const sources = interleaved
        .filter((item) => isRelevantSource(topic, item.title, item.snippet))
        .filter((item) => {
          const key = item.url || item.title;
          if (seen.has(key)) return false;
          seen.add(key);
          return true;
        })
        .slice(0, 8)
        .map(({ title, url, snippet, sourceName, publishedAt }) => ({
          title, ...(url ? { url } : {}), snippet, sourceName,
          ...(publishedAt ? { publishedAt } : {}),
        }));
      return {
        status: results.some((result) => result.status === 'live') ? 'live' as const : results[0].status,
        notice: results[0].notice,
        sources,
      };
    } catch (error) {
      const message = error instanceof Error ? error.message : '未知错误';
      this.logger.warn('[NewsPilot] 采访资料搜索失败：' + message);
      return { status: 'failed' as const, notice: '实时搜索暂时不可用，已根据主题生成基础采访提纲。', sources: [] };
    }
  }

  async run(input: EditorialTaskRequest): Promise<EditorialTaskResult> {
    const research = await this.research(input);
    const enrichedInput = research ? { ...input, research } : input;
    if (!this.primaryProvider.runEditorialTask) {
      return { ...createMockEditorialTaskResult(enrichedInput), ...(research ? { research } : {}) };
    }

    try {
      const result = await this.primaryProvider.runEditorialTask(enrichedInput);
      return { ...result, ...(research ? { research } : {}) };
    } catch (error) {
      const message = error instanceof Error ? error.message : '未知错误';
      this.logger.warn('[NewsPilot] 编辑模型失败：' + message);
      if (this.fallbackProvider?.runEditorialTask) {
        try {
          const result = await this.fallbackProvider.runEditorialTask(enrichedInput);
          return { ...result, ...(research ? { research } : {}) };
        } catch {
          // Continue to the deterministic local fallback.
        }
      }
      throw error;
    }
  }
}
