import assert from 'node:assert/strict';
import test from 'node:test';
import { createMockGenerationResult } from '../../shared/mockGeneration.js';
import {
  generateApiBriefWithFallback,
  type ClientFetchImplementation,
} from '../../src/services/apiGenerator.js';
import { sampleInput } from './fixtures.js';

const silentLogger = { warn: (..._messages: unknown[]) => undefined };
const fallback = async () => createMockGenerationResult(sampleInput);

test('前端 API 收到无效 2xx JSON 时降级到本地 Mock', async () => {
  const result = await generateApiBriefWithFallback(sampleInput, {
    endpoint: '/api/generate',
    timeoutMs: 100,
    fallback,
    logger: silentLogger,
    fetchImplementation: async () =>
      new Response(JSON.stringify({}), {
        status: 200,
        headers: { 'Content-Type': 'application/json' },
      }),
  });

  assert.equal(result.mode, 'mock');
  assert.equal(result.angles.length, 3);
});

test('前端 API 超时后中止请求并降级到本地 Mock', async () => {
  let aborted = false;
  const hangingFetch: ClientFetchImplementation = async (_input, init) =>
    new Promise<Response>((_resolve, reject) => {
      init?.signal?.addEventListener(
        'abort',
        () => {
          aborted = true;
          reject(new Error('aborted'));
        },
        { once: true },
      );
    });

  const result = await generateApiBriefWithFallback(sampleInput, {
    endpoint: '/api/generate',
    timeoutMs: 10,
    fallback,
    logger: silentLogger,
    fetchImplementation: hangingFetch,
  });

  assert.equal(aborted, true);
  assert.equal(result.mode, 'mock');
});
