import assert from 'node:assert/strict';
import test from 'node:test';
import type { Server } from 'node:http';
import type { AddressInfo } from 'node:net';
import { createApiServer } from '../app.js';
import { MockProvider } from '../providers/MockProvider.js';
import { GeneratorService } from '../services/generator.js';
import { EvidenceSearchService } from '../services/证据搜索服务.js';
import { ManualSourceProvider } from '../search/p1/ManualSourceProvider.js';
import { MockSearchProvider } from '../search/p1/MockSearchProvider.js';
import { SourceFetcher } from '../sources/SourceFetcher.js';

const listen = async (server: Server) => {
  await new Promise<void>((resolve) => server.listen(0, '127.0.0.1', resolve));
  return `http://127.0.0.1:${(server.address() as AddressInfo).port}`;
};
const close = (server: Server) => new Promise<void>((resolve, reject) =>
  server.close((error) => error ? reject(error) : resolve()));

const query = {
  id: 'SQ-001', claimIds: ['C-001'], query: 'site:edu.cn AI 课程规定',
  purpose: '寻找原始课程规定。', targetSourceTypes: ['primary_document'],
  priority: 'high', userEditable: true,
};

const createServer = (options: Parameters<typeof createApiServer>[1] = {}) => {
  const mock = new MockProvider();
  return createApiServer(new GeneratorService(mock, mock), options);
};

test('POST /api/evidence/search 校验 SearchQuery 并返回明确 Mock 标识', async () => {
  const service = new EvidenceSearchService(new MockSearchProvider(), new ManualSourceProvider());
  const server = createServer({ evidenceSearchService: service });
  const baseUrl = await listen(server);
  try {
    const response = await fetch(`${baseUrl}/api/evidence/search`, {
      method: 'POST', headers: { 'Content-Type': 'application/json', 'X-NewsPilot-Client': 'evidence-workbench' },
      body: JSON.stringify(query),
    });
    assert.equal(response.status, 200);
    const result = await response.json() as { status: string; notice: string; results: unknown[] };
    assert.equal(result.status, 'mock');
    assert.match(result.notice, /模拟检索/u);
    assert.equal(result.results.length, 1);

    const invalid = await fetch(`${baseUrl}/api/evidence/search`, {
      method: 'POST', headers: { 'Content-Type': 'application/json', 'X-NewsPilot-Client': 'evidence-workbench' },
      body: JSON.stringify({ ...query, claimIds: [], evil: true }),
    });
    assert.equal(invalid.status, 400);
  } finally { await close(server); }
});

test('证据 API 严格拒绝畸形可选字段和非布尔刷新参数', async () => {
  const server = createServer({
    evidenceSearchService: new EvidenceSearchService(new MockSearchProvider(), new ManualSourceProvider()),
    sourceFetcher: new SourceFetcher({
      lookup: async () => [{ address: '93.184.216.34', family: 4 }],
      fetchImplementation: async () => new Response('<html></html>', { headers: { 'Content-Type': 'text/html' } }),
    }),
  });
  const baseUrl = await listen(server);
  const requestHeaders = { 'Content-Type': 'application/json', 'X-NewsPilot-Client': 'evidence-workbench' };
  try {
    const malformedSearch = await fetch(`${baseUrl}/api/evidence/search`, {
      method: 'POST', headers: requestHeaders, body: JSON.stringify({ ...query, preferredDomains: 'edu.cn' }),
    });
    assert.equal(malformedSearch.status, 400);
    const malformedFetch = await fetch(`${baseUrl}/api/evidence/fetch`, {
      method: 'POST', headers: requestHeaders, body: JSON.stringify({ url: 'https://example.edu', forceRefresh: 'yes' }),
    });
    assert.equal(malformedFetch.status, 400);
  } finally { await close(server); }
});

test('证据搜索接口要求自定义请求头并实施独立频率限制', async () => {
  const service = new EvidenceSearchService(new MockSearchProvider(), new ManualSourceProvider());
  const server = createServer({ evidenceSearchService: service, evidenceMaxRequestsPerWindow: 1 });
  const baseUrl = await listen(server);
  try {
    const missingHeader = await fetch(`${baseUrl}/api/evidence/search`, {
      method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(query),
    });
    assert.equal(missingHeader.status, 403);
    const first = await fetch(`${baseUrl}/api/evidence/search`, {
      method: 'POST', headers: { 'Content-Type': 'application/json', 'X-NewsPilot-Client': 'evidence-workbench' }, body: JSON.stringify(query),
    });
    const second = await fetch(`${baseUrl}/api/evidence/search`, {
      method: 'POST', headers: { 'Content-Type': 'application/json', 'X-NewsPilot-Client': 'evidence-workbench' }, body: JSON.stringify(query),
    });
    assert.equal(first.status, 200);
    assert.equal(second.status, 429);
  } finally { await close(server); }
});

test('POST /api/evidence/fetch 在服务端抓取并返回清理后的正文，不开放任意内网代理', async () => {
  const fetcher = new SourceFetcher({
    lookup: async (hostname) => [{ address: hostname === 'public.example' ? '93.184.216.34' : '127.0.0.1', family: 4 }],
    fetchImplementation: async () => new Response(
      '<html><head><title>政策原文</title></head><body><main><p>学校正式发布课程规定。</p><script>evil()</script></main></body></html>',
      { headers: { 'Content-Type': 'text/html' } },
    ),
  });
  const server = createServer({ sourceFetcher: fetcher });
  const baseUrl = await listen(server);
  try {
    const internal = await fetch(`${baseUrl}/api/evidence/fetch`, {
      method: 'POST', headers: { 'Content-Type': 'application/json', 'X-NewsPilot-Client': 'evidence-workbench' },
      body: JSON.stringify({ url: 'http://127.0.0.1/private' }),
    });
    assert.equal(internal.status, 400);

    const publicResponse = await fetch(`${baseUrl}/api/evidence/fetch`, {
      method: 'POST', headers: { 'Content-Type': 'application/json', 'X-NewsPilot-Client': 'evidence-workbench' },
      body: JSON.stringify({ url: 'https://public.example/policy' }),
    });
    assert.equal(publicResponse.status, 200);
    const result = await publicResponse.json() as { title: string; text: string; sourceUrl: string };
    assert.equal(result.title, '政策原文');
    assert.match(result.text, /学校正式发布/u);
    assert.doesNotMatch(result.text, /evil/u);
    assert.equal(result.sourceUrl, 'https://public.example/policy');
  } finally { await close(server); }
});

test('未配置抓取器的公共 Demo 明确关闭网页代理', async () => {
  const server = createServer();
  const baseUrl = await listen(server);
  try {
    const response = await fetch(`${baseUrl}/api/evidence/fetch`, {
      method: 'POST', headers: { 'Content-Type': 'application/json', 'X-NewsPilot-Client': 'evidence-workbench' },
      body: JSON.stringify({ url: 'https://example.com' }),
    });
    assert.equal(response.status, 503);
    assert.match(JSON.stringify(await response.json()), /手动来源|未启用/u);
  } finally { await close(server); }
});

test('网页抓取接口限制并发，超限请求不会继续访问上游', async () => {
  let upstreamCalls = 0;
  let releaseFirst: (() => void) | undefined;
  let markStarted: (() => void) | undefined;
  const started = new Promise<void>((resolve) => { markStarted = resolve; });
  const blocker = new Promise<void>((resolve) => { releaseFirst = resolve; });
  const fetcher = new SourceFetcher({
    lookup: async () => [{ address: '93.184.216.34', family: 4 }],
    fetchImplementation: async () => {
      upstreamCalls += 1;
      if (upstreamCalls === 1) {
        markStarted?.();
        await blocker;
      }
      return new Response('<html><body><p>受控正文。</p></body></html>', { headers: { 'Content-Type': 'text/html' } });
    },
  });
  const serverOptions: Parameters<typeof createApiServer>[1] = {
    sourceFetcher: fetcher,
    evidenceMaxConcurrentFetches: 1,
  };
  const server = createServer(serverOptions);
  const baseUrl = await listen(server);
  const headers = { 'Content-Type': 'application/json', 'X-NewsPilot-Client': 'evidence-workbench' };
  try {
    const first = fetch(`${baseUrl}/api/evidence/fetch`, {
      method: 'POST', headers, body: JSON.stringify({ url: 'https://first.example/source' }),
    });
    await started;
    const second = await fetch(`${baseUrl}/api/evidence/fetch`, {
      method: 'POST', headers, body: JSON.stringify({ url: 'https://second.example/source' }),
    });
    assert.equal(second.status, 429);
    assert.equal(upstreamCalls, 1);
    releaseFirst?.();
    assert.equal((await first).status, 200);
  } finally {
    releaseFirst?.();
    await close(server);
  }
});
