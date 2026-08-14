import type { SearchQuery, SourceType } from '../../../shared/证据领域模型.js';
import { canonicalizeSourceUrl } from '../../../shared/来源去重.js';
import type {
  FetchImplementation,
  SearchOptions,
  SearchProvider,
  SearchProviderResult,
} from './SearchProvider.js';

interface SearXNGProviderOptions {
  baseUrl: string;
  timeoutMs?: number;
  retryCount?: number;
  cacheTtlMs?: number;
  defaultLimit?: number;
  allowLocalBaseUrl?: boolean;
  fetchImplementation?: FetchImplementation;
  now?: () => Date;
}

const asRecord = (value: unknown): Record<string, unknown> | undefined =>
  value !== null && typeof value === 'object' && !Array.isArray(value)
    ? value as Record<string, unknown>
    : undefined;
const asText = (value: unknown) => typeof value === 'string' ? value.trim() : '';
const localHost = (hostname: string) =>
  hostname === 'localhost' || hostname === '127.0.0.1' || hostname === '::1' || hostname.endsWith('.local');

const suggestSourceType = (text: string, target: SourceType[]): SourceType => {
  if (/政策|规定|通知|办法|条例|教务处|\.edu|\.gov/iu.test(text)) return 'primary_document';
  if (/数据|统计|dataset|白皮书/iu.test(text)) return 'official_data';
  if (/论文|doi|期刊|研究/iu.test(text)) return 'academic_source';
  if (/微博|论坛|帖子|社交/iu.test(text)) return 'social_post';
  return target[0] || 'unknown';
};

export class SearXNGProvider implements SearchProvider {
  readonly id = 'searxng' as const;
  readonly name = 'SearXNG';
  private readonly baseUrl: URL;
  private readonly timeoutMs: number;
  private readonly retryCount: number;
  private readonly cacheTtlMs: number;
  private readonly defaultLimit: number;
  private readonly fetchImplementation: FetchImplementation;
  private readonly now: () => Date;
  private readonly cache = new Map<string, { expiresAt: number; result: SearchProviderResult }>();
  private readonly maxCacheEntries = 200;

  constructor(options: SearXNGProviderOptions) {
    this.baseUrl = new URL(options.baseUrl);
    if (!['http:', 'https:'].includes(this.baseUrl.protocol)) {
      throw new Error('SEARXNG_BASE_URL 只允许 HTTP 或 HTTPS。');
    }
    if (localHost(this.baseUrl.hostname) && !options.allowLocalBaseUrl) {
      throw new Error('本地 SearXNG 必须由服务端显式允许。');
    }
    this.timeoutMs = options.timeoutMs || 10_000;
    this.retryCount = Math.min(2, Math.max(0, options.retryCount ?? 1));
    this.cacheTtlMs = options.cacheTtlMs || 60_000;
    this.defaultLimit = Math.min(20, Math.max(1, options.defaultLimit || 10));
    this.fetchImplementation = options.fetchImplementation || globalThis.fetch;
    this.now = options.now || (() => new Date());
  }

  isAvailable() {
    return Promise.resolve(true);
  }

  private async request(url: URL) {
    let lastError: unknown;
    for (let attempt = 0; attempt <= this.retryCount; attempt += 1) {
      const controller = new AbortController();
      const timeout = globalThis.setTimeout(() => controller.abort(), this.timeoutMs);
      try {
        const response = await this.fetchImplementation(url, {
          method: 'GET',
          headers: { Accept: 'application/json' },
          redirect: 'error',
          signal: controller.signal,
        });
        if (!response.ok) throw new Error(`SearXNG 请求失败（HTTP ${response.status}）。`);
        if (!response.headers.get('content-type')?.toLowerCase().includes('application/json')) {
          throw new Error('SearXNG 返回的内容类型不是 JSON。');
        }
        return await response.json() as unknown;
      } catch (error) {
        lastError = error;
      } finally {
        globalThis.clearTimeout(timeout);
      }
    }
    throw lastError instanceof Error ? lastError : new Error('SearXNG 请求失败。');
  }

  async search(query: SearchQuery, options: SearchOptions = {}): Promise<SearchProviderResult> {
    const domainFilter = (query.preferredDomains || [])
      .filter((domain) => /^[a-z0-9.-]{2,253}$/iu.test(domain))
      .filter((domain) => !query.query.includes(`site:${domain}`))
      .map((domain) => `site:${domain}`)
      .join(' OR ');
    const timeFilter = [
      query.timeRange?.from ? `after:${query.timeRange.from}` : '',
      query.timeRange?.to ? `before:${query.timeRange.to}` : '',
    ].filter(Boolean).join(' ');
    const normalizedQuery = [query.query, domainFilter ? `(${domainFilter})` : '', timeFilter]
      .filter(Boolean).join(' ').trim().replace(/\s+/gu, ' ').slice(0, 400);
    if (!normalizedQuery) throw new Error('搜索词不能为空。');
    const limit = Math.min(20, Math.max(1, options.limit || this.defaultLimit));
    const cacheKey = `${normalizedQuery}|${limit}`;
    const cached = this.cache.get(cacheKey);
    if (!options.forceRefresh && cached && cached.expiresAt > this.now().getTime()) {
      const rebound = structuredClone(cached.result);
      return {
        ...rebound,
        queryId: query.id,
        results: rebound.results.map((item) => ({ ...item, queryId: query.id, claimIds: [...query.claimIds], purpose: query.purpose })),
        cached: true,
      };
    }
    const url = new URL('/search', this.baseUrl);
    url.searchParams.set('q', normalizedQuery);
    url.searchParams.set('format', 'json');
    url.searchParams.set('language', 'zh-CN');
    url.searchParams.set('safesearch', '1');
    const payload = asRecord(await this.request(url));
    const rawResults = Array.isArray(payload?.results) ? payload.results : [];
    const retrievedAt = this.now().toISOString();
    const results = rawResults.flatMap((raw, index) => {
      const item = asRecord(raw);
      if (!item) return [];
      const title = asText(item.title);
      const rawUrl = asText(item.url);
      const snippet = asText(item.content);
      if (!title || !rawUrl || !snippet) return [];
      let canonicalUrl: string;
      try {
        canonicalUrl = canonicalizeSourceUrl(rawUrl);
      } catch {
        return [];
      }
      const sourceName = (() => {
        try { return new URL(canonicalUrl).hostname; } catch { return '公开网页'; }
      })();
      return [{
        id: `SX-${query.id}-${String(index + 1).padStart(3, '0')}`,
        title: title.slice(0, 300),
        url: canonicalUrl,
        snippet: snippet.slice(0, 1000),
        sourceName,
        ...(asText(item.publishedDate) ? { publishedAt: asText(item.publishedDate) } : {}),
        suggestedSourceType: suggestSourceType(`${title} ${canonicalUrl} ${snippet}`, query.targetSourceTypes),
        claimIds: [...query.claimIds],
        purpose: query.purpose,
        queryId: query.id,
        retrievedAt,
        isMock: false,
      }];
    }).slice(0, limit);
    const result: SearchProviderResult = {
      providerId: this.id,
      status: 'live',
      queryId: query.id,
      results,
      retrievedAt,
      notice: 'SearXNG 仅返回搜索线索；采纳前必须获取原始页面并提取可定位证据片段。',
      cached: false,
    };
    if (this.cache.size >= this.maxCacheEntries) {
      const oldestKey = this.cache.keys().next().value;
      if (typeof oldestKey === 'string') this.cache.delete(oldestKey);
    }
    this.cache.set(cacheKey, { expiresAt: this.now().getTime() + this.cacheTtlMs, result: structuredClone(result) });
    return result;
  }
}
