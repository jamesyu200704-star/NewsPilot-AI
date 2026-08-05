import assert from 'node:assert/strict';
import test from 'node:test';
import {
  detectGenerationProvider,
  getProviderPresentation,
  resolveGenerationMode,
  shouldDetectGenerationProvider,
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

test('健康检查返回 QwenProvider 时启用本地 Qwen Agent', async () => {
  const status = await detectGenerationProvider({
    endpoint: '/api/health',
    timeoutMs: 100,
    fetchImplementation: async () =>
      Response.json({
        ok: true,
        provider: 'qwen',
        fallbackProvider: 'mock',
        searchProvider: 'brave',
      }),
  });

  assert.deepEqual(status, {
    state: 'ready',
    provider: 'qwen',
    searchProvider: 'brave',
  });
  const presentation = getProviderPresentation(status);
  assert.equal(presentation.optionTitle, 'Qwen Agent');
  assert.match(presentation.optionDescription, /三个 Agent/u);
  assert.match(presentation.privacyNotice, /Brave Search API/u);
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

test('生产环境的静态 Demo 不请求不存在的 Provider 健康接口', () => {
  assert.equal(shouldDetectGenerationProvider('mock', true), false);
  assert.equal(shouldDetectGenerationProvider('local-ai', true), true);
  assert.equal(shouldDetectGenerationProvider('mock', false), true);
});

test('Provider 展示文案准确说明数据去向与可用状态', () => {
  const checking = getProviderPresentation({
    state: 'checking',
    provider: null,
  });
  assert.match(checking.optionDescription, /识别项目后端配置/u);

  const ollama = getProviderPresentation({
    state: 'ready',
    provider: 'ollama',
  });
  assert.equal(ollama.optionTitle, 'Ollama AI');
  assert.match(ollama.optionDescription, /已配置的 Ollama/u);
  assert.match(ollama.privacyNotice, /请确认该地址可信/u);
  assert.doesNotMatch(ollama.privacyNotice, /不会提交给第三方/u);
  assert.equal(ollama.optionDisabled, false);

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
