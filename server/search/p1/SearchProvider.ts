import type { SearchQuery, SourceType } from '../../../shared/证据领域模型.js';

export interface SearchOptions {
  limit?: number;
  forceRefresh?: boolean;
}

export interface SearchCandidate {
  id: string;
  title: string;
  url?: string;
  snippet: string;
  sourceName: string;
  publishedAt?: string;
  suggestedSourceType: SourceType;
  claimIds: string[];
  purpose: string;
  queryId: string;
  retrievedAt: string;
  isMock: boolean;
}

export interface SearchProviderResult {
  providerId: 'manual' | 'mock' | 'searxng' | 'bing_news';
  status: 'manual' | 'mock' | 'live' | 'failed';
  queryId: string;
  results: SearchCandidate[];
  retrievedAt: string;
  notice: string;
  cached: boolean;
}

export interface SearchProvider {
  readonly id: SearchProviderResult['providerId'];
  readonly name: string;
  isAvailable(): Promise<boolean>;
  search(query: SearchQuery, options?: SearchOptions): Promise<SearchProviderResult>;
}

export type FetchImplementation = (
  input: string | URL | Request,
  init?: RequestInit,
) => Promise<Response>;
