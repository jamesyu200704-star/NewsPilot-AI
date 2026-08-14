import type { SearchQuery, SourceType } from '../../shared/证据领域模型.js';

export interface EvidenceSearchCandidate {
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

export interface EvidenceSearchResult {
  providerId: 'manual' | 'mock' | 'searxng';
  status: 'manual' | 'mock' | 'live' | 'failed';
  queryId: string;
  results: EvidenceSearchCandidate[];
  retrievedAt: string;
  notice: string;
  cached: boolean;
}

export interface ExtractedPage {
  title: string;
  author?: string;
  publisher?: string;
  publishedAt?: string;
  language?: string;
  text: string;
  paragraphs: Array<{ paragraphIndex: number; sectionTitle?: string; text: string }>;
  warnings: string[];
  sourceUrl: string;
  retrievedAt: string;
}

const request = async <T>(path: string, body: unknown, forceRefresh = false): Promise<T> => {
  const response = await fetch(path, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'X-NewsPilot-Client': 'evidence-workbench',
      ...(forceRefresh ? { 'X-NewsPilot-Refresh': 'true' } : {}),
    },
    body: JSON.stringify(body),
  });
  const value: unknown = await response.json().catch(() => null);
  if (!response.ok) {
    const message = value && typeof value === 'object' && 'error' in value && typeof value.error === 'string'
      ? value.error
      : `证据服务请求失败（HTTP ${response.status}）。`;
    throw new Error(message);
  }
  return value as T;
};

export function createDemoSearchResult(query: SearchQuery): EvidenceSearchResult {
  const retrievedAt = new Date().toISOString();
  return {
    providerId: 'mock',
    status: 'mock',
    queryId: query.id,
    retrievedAt,
    cached: false,
    notice: '当前为模拟检索结果，不代表真实网络搜索。',
    results: [{
      id: `MOCK-${query.id}`,
      title: `模拟来源卡｜${query.query}`,
      snippet: `用于演示“${query.purpose}”的结果卡结构；该摘要不能作为证据。`,
      sourceName: 'NewsPilot 演示数据',
      suggestedSourceType: query.targetSourceTypes[0] || 'unknown',
      claimIds: query.claimIds,
      purpose: query.purpose,
      queryId: query.id,
      retrievedAt,
      isMock: true,
    }],
  };
}

export const searchEvidence = (query: SearchQuery, demoMode: boolean, forceRefresh = false) =>
  demoMode ? Promise.resolve(createDemoSearchResult(query)) : request<EvidenceSearchResult>('/api/evidence/search', query, forceRefresh);

export const fetchEvidencePage = (url: string, forceRefresh = false) =>
  request<ExtractedPage>('/api/evidence/fetch', { url, forceRefresh });
