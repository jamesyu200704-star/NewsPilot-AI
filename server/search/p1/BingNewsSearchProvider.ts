import type { SearchQuery } from '../../../shared/证据领域模型.js';
import type { FetchImplementation, SearchOptions, SearchProvider, SearchProviderResult } from './SearchProvider.js';

interface Options {
  timeoutMs?: number;
  fetchImplementation?: FetchImplementation;
  now?: () => Date;
}

const decodeXml = (value: string) => value
  .replace(/<!\[CDATA\[([\s\S]*?)\]\]>/gu, '$1')
  .replace(/&lt;/gu, '<').replace(/&gt;/gu, '>').replace(/&quot;/gu, '"')
  .replace(/&#39;|&apos;/gu, "'").replace(/&amp;/gu, '&')
  .replace(/<[^>]+>/gu, ' ').replace(/\s+/gu, ' ').trim();

const element = (xml: string, name: string) => {
  const escaped = name.replace(/[.*+?^${}()|[\]\\]/gu, '\\$&');
  return decodeXml(xml.match(new RegExp(`<${escaped}(?:\\s[^>]*)?>([\\s\\S]*?)<\\/${escaped}>`, 'iu'))?.[1] || '');
};

export class BingNewsSearchProvider implements SearchProvider {
  readonly id = 'bing_news' as const;
  readonly name = 'Bing 新闻';
  private readonly timeoutMs: number;
  private readonly fetchImplementation: FetchImplementation;
  private readonly now: () => Date;

  constructor(options: Options = {}) {
    this.timeoutMs = options.timeoutMs || 10_000;
    this.fetchImplementation = options.fetchImplementation || globalThis.fetch;
    this.now = options.now || (() => new Date());
  }

  isAvailable() { return Promise.resolve(true); }

  async search(query: SearchQuery, options: SearchOptions = {}): Promise<SearchProviderResult> {
    const searchText = query.query.trim().slice(0, 300);
    const newsUrl = new URL('https://www.bing.com/news/search');
    newsUrl.searchParams.set('q', searchText);
    newsUrl.searchParams.set('format', 'rss');
    newsUrl.searchParams.set('setlang', 'zh-cn');
    const controller = new AbortController();
    const timeout = globalThis.setTimeout(() => controller.abort(), this.timeoutMs);
    try {
      let response = await this.fetchImplementation(newsUrl, {
        headers: { Accept: 'application/rss+xml, application/xml', 'User-Agent': 'NewsPilot/1.1' },
        signal: controller.signal,
      });
      if (!response.ok) throw new Error(`Bing 新闻请求失败（HTTP ${response.status}）。`);
      let contentType = response.headers.get('content-type')?.toLowerCase() || '';
      let usedWebFallback = false;
      if (!contentType.includes('xml')) {
        const webUrl = new URL('https://www.bing.com/search');
        webUrl.searchParams.set('q', searchText);
        webUrl.searchParams.set('format', 'rss');
        response = await this.fetchImplementation(webUrl, {
          headers: { Accept: 'application/rss+xml, application/xml', 'User-Agent': 'NewsPilot/1.1' },
          signal: controller.signal,
        });
        if (!response.ok) throw new Error(`Bing 网页搜索请求失败（HTTP ${response.status}）。`);
        contentType = response.headers.get('content-type')?.toLowerCase() || '';
        if (!contentType.includes('xml')) throw new Error('Bing 搜索返回的内容不是 XML。');
        usedWebFallback = true;
      }
      const xml = await response.text();
      const retrievedAt = this.now().toISOString();
      const limit = Math.min(8, Math.max(1, options.limit || 8));
      const items = [...xml.matchAll(/<item(?:\s[^>]*)?>([\s\S]*?)<\/item>/giu)];
      const results = items.flatMap((match, index) => {
        const item = match[1] || '';
        const title = element(item, 'title');
        const link = element(item, 'link');
        const snippet = element(item, 'description');
        if (!title || !link || !snippet) return [];
        const sourceName = element(item, 'News:Source') || (() => {
          try { return new URL(link).hostname; } catch { return '公开媒体'; }
        })();
        const publishedAt = element(item, 'pubDate');
        return [{
          id: `BN-${query.id}-${String(index + 1).padStart(3, '0')}`,
          title, url: link, snippet, sourceName,
          ...(publishedAt ? { publishedAt } : {}),
          suggestedSourceType: 'news_report' as const,
          claimIds: [...query.claimIds], purpose: query.purpose, queryId: query.id,
          retrievedAt, isMock: false,
        }];
      }).slice(0, limit);
      return {
        providerId: this.id, status: 'live', queryId: query.id, results, retrievedAt,
        notice: usedWebFallback
          ? 'Bing 新闻搜索暂不可用，已自动使用 Bing 网页搜索的实时公开结果。'
          : '已搜索 Bing 新闻公开结果；这些资料用于准备采访，关键事实仍需向当事人或原始来源核实。',
        cached: false,
      };
    } finally {
      globalThis.clearTimeout(timeout);
    }
  }
}
