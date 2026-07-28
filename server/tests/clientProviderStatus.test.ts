import assert from 'node:assert/strict';
import test from 'node:test';
import {
  detectGenerationProvider,
  getProviderPresentation,
  resolveGenerationMode,
  type ClientFetchImplementation,
} from '../../src/services/providerStatus.js';

test('健康检查返回 Ollama 时启用本地 AI 模式', async () => {
  const fakeFetch: ClientFetchImplementation = async () =>
    Response.json({
      ok: true,
      provider: 'ollama',
      fallbackProvider: 'mock',
    });

  const status = await detectGenerationProvider({
    endpoint: '/api/health',
    timeoutMs: 100,
    fetchImplementation: fakeFetch,
  });

  assert.deepEqual(status, {
    state: 'ready',
    provider: 'ollama',
  });
});

test('健康检查返回 OpenAI 时准确标记云端 Provider', async () => {
  const status = await detectGenerationProvider({
    endpoint: '/api/health',
    timeoutMs: 100,
    fetchImplementation: async () =>
      Response.json({
        ok: true,
        provider: 'openai',
        fallbackProvider: 'mock',
      }),
  });

  assert.deepEqual(status, {
    state: 'ready',
    provider: 'openai',
  });
});

test('后端只配置 Mock 时不启用 AI 模式', async () => {
  const status = await detectGenerationProvider({
    endpoint: '/api/health',
    timeoutMs: 100,
    fetchImplementation: async () =>
      Response.json({
        ok: true,
        provider: 'mock',
        fallbackProvider: 'mock',
      }),
  });

  assert.deepEqual(status, {
    state: 'unavailable',
    provider: 'mock',
  });
});

test('静态部署或非法健康响应安全回落为不可用', async () => {
  const responses = [
    new Response(null, { status: 404 }),
    Response.json({ ok: true, provider: 'unknown' }),
  ];

  for (const response of responses) {
    const status = await detectGenerationProvider({
      endpoint: '/api/health',
      timeoutMs: 100,
      fetchImplementation: async () => response,
    });

    assert.deepEqual(status, {
      state: 'unavailable',
      provider: null,
    });
  }
});

test('Provider 展示文案准确说明数据去向与可用状态', () => {
  const openAI = getProviderPresentation({
    state: 'ready',
    provider: 'openai',
  });
  assert.equal(openAI.optionTitle, 'OpenAI 模式');
  assert.match(openAI.privacyNotice, /发送到 OpenAI API/u);
  assert.equal(openAI.optionDisabled, false);

  const unavailable = getProviderPresentation({
    state: 'unavailable',
    provider: null,
  });
  assert.equal(unavailable.optionTitle, 'AI 服务未连接');
  assert.equal(unavailable.optionDisabled, true);
  assert.match(unavailable.optionDescription, /可继续使用 Demo/u);
});

test('AI 后端不可用时把预设的 AI 模式安全回退为 Demo', () => {
  assert.equal(
    resolveGenerationMode('local-ai', {
      state: 'unavailable',
      provider: null,
    }),
    'mock',
  );
  assert.equal(
    resolveGenerationMode('local-ai', {
      state: 'ready',
      provider: 'ollama',
    }),
    'local-ai',
  );
  assert.equal(
    resolveGenerationMode('mock', {
      state: 'ready',
      provider: 'openai',
    }),
    'mock',
  );
});
