import assert from 'node:assert/strict';
import test from 'node:test';
import { readServerConfig } from '../config.js';

test('服务端默认使用 Mock，并提供安全的 Ollama 默认配置', () => {
  const config = readServerConfig({});

  assert.equal(config.provider, 'mock');
  assert.equal(config.ollamaBaseUrl, 'http://localhost:11434');
  assert.equal(config.ollamaModel, 'qwen2.5:1.5b');
  assert.equal(config.searchProvider, 'mock');
});

test('SEARCH_MODE=brave 只从服务端配置实时搜索凭据', () => {
  const config = readServerConfig({
    SEARCH_MODE: 'brave',
    BRAVE_SEARCH_API_KEY: 'server-search-placeholder',
    BRAVE_SEARCH_TIMEOUT_MS: '12000',
  });

  assert.equal(config.searchProvider, 'brave');
  assert.equal(config.braveSearchApiKey, 'server-search-placeholder');
  assert.equal(config.braveSearchTimeoutMs, 12_000);
});

test('GENERATION_MODE=ollama 启用可配置的本地模型', () => {
  const config = readServerConfig({
    GENERATION_MODE: 'ollama',
    OLLAMA_BASE_URL: 'http://127.0.0.1:22434/',
    OLLAMA_MODEL: 'qwen3:14b',
  });

  assert.equal(config.provider, 'ollama');
  assert.equal(config.ollamaBaseUrl, 'http://127.0.0.1:22434');
  assert.equal(config.ollamaModel, 'qwen3:14b');
});

test('GENERATION_MODE=qwen 启用独立 QwenProvider 配置', () => {
  const config = readServerConfig({
    GENERATION_MODE: 'qwen',
    OLLAMA_BASE_URL: 'http://127.0.0.1:11434',
    OLLAMA_MODEL: 'qwen3:8b',
  });

  assert.equal(config.provider, 'qwen');
  assert.equal(config.ollamaModel, 'qwen3:8b');
});

test('兼容原有 GENERATION_PROVIDER=openai 配置', () => {
  const config = readServerConfig({
    GENERATION_PROVIDER: 'openai',
    OPENAI_API_KEY: 'test-only-placeholder',
  });

  assert.equal(config.provider, 'openai');
  assert.equal(config.openAIApiKey, 'test-only-placeholder');
});
