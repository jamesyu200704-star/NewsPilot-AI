import type { SearchQuery } from '../../../shared/证据领域模型.js';
import type {
  SearchCandidate,
  SearchOptions,
  SearchProvider,
  SearchProviderResult,
} from './SearchProvider.js';

type ManualInput = Pick<SearchCandidate, 'id' | 'title' | 'snippet' | 'sourceName'> &
  Partial<Pick<SearchCandidate, 'url' | 'publishedAt' | 'suggestedSourceType'>>;

export class ManualSourceProvider implements SearchProvider {
  readonly id = 'manual' as const;
  readonly name = '手动来源';
  private readonly entries: ManualInput[] = [];
  constructor(private readonly now: () => Date = () => new Date()) {}

  add(entry: ManualInput) {
    if (!entry.id.trim() || !entry.title.trim() || !entry.snippet.trim()) {
      throw new Error('手动来源必须包含编号、标题和内容摘要。');
    }
    this.entries.push(structuredClone(entry));
  }

  isAvailable() {
    return Promise.resolve(true);
  }

  search(query: SearchQuery, options: SearchOptions = {}): Promise<SearchProviderResult> {
    const retrievedAt = this.now().toISOString();
    const limit = Math.min(20, Math.max(1, options.limit || 10));
    return Promise.resolve({
      providerId: this.id,
      status: 'manual',
      queryId: query.id,
      results: this.entries.slice(0, limit).map((entry) => ({
        ...entry,
        suggestedSourceType: entry.suggestedSourceType || 'unknown',
        claimIds: [...query.claimIds],
        purpose: query.purpose,
        queryId: query.id,
        retrievedAt,
        isMock: false,
      })),
      retrievedAt,
      notice: '当前使用手动来源；不会自动发出网络请求。',
      cached: false,
    });
  }
}
