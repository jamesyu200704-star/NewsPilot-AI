import type {
  SearchResult,
  SearchSourceType,
} from '../../shared/generation.js';
import type { SearchProvider } from './SearchProvider.js';

const BRAVE_WEB_SEARCH_ENDPOINT =
  'https://api.search.brave.com/res/v1/web/search';

type FetchImplementation = (
  input: string | URL | Request,
  init?: RequestInit,
) => Promise<Response>;

interface BraveSearchProviderOptions {
  apiKey?: string;
  timeoutMs?: number;
  fetchImplementation?: FetchImplementation;
}

type JsonRecord = Record<string, unknown>;

const isRecord = (value: unknown): value is JsonRecord =>
  typeof value === 'object' && value !== null && !Array.isArray(value);

const asText = (value: unknown) =>
  typeof value === 'string' && value.trim() ? value.trim() : undefined;

const classifySource = (text: string): SearchSourceType => {
  if (/政策|规定|规范|条例|办法|通知|gov\.|政府|教育部/iu.test(text)) {
    return 'policy';
  }
  if (/数据|统计|报告|调查|白皮书|dataset/iu.test(text)) return 'data';
  if (/新闻|报道|日报|电视台|news/iu.test(text)) return 'news';
  return 'case';
};

const sourceNameFrom = (item: JsonRecord, resultUrl: string) => {
  const profile = isRecord(item.profile) ? item.profile : undefined;
  const profileName = asText(profile?.long_name);
  if (profileName) return profileName;

  try {
    return new URL(resultUrl).hostname;
  } catch {
    return '公开网页';
  }
};

export class BraveSearchProvider implements SearchProvider {
  readonly name = 'brave' as const;
  private readonly apiKey: string;
  private readonly timeoutMs: number;
  private readonly fetchImplementation: FetchImplementation;

  constructor(options: BraveSearchProviderOptions) {
    this.apiKey = options.apiKey?.trim() ?? '';
    this.timeoutMs = options.timeoutMs ?? 10_000;
    this.fetchImplementation = options.fetchImplementation ?? globalThis.fetch;
  }

  async search(query: string, limit = 8): Promise<SearchResult[]> {
    if (!this.apiKey) {
      throw new Error('服务端未配置 BRAVE_SEARCH_API_KEY。');
    }

    const normalizedQuery = query.trim().replace(/\s+/gu, ' ').slice(0, 400);
    if (!normalizedQuery) return [];

    const url = new URL(BRAVE_WEB_SEARCH_ENDPOINT);
    url.searchParams.set('q', normalizedQuery);
    url.searchParams.set('count', String(Math.max(1, Math.min(limit, 20))));
    url.searchParams.set('country', 'CN');
    url.searchParams.set('safesearch', 'moderate');
    const controller = new AbortController();
    const timeout = globalThis.setTimeout(() => controller.abort(), this.timeoutMs);

    try {
      const response = await this.fetchImplementation(url, {
        method: 'GET',
        headers: {
          Accept: 'application/json',
          'X-Subscription-Token': this.apiKey,
        },
        signal: controller.signal,
      });

      if (!response.ok) {
        throw new Error(`Brave Search 请求失败（HTTP ${response.status}）。`);
      }

      const payload: unknown = await response.json();
      if (!isRecord(payload) || !isRecord(payload.web)) return [];
      const rawResults = Array.isArray(payload.web.results)
        ? payload.web.results
        : [];

      return rawResults.flatMap((rawItem, index): SearchResult[] => {
        if (!isRecord(rawItem)) return [];
        const title = asText(rawItem.title);
        const resultUrl = asText(rawItem.url);
        const snippet = asText(rawItem.description);
        if (!title || !resultUrl || !snippet) return [];
        const publishedAt = asText(rawItem.age);
        const sourceName = sourceNameFrom(rawItem, resultUrl);

        return [
          {
            id: `brave-${index}-${resultUrl}`.slice(0, 500),
            title,
            url: resultUrl,
            snippet,
            sourceName,
            sourceType: classifySource(
              `${normalizedQuery} ${title} ${sourceName} ${resultUrl}`,
            ),
            ...(publishedAt ? { publishedAt } : {}),
          },
        ];
      });
    } finally {
      globalThis.clearTimeout(timeout);
    }
  }
}
