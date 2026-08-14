import type { SearchQuery } from '../../../shared/证据领域模型.js';
import type { SearchOptions, SearchProvider, SearchProviderResult } from './SearchProvider.js';

export class MockSearchProvider implements SearchProvider {
  readonly id = 'mock' as const;
  readonly name = '离线模拟检索';
  constructor(private readonly now: () => Date = () => new Date()) {}

  isAvailable() {
    return Promise.resolve(true);
  }

  search(query: SearchQuery, _options: SearchOptions = {}): Promise<SearchProviderResult> {
    const retrievedAt = this.now().toISOString();
    return Promise.resolve({
      providerId: this.id,
      status: 'mock',
      queryId: query.id,
      results: [{
        id: `MOCK-${query.id}`,
        title: '模拟来源卡：请替换为真实文件或网页',
        snippet: `此卡仅演示“${query.purpose}”的证据工作流，不包含真实网络搜索内容。`,
        sourceName: 'NewsPilot 离线演示',
        suggestedSourceType: query.targetSourceTypes[0] || 'unknown',
        claimIds: [...query.claimIds],
        purpose: query.purpose,
        queryId: query.id,
        retrievedAt,
        isMock: true,
      }],
      retrievedAt,
      notice: '当前为模拟检索结果，不代表真实网络搜索。',
      cached: false,
    });
  }
}
