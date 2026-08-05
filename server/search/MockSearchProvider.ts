import type { SearchResult } from '../../shared/generation.js';
import type { SearchProvider } from './SearchProvider.js';

export class MockSearchProvider implements SearchProvider {
  readonly name = 'mock' as const;

  search(): Promise<SearchResult[]> {
    return Promise.resolve([]);
  }
}
