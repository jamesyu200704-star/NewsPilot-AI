import assert from 'node:assert/strict';
import test from 'node:test';
import { generationContentJsonSchema } from '../../shared/generation.js';
import { createMockGenerationResult } from '../../shared/mockGeneration.js';
import { OllamaProvider } from '../providers/OllamaProvider.js';
import {
  OllamaConnectionError,
  OllamaModelNotFoundError,
  type OllamaFetchImplementation,
} from '../services/ollama.js';
import { sampleInput } from './fixtures.js';

const generationContent = () => {
  const { generatedAt: _generatedAt, mode: _mode, ...content } =
    createMockGenerationResult(sampleInput);
  return content;
};

const toOllamaResponse = (content: string, status = 200) =>
  new Response(
    JSON.stringify({
      model: 'qwen3:8b',
      message: {
        role: 'assistant',
        content,
      },
      done: true,
    }),
    {
      status,
      headers: { 'Content-Type': 'application/json' },
    },
  );

const hasSchemaKeyword = (value: unknown, keyword: string): boolean => {
  if (Array.isArray(value)) {
    return value.some((item) => hasSchemaKeyword(item, keyword));
  }

  if (typeof value !== 'object' || value === null) {
    return false;
  }

  return Object.entries(value).some(
    ([key, item]) => key === keyword || hasSchemaKeyword(item, keyword),
  );
};

test('OllamaProvider 调用本地 chat API 并解析结构化结果', async () => {
  let capturedUrl = '';
  let capturedInit: RequestInit | undefined;
  const fakeFetch: OllamaFetchImplementation = async (input, init) => {
    capturedUrl = String(input);
    capturedInit = init;
    return toOllamaResponse(JSON.stringify(generationContent()));
  };
  const provider = new OllamaProvider({
    baseUrl: 'http://localhost:11434/',
    model: 'qwen3:8b',
    fetchImplementation: fakeFetch,
  });

  const result = await provider.generate(sampleInput);
  const requestBody = JSON.parse(String(capturedInit?.body)) as {
    model: string;
    stream: boolean;
    think: boolean;
    format: unknown;
    messages: Array<{ role: string; content: string }>;
  };

  assert.equal(capturedUrl, 'http://localhost:11434/api/chat');
  assert.equal(requestBody.model, 'qwen3:8b');
  assert.equal(requestBody.stream, false);
  assert.equal(requestBody.think, false);
  assert.equal(hasSchemaKeyword(generationContentJsonSchema, 'pattern'), true);
  assert.equal(hasSchemaKeyword(requestBody.format, 'pattern'), false);
  assert.equal(requestBody.messages[0]?.role, 'system');
  assert.match(requestBody.messages[0]?.content ?? '', /不编造事实/);
  assert.equal(result.mode, 'ollama');
  assert.equal(result.angles.length, 3);
});

test('OllamaProvider 遇到无效 JSON 时只重试一次', async () => {
  let calls = 0;
  const provider = new OllamaProvider({
    baseUrl: 'http://localhost:11434',
    model: 'qwen3:8b',
    fetchImplementation: async () => {
      calls += 1;
      return toOllamaResponse(
        calls === 1 ? '{ invalid json' : JSON.stringify(generationContent()),
      );
    },
  });

  const result = await provider.generate(sampleInput);

  assert.equal(calls, 2);
  assert.equal(result.mode, 'ollama');
});

test('OllamaProvider 两次返回无效 JSON 后停止重试', async () => {
  let calls = 0;
  const provider = new OllamaProvider({
    baseUrl: 'http://localhost:11434',
    model: 'qwen3:8b',
    fetchImplementation: async () => {
      calls += 1;
      return toOllamaResponse('{ invalid json');
    },
  });

  await assert.rejects(() => provider.generate(sampleInput), /有效 JSON/);
  assert.equal(calls, 2);
});

test('OllamaProvider 将连接失败映射为可操作提示', async () => {
  const provider = new OllamaProvider({
    baseUrl: 'http://localhost:11434',
    model: 'qwen3:8b',
    fetchImplementation: async () => {
      throw new TypeError('fetch failed');
    },
  });

  await assert.rejects(
    () => provider.generate(sampleInput),
    (error) =>
      error instanceof OllamaConnectionError &&
      error.message === '请启动 Ollama 服务。',
  );
});

test('OllamaProvider 将模型缺失映射为可操作提示', async () => {
  const provider = new OllamaProvider({
    baseUrl: 'http://localhost:11434',
    model: 'qwen3:8b',
    fetchImplementation: async () =>
      new Response(JSON.stringify({ error: 'model not found' }), {
        status: 404,
        headers: { 'Content-Type': 'application/json' },
      }),
  });

  await assert.rejects(
    () => provider.generate(sampleInput),
    (error) =>
      error instanceof OllamaModelNotFoundError &&
      error.message === '请下载对应模型。',
  );
});
