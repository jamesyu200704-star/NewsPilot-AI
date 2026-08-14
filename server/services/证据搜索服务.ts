import type { SearchQuery } from '../../shared/证据领域模型.js';
import type { SearchOptions, SearchProvider, SearchProviderResult } from '../search/p1/SearchProvider.js';

export class EvidenceSearchService {
  constructor(
    private readonly primaryProvider: SearchProvider,
    private readonly manualFallback: SearchProvider,
    private readonly now: () => Date = () => new Date(),
  ) {}

  async search(query: SearchQuery, options: SearchOptions = {}): Promise<SearchProviderResult> {
    try {
      return await this.primaryProvider.search(query, options);
    } catch {
      const manual = await this.manualFallback.search(query);
      return {
        ...manual,
        status: 'failed',
        retrievedAt: this.now().toISOString(),
        notice: '实时搜索不可用，未生成替代搜索结果；请手动添加来源或稍后重试。',
      };
    }
  }
}
