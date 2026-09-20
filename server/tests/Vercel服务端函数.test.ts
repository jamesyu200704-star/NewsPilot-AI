import assert from 'node:assert/strict';
import { createServer, type RequestListener } from 'node:http';
import test from 'node:test';
import healthHandler from '../../api/health.js';
import generateHandler from '../../api/generate.js';
import { createConfiguredApiApp } from '../运行时.js';

const withServer = async (
  handler: RequestListener,
  run: (baseUrl: string) => Promise<void>,
) => {
  const server = createServer(handler);
  await new Promise<void>((resolve) => server.listen(0, '127.0.0.1', resolve));
  const address = server.address();
  assert.ok(address && typeof address !== 'string');

  try {
    await run(`http://127.0.0.1:${address.port}`);
  } finally {
    await new Promise<void>((resolve, reject) => {
      server.close((error) => (error ? reject(error) : resolve()));
    });
  }
};

test('Vercel 运行时按服务端环境变量启用 OpenAI Provider', async () => {
  const app = createConfiguredApiApp({
    GENERATION_MODE: 'openai',
    OPENAI_API_KEY: 'test-only-placeholder',
    OPENAI_MODEL: 'gpt-5.6-terra',
    SEARCH_PROVIDER: 'manual',
    TRANSCRIPTION_PROVIDER: 'manual',
  });

  await withServer(app, async (baseUrl) => {
    const response = await fetch(`${baseUrl}/api/health`);
    assert.equal(response.status, 200);
    assert.deepEqual(await response.json(), {
      ok: true,
      provider: 'openai',
      fallbackProvider: 'mock',
      searchProvider: 'manual',
      transcriptionProvider: 'manual',
    });
  });
});

test('Vercel health 与 generate 入口复用同一个受控 API App', async () => {
  assert.equal(healthHandler, generateHandler);

  await withServer(healthHandler, async (baseUrl) => {
    const response = await fetch(`${baseUrl}/api/health`);
    assert.equal(response.status, 200);
    const payload = (await response.json()) as { ok?: boolean; provider?: string };
    assert.equal(payload.ok, true);
    assert.ok(['mock', 'openai', 'ollama', 'qwen'].includes(payload.provider || ''));
  });
});
