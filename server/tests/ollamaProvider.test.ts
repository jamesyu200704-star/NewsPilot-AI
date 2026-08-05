import assert from 'node:assert/strict';
import test from 'node:test';
import {
  editorialRevisionJsonSchema,
  generationContentJsonSchema,
  verificationReviewJsonSchema,
} from '../../shared/generation.js';
import {
  createMockEditorialRevision,
  createMockVerificationReview,
} from '../../shared/mockAgents.js';
import { createMockGenerationContent } from '../../shared/mockGeneration.js';
import { buildPlanningContext } from '../../shared/新闻方法论.js';
import { OllamaProvider } from '../providers/OllamaProvider.js';
import {
  OllamaConnectionError,
  OllamaModelNotFoundError,
  type OllamaFetchImplementation,
} from '../services/ollama.js';
import { sampleInput } from './fixtures.js';

const sampleContext = buildPlanningContext(sampleInput);
const generationContent = () => createMockGenerationContent(sampleContext);

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

  const result = await provider.generate(sampleContext);
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
  assert.match(requestBody.messages[0]?.content ?? '', /禁止编造事实/);
  assert.equal(result.angles.length, 3);
  assert.ok(result.dataNeeds.length >= 4);
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

  const result = await provider.generate(sampleContext);

  assert.equal(calls, 2);
  assert.equal(result.angles.length, 3);
});

test('OllamaProvider 为 Qwen 执行独立事实核查与编辑终审调用', async () => {
  const draft = generationContent();
  const verification = createMockVerificationReview(sampleContext, draft);
  const editorial = createMockEditorialRevision(
    sampleContext,
    draft,
    verification,
  );
  const capturedBodies: Array<{
    format: unknown;
    messages: Array<{ content: string }>;
  }> = [];
  const responses = [verification, editorial];
  const provider = new OllamaProvider({
    baseUrl: 'http://localhost:11434',
    model: 'qwen3:8b',
    fetchImplementation: async (_input, init) => {
      capturedBodies.push(JSON.parse(String(init?.body)));
      return toOllamaResponse(
        JSON.stringify(responses[capturedBodies.length - 1]),
      );
    },
  });

  const reviewed = await provider.verify(sampleContext, draft);
  const revised = await provider.edit(sampleContext, draft, reviewed);

  assert.equal(capturedBodies.length, 2);
  assert.equal(
    hasSchemaKeyword(verificationReviewJsonSchema, 'pattern'),
    true,
  );
  assert.equal(hasSchemaKeyword(capturedBodies[0]?.format, 'pattern'), false);
  assert.match(
    capturedBodies[0]?.messages[0]?.content ?? '',
    /事实核查 Agent/u,
  );
  assert.equal(hasSchemaKeyword(editorialRevisionJsonSchema, 'pattern'), true);
  assert.equal(hasSchemaKeyword(capturedBodies[1]?.format, 'pattern'), false);
  assert.match(
    capturedBodies[1]?.messages[0]?.content ?? '',
    /新闻编辑 Agent/u,
  );
  assert.equal(revised.content.angles.length, 3);
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

  await assert.rejects(() => provider.generate(sampleContext), /有效 JSON/);
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
    () => provider.generate(sampleContext),
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
    () => provider.generate(sampleContext),
    (error) =>
      error instanceof OllamaModelNotFoundError &&
      error.message === '请下载对应模型。',
  );
});
