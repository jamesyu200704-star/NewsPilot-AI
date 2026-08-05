import assert from 'node:assert/strict';
import test from 'node:test';
import { getKnowledgeBaseStats, retrieveKnowledge } from '../../knowledge/知识库.js';
import type { SearchResult } from '../../shared/generation.js';
import { buildSearchQueries } from '../../shared/检索查询.js';
import type { SearchProvider } from '../search/SearchProvider.js';
import { RetrievalService } from '../services/检索服务.js';
import { sampleInput } from './fixtures.js';

class StaticSearchProvider implements SearchProvider {
  readonly name = 'brave' as const;

  async search(query: string): Promise<SearchResult[]> {
    return [
      {
        id: 'official-policy',
        title: '高校生成式人工智能使用规范',
        url: 'https://example.edu/policy/ai',
        snippet: `与“${query}”相关的公开政策说明。`,
        sourceName: '示例高校官网',
        sourceType: 'policy',
        publishedAt: '2026-07-01',
      },
    ];
  }
}

test('知识库只保存方法论摘要并覆盖新闻价值、案例和采访策略', () => {
  const stats = getKnowledgeBaseStats();

  assert.equal(stats.newsValueDimensions, 6);
  assert.ok(stats.casePatterns >= 3);
  assert.ok(stats.interviewStrategies >= 3);

  const matches = retrieveKnowledge(sampleInput, 6);
  assert.ok(matches.some((item) => item.kind === 'case-pattern'));
  assert.ok(matches.some((item) => item.kind === 'interview-strategy'));
  assert.ok(matches.every((item) => item.summary.length <= 600));
});

test('检索查询覆盖主题、政策、公开数据和近期报道', () => {
  const queries = buildSearchQueries(sampleInput);

  assert.ok(queries.length >= 4);
  assert.equal(new Set(queries).size, queries.length);
  assert.ok(queries.some((query) => /政策|规定|规范/u.test(query)));
  assert.ok(queries.some((query) => /数据|统计|报告/u.test(query)));
  assert.ok(queries.some((query) => /近期|新闻|报道/u.test(query)));
});

test('检索服务合并知识库与实时搜索证据并保留来源', async () => {
  const service = new RetrievalService(
    new StaticSearchProvider(),
    () => new Date('2026-08-05T08:00:00.000Z'),
  );

  const result = await service.retrieve(sampleInput);

  assert.equal(result.searchProvider, 'brave');
  assert.equal(result.searchStatus, 'live');
  assert.ok(result.queries.length >= 4);
  assert.ok(result.evidence.some((item) => item.origin === 'search'));
  assert.ok(result.evidence.some((item) => item.origin === 'knowledge'));
  assert.ok(
    result.evidence.some(
      (item) => item.sourceUrl === 'https://example.edu/policy/ai',
    ),
  );
  assert.equal(result.retrievedAt, '2026-08-05T08:00:00.000Z');
});
