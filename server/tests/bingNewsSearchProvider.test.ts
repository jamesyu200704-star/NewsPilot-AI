import assert from 'node:assert/strict';
import test from 'node:test';
import { BingNewsSearchProvider } from '../search/p1/BingNewsSearchProvider.js';
import type { SearchQuery } from '../../shared/证据领域模型.js';

const query: SearchQuery = {
  id: 'q1', claimIds: [], query: '柯洁赢棋', purpose: '了解事件背景',
  targetSourceTypes: ['news_report'], priority: 'high', userEditable: false,
};

test('Bing 新闻 RSS 转为实时搜索来源', async () => {
  let requestedUrl = '';
  const provider = new BingNewsSearchProvider({
    fetchImplementation: async (input: string | URL | Request) => {
      requestedUrl = String(input);
      return new Response(`<?xml version="1.0"?><rss><channel><item><title>柯洁夺冠</title><link>https://news.example.com/a</link><description>柯洁在决赛中取胜。</description><pubDate>Wed, 16 Sep 2026 08:00:00 GMT</pubDate><News:Source>示例媒体</News:Source></item></channel></rss>`, { status: 200, headers: { 'Content-Type': 'application/xml' } });
    },
    now: () => new Date('2026-09-17T00:00:00.000Z'),
  });

  const result = await provider.search(query, { limit: 5 });

  assert.match(requestedUrl, /bing\.com\/news\/search/u);
  assert.equal(result.status, 'live');
  assert.equal(result.results[0]?.title, '柯洁夺冠');
  assert.equal(result.results[0]?.sourceName, '示例媒体');
  assert.equal(result.results[0]?.isMock, false);
});

test('Bing 新闻 RSS 失效时自动降级到 Bing 网页 RSS', async () => {
  const requestedUrls: string[] = [];
  const provider = new BingNewsSearchProvider({
    fetchImplementation: async (input) => {
      requestedUrls.push(String(input));
      if (requestedUrls.length === 1) {
        return new Response('<html></html>', { status: 200, headers: { 'Content-Type': 'text/html' } });
      }
      return new Response('<?xml version="1.0"?><rss><channel><item><title>柯洁近期比赛</title><link>https://example.com/kejie</link><description>公开网页结果摘要。</description></item></channel></rss>', { status: 200, headers: { 'Content-Type': 'text/xml' } });
    },
  });
  const result = await provider.search(query);
  assert.equal(requestedUrls.length, 2);
  assert.match(requestedUrls[1] || '', /bing\.com\/search/u);
  assert.equal(result.results[0]?.title, '柯洁近期比赛');
  assert.match(result.notice, /网页搜索/u);
});
