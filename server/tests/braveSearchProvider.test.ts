import assert from 'node:assert/strict';
import test from 'node:test';
import { BraveSearchProvider } from '../search/BraveSearchProvider.js';

test('BraveSearchProvider 使用服务端令牌并返回可追溯搜索结果', async () => {
  let requestUrl = '';
  let requestInit: RequestInit | undefined;
  const provider = new BraveSearchProvider({
    apiKey: 'server-search-placeholder',
    timeoutMs: 2_000,
    fetchImplementation: async (input, init) => {
      requestUrl = String(input);
      requestInit = init;
      return new Response(
        JSON.stringify({
          web: {
            results: [
              {
                title: '教育部门发布人工智能使用规范',
                url: 'https://edu.example.gov.cn/ai-policy',
                description: '文件说明高校生成式人工智能的教学使用边界。',
                profile: { long_name: '教育部门网站' },
                age: '2026-08-01T08:00:00.000Z',
              },
            ],
          },
        }),
        { status: 200, headers: { 'Content-Type': 'application/json' } },
      );
    },
  });

  const results = await provider.search('高校 AI 政策 规范', 3);

  const url = new URL(requestUrl);
  assert.equal(url.origin + url.pathname, 'https://api.search.brave.com/res/v1/web/search');
  assert.equal(url.searchParams.get('q'), '高校 AI 政策 规范');
  assert.equal(url.searchParams.get('count'), '3');
  assert.equal(
    new Headers(requestInit?.headers).get('X-Subscription-Token'),
    'server-search-placeholder',
  );
  assert.equal(results.length, 1);
  assert.equal(results[0]?.sourceType, 'policy');
  assert.equal(results[0]?.sourceName, '教育部门网站');
  assert.equal(results[0]?.publishedAt, '2026-08-01T08:00:00.000Z');
});

test('BraveSearchProvider 缺少服务端密钥时不会发出请求', async () => {
  let called = false;
  const provider = new BraveSearchProvider({
    apiKey: '',
    fetchImplementation: async () => {
      called = true;
      return new Response('{}');
    },
  });

  await assert.rejects(() => provider.search('高校 AI'), /BRAVE_SEARCH_API_KEY/u);
  assert.equal(called, false);
});
