import assert from 'node:assert/strict';
import test from 'node:test';
import { readServerConfig } from '../config.js';

test('服务端默认使用 Mock，并提供安全的 Ollama 默认配置', () => {
  const config = readServerConfig({});

  assert.equal(config.provider, 'mock');
  assert.equal(config.ollamaBaseUrl, 'http://localhost:11434');
  assert.equal(config.ollamaModel, 'qwen2.5:1.5b');
  assert.equal(config.searchProvider, 'mock');
  assert.equal(config.searxngBaseUrl, 'http://localhost:8080');
  assert.equal(config.searchResultLimit, 10);
  assert.equal(config.searchMaxConcurrentFetches, 3);
  assert.equal(config.uploadMaxFileMb, 10);
  assert.equal(config.uploadMaxProjectMb, 50);
  assert.equal(config.transcriptionProvider, 'manual');
  assert.equal(config.localWhisperBaseUrl, 'http://localhost:9000');
  assert.equal(config.transcriptionMaxFileMb, 100);
});

test('TRANSCRIPTION_PROVIDER=local_whisper 只启用本机转写配置', () => {
  const config = readServerConfig({
    TRANSCRIPTION_PROVIDER: 'local_whisper',
    LOCAL_WHISPER_BASE_URL: 'http://127.0.0.1:19000/',
    TRANSCRIPTION_MAX_FILE_MB: '80',
  });
  assert.equal(config.transcriptionProvider, 'local_whisper');
  assert.equal(config.localWhisperBaseUrl, 'http://127.0.0.1:19000');
  assert.equal(config.transcriptionMaxFileMb, 80);
});

test('SEARCH_PROVIDER=searxng 启用服务端 SearXNG 与受控搜索限制', () => {
  const config = readServerConfig({
    SEARCH_PROVIDER: 'searxng',
    SEARXNG_BASE_URL: 'http://127.0.0.1:18080/',
    SEARCH_RESULT_LIMIT: '7',
    SEARCH_TIMEOUT_MS: '9000',
    SEARCH_RATE_LIMIT_PER_MINUTE: '5',
    SEARCH_MAX_CONCURRENT_FETCHES: '4',
    UPLOAD_MAX_FILE_MB: '8',
    UPLOAD_MAX_PROJECT_MB: '30',
  });
  assert.equal(config.searchProvider, 'searxng');
  assert.equal(config.searxngBaseUrl, 'http://127.0.0.1:18080');
  assert.equal(config.searchResultLimit, 7);
  assert.equal(config.searchTimeoutMs, 9_000);
  assert.equal(config.searchRateLimitPerMinute, 5);
  assert.equal(config.searchMaxConcurrentFetches, 4);
  assert.equal(config.uploadMaxFileMb, 8);
  assert.equal(config.uploadMaxProjectMb, 30);
});

test('SEARCH_MODE=brave 只从服务端配置实时搜索凭据', () => {
  const config = readServerConfig({
    SEARCH_MODE: 'brave',
    BRAVE_SEARCH_API_KEY: 'test-placeholder-not-a-credential',
    BRAVE_SEARCH_TIMEOUT_MS: '12000',
  });

  assert.equal(config.searchProvider, 'brave');
  assert.equal(config.braveSearchApiKey, 'test-placeholder-not-a-credential');
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
