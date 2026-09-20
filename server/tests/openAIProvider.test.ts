import assert from 'node:assert/strict';
import test from 'node:test';
import { buildNewsEditorPrompt } from '../../prompts/新闻编辑提示词.js';
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
import {
  OpenAIProvider,
  type FetchImplementation,
} from '../providers/OpenAIProvider.js';
import { SchemaValidationError } from '../validation.js';
import { sampleInput } from './fixtures.js';

const sampleContext = buildPlanningContext(sampleInput);

const toOpenAIResponse = (content: unknown) =>
  new Response(
    JSON.stringify({
      output: [
        {
          type: 'message',
          content: [
            {
              type: 'output_text',
              text: JSON.stringify(content),
            },
          ],
        },
      ],
    }),
    { status: 200, headers: { 'Content-Type': 'application/json' } },
  );

test('OpenAIProvider 使用 Responses JSON Schema 并解析有效结果', async () => {
  let capturedInit: RequestInit | undefined;
  const generationContent = createMockGenerationContent(sampleContext);
  const fakeFetch: FetchImplementation = async (_input, init) => {
    capturedInit = init;
    return toOpenAIResponse(generationContent);
  };
  const serverCredential = ['server', 'test', 'credential'].join('-');
  const provider = new OpenAIProvider({
    apiKey: serverCredential,
    model: 'test-model',
    fetchImplementation: fakeFetch,
  });

  const result = await provider.generate(sampleContext);
  const prompt = buildNewsEditorPrompt(sampleContext);
  const headers = new Headers(capturedInit?.headers);
  const requestBody = JSON.parse(String(capturedInit?.body)) as {
    model: string;
    store: boolean;
    input: Array<{ role: string; content: string }>;
    text: { format: { type: string; strict: boolean; schema: unknown } };
  };

  assert.equal(result.angles.length, 3);
  assert.ok(result.dataNeeds.length >= 4);
  assert.equal(headers.get('Authorization'), 'Bearer ' + serverCredential);
  assert.equal(requestBody.model, 'test-model');
  assert.equal(requestBody.store, false);
  assert.deepEqual(requestBody.input, [
    { role: 'system', content: prompt.system },
    { role: 'user', content: prompt.user },
  ]);
  assert.equal(requestBody.text.format.type, 'json_schema');
  assert.equal(requestBody.text.format.strict, true);
  assert.deepEqual(requestBody.text.format.schema, generationContentJsonSchema);
});

test('OpenAIProvider 拒绝不符合 Schema 的 AI 内容', async () => {
  const fakeFetch: FetchImplementation = async () =>
    toOpenAIResponse({ topicSummary: '不完整', angles: [] });
  const provider = new OpenAIProvider({
    apiKey: ['server', 'test', 'credential'].join('-'),
    model: 'test-model',
    fetchImplementation: fakeFetch,
  });

  await assert.rejects(
    () => provider.generate(sampleContext),
    (error) => error instanceof SchemaValidationError,
  );
});

test('OpenAIProvider 为事实核查和编辑终审分别发起结构化调用', async () => {
  const draft = createMockGenerationContent(sampleContext);
  const verification = createMockVerificationReview(sampleContext, draft);
  const editorial = createMockEditorialRevision(
    sampleContext,
    draft,
    verification,
  );
  const requestBodies: Array<{
    text: { format: { name: string; schema: unknown } };
    input: Array<{ content: string }>;
  }> = [];
  const responses = [verification, editorial];
  const provider = new OpenAIProvider({
    apiKey: 'server-search-placeholder',
    model: 'test-model',
    fetchImplementation: async (_input, init) => {
      requestBodies.push(JSON.parse(String(init?.body)));
      return toOpenAIResponse(responses[requestBodies.length - 1]);
    },
  });

  const reviewed = await provider.verify(sampleContext, draft);
  const revised = await provider.edit(sampleContext, draft, reviewed);

  assert.equal(requestBodies.length, 2);
  assert.equal(requestBodies[0]?.text.format.name, 'news_fact_check_review');
  assert.deepEqual(
    requestBodies[0]?.text.format.schema,
    verificationReviewJsonSchema,
  );
  assert.match(requestBodies[0]?.input[0]?.content ?? '', /事实核查 Agent/u);
  assert.equal(requestBodies[1]?.text.format.name, 'news_editorial_revision');
  assert.deepEqual(
    requestBodies[1]?.text.format.schema,
    editorialRevisionJsonSchema,
  );
  assert.match(requestBodies[1]?.input[0]?.content ?? '', /新闻编辑 Agent/u);
  assert.equal(revised.decision.disposition, 'needs-reporting');
});

test('服务端没有 Key 时 OpenAIProvider 明确失败且不会发出请求', async () => {
  let requested = false;
  const provider = new OpenAIProvider({
    model: 'test-model',
    fetchImplementation: async () => {
      requested = true;
      return toOpenAIResponse({});
    },
  });

  await assert.rejects(() => provider.generate(sampleContext), /OPENAI_API_KEY/);
  assert.equal(requested, false);
});

test('OpenAIProvider 对非成功响应只暴露安全错误代码', async () => {
  const provider = new OpenAIProvider({
    apiKey: ['server', 'test', 'credential'].join('-'),
    model: 'test-model',
    fetchImplementation: async () =>
      new Response(
        JSON.stringify({
          error: {
            message: '这段上游详情可能包含账户信息，不应写入应用日志。',
            type: 'insufficient_quota',
            code: 'insufficient_quota',
          },
        }),
        {
          status: 429,
          headers: {
            'Content-Type': 'application/json',
            'x-request-id': 'request-safe-diagnostic',
          },
        },
      ),
  });

  await assert.rejects(
    () => provider.generate(sampleContext),
    (error) => {
      assert.ok(error instanceof Error);
      assert.match(error.message, /HTTP 429/u);
      assert.match(error.message, /type: insufficient_quota/u);
      assert.match(error.message, /code: insufficient_quota/u);
      assert.match(error.message, /request_id: request-safe-diagnostic/u);
      assert.doesNotMatch(error.message, /账户信息/u);
      return true;
    },
  );
});
