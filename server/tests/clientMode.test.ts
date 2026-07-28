import assert from 'node:assert/strict';
import test from 'node:test';
import { createMockGenerationResult } from '../../shared/mockGeneration.js';
import { generateBriefForMode } from '../../src/services/generationMode.js';
import { sampleInput } from './fixtures.js';

test('Demo 模式只调用浏览器 Mock', async () => {
  const calls: string[] = [];
  const result = await generateBriefForMode(sampleInput, 'mock', {
    mock: async (input) => {
      calls.push('mock');
      return createMockGenerationResult(input);
    },
    localAi: async (input) => {
      calls.push('local-ai');
      return {
        ...createMockGenerationResult(input),
        mode: 'ollama',
      };
    },
  });

  assert.deepEqual(calls, ['mock']);
  assert.equal(result.mode, 'mock');
});

test('本地 AI 模式只调用后端 API 策略', async () => {
  const calls: string[] = [];
  const result = await generateBriefForMode(sampleInput, 'local-ai', {
    mock: async (input) => {
      calls.push('mock');
      return createMockGenerationResult(input);
    },
    localAi: async (input) => {
      calls.push('local-ai');
      return {
        ...createMockGenerationResult(input),
        mode: 'ollama',
      };
    },
  });

  assert.deepEqual(calls, ['local-ai']);
  assert.equal(result.mode, 'ollama');
});
