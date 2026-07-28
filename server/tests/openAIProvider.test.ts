import assert from 'node:assert/strict';
import test from 'node:test';
import {
  createNewsBriefUserPrompt,
  NEWS_BRIEF_SYSTEM_PROMPT,
} from '../../prompts/newsBrief.js';
import { generationContentJsonSchema } from '../../shared/generation.js';
import { createMockGenerationResult } from '../../shared/mockGeneration.js';
import {
  OpenAIProvider,
  type FetchImplementation,
} from '../providers/OpenAIProvider.js';
import { SchemaValidationError } from '../validation.js';
import { sampleInput } from './fixtures.js';

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
  const content = createMockGenerationResult(sampleInput);
  const { generatedAt: _generatedAt, mode: _mode, ...generationContent } = content;
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

  const result = await provider.generate(sampleInput);
  const headers = new Headers(capturedInit?.headers);
  const requestBody = JSON.parse(String(capturedInit?.body)) as {
    model: string;
    store: boolean;
    input: Array<{ role: string; content: string }>;
    text: { format: { type: string; strict: boolean; schema: unknown } };
  };

  assert.equal(result.mode, 'openai');
  assert.equal(result.angles.length, 3);
  assert.equal(headers.get('Authorization'), 'Bearer ' + serverCredential);
  assert.equal(requestBody.model, 'test-model');
  assert.equal(requestBody.store, false);
  assert.deepEqual(requestBody.input, [
    { role: 'system', content: NEWS_BRIEF_SYSTEM_PROMPT },
    { role: 'user', content: createNewsBriefUserPrompt(sampleInput) },
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
    () => provider.generate(sampleInput),
    (error) => error instanceof SchemaValidationError,
  );
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

  await assert.rejects(() => provider.generate(sampleInput), /OPENAI_API_KEY/);
  assert.equal(requested, false);
});
