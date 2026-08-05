import type {
  SearchProviderName,
  SearchResult,
} from '../../shared/generation.js';

export interface SearchProvider {
  readonly name: SearchProviderName;
  search(query: string, limit?: number): Promise<SearchResult[]>;
}
