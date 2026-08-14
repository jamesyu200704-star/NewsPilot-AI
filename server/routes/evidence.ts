import { Router } from 'express';
import type { EvidenceSearchService } from '../services/证据搜索服务.js';
import type { SourceFetcher } from '../sources/SourceFetcher.js';
import { extractWebContent } from '../sources/ContentExtractor.js';
import type { SearchQuery, SourceType } from '../../shared/证据领域模型.js';

const sourceTypes: SourceType[] = [
  'primary_document', 'official_statement', 'official_data', 'academic_source', 'news_report',
  'interview_material', 'user_material', 'social_post', 'commercial_content', 'repost', 'unknown',
];
const isRecord = (value: unknown): value is Record<string, unknown> =>
  value !== null && typeof value === 'object' && !Array.isArray(value);
const isStringArray = (value: unknown, min: number, max: number) =>
  Array.isArray(value) && value.length >= min && value.length <= max && value.every((item) => typeof item === 'string' && item.trim());
const isSearchQuery = (value: unknown): value is SearchQuery => {
  if (!isRecord(value)) return false;
  const allowed = new Set(['id', 'claimIds', 'query', 'purpose', 'targetSourceTypes', 'preferredDomains', 'timeRange', 'priority', 'userEditable']);
  return Object.keys(value).every((key) => allowed.has(key)) &&
    typeof value.id === 'string' && value.id.length <= 80 &&
    isStringArray(value.claimIds, 1, 20) && typeof value.query === 'string' && value.query.trim().length >= 2 && value.query.length <= 400 &&
    typeof value.purpose === 'string' && value.purpose.trim().length >= 2 && value.purpose.length <= 400 &&
    isStringArray(value.targetSourceTypes, 1, 10) && (value.targetSourceTypes as unknown[]).every((item) => sourceTypes.includes(item as SourceType)) &&
    (value.preferredDomains === undefined || isStringArray(value.preferredDomains, 0, 20)) &&
    (value.timeRange === undefined || (isRecord(value.timeRange) && Object.keys(value.timeRange).every((key) => ['from', 'to'].includes(key)) &&
      (value.timeRange.from === undefined || (typeof value.timeRange.from === 'string' && /^\d{4}-\d{2}-\d{2}$/u.test(value.timeRange.from))) &&
      (value.timeRange.to === undefined || (typeof value.timeRange.to === 'string' && /^\d{4}-\d{2}-\d{2}$/u.test(value.timeRange.to))))) &&
    ['high', 'medium', 'low'].includes(String(value.priority)) && value.userEditable === true;
};

interface RateEntry { count: number; startedAt: number }

export interface EvidenceRouteOptions {
  evidenceSearchService?: EvidenceSearchService;
  sourceFetcher?: SourceFetcher;
  evidenceMaxRequestsPerWindow?: number;
  evidenceRateLimitWindowMs?: number;
  evidenceMaxConcurrentFetches?: number;
  now?: () => number;
}

export function createEvidenceRouter(options: EvidenceRouteOptions) {
  const router = Router();
  const max = Math.max(1, options.evidenceMaxRequestsPerWindow || 10);
  const windowMs = Math.max(1_000, options.evidenceRateLimitWindowMs || 60_000);
  const now = options.now || Date.now;
  const limits = new Map<string, RateEntry>();
  const maxConcurrentFetches = Math.max(1, options.evidenceMaxConcurrentFetches || 3);
  let activeFetches = 0;
  const allowedClient = (value: string | undefined) => value === 'evidence-workbench';
  const consume = (client: string) => {
    const current = now();
    if (limits.size > 1_000) {
      for (const [key, value] of limits) {
        if (current - value.startedAt >= windowMs) limits.delete(key);
      }
    }
    const entry = limits.get(client);
    if (!entry || current - entry.startedAt >= windowMs) {
      limits.set(client, { count: 1, startedAt: current });
      return false;
    }
    if (entry.count >= max) return true;
    entry.count += 1;
    return false;
  };

  router.use((request, response, next) => {
    if (!allowedClient(request.get('X-NewsPilot-Client'))) {
      response.status(403).json({ error: '证据接口只允许 NewsPilot 工作台调用。' });
      return;
    }
    const client = request.ip || request.socket.remoteAddress || 'unknown';
    if (consume(client)) {
      response.set('Retry-After', '60').status(429).json({ error: '证据请求过于频繁，请稍后重试。' });
      return;
    }
    next();
  });

  router.post('/search', async (request, response) => {
    if (!options.evidenceSearchService) {
      response.status(503).json({ error: '实时搜索未启用，请使用手动来源。' });
      return;
    }
    if (!isSearchQuery(request.body)) {
      response.status(400).json({ error: '搜索计划字段无效。' });
      return;
    }
    try {
      response.status(200).json(await options.evidenceSearchService.search(request.body, {
        forceRefresh: request.get('X-NewsPilot-Refresh') === 'true',
      }));
    } catch {
      response.status(502).json({ error: '搜索服务不可用，请使用手动来源。' });
    }
  });

  router.post('/fetch', async (request, response) => {
    if (!options.sourceFetcher) {
      response.status(503).json({ error: '网页抓取未启用，请使用手动来源或上传材料。' });
      return;
    }
    if (!isRecord(request.body) || Object.keys(request.body).some((key) => !['url', 'forceRefresh'].includes(key)) ||
      typeof request.body.url !== 'string' || request.body.url.length > 2048 ||
      (request.body.forceRefresh !== undefined && typeof request.body.forceRefresh !== 'boolean')) {
      response.status(400).json({ error: '来源 URL 参数无效。' });
      return;
    }
    if (activeFetches >= maxConcurrentFetches) {
      response.status(429).json({ error: '当前网页抓取任务较多，请稍后重试。' });
      return;
    }
    activeFetches += 1;
    try {
      const fetched = await options.sourceFetcher.fetch(request.body.url, { forceRefresh: request.body.forceRefresh === true });
      response.status(200).json({
        ...extractWebContent(fetched.body, fetched.finalUrl),
        retrievedAt: fetched.retrievedAt,
      });
    } catch (error) {
      response.status(400).json({ error: error instanceof Error ? error.message : '网页抓取失败。' });
    } finally {
      activeFetches -= 1;
    }
  });
  return router;
}
