import assert from 'node:assert/strict';
import test from 'node:test';
import {
  createMockEditorialRevision,
  createMockVerificationReview,
} from '../../shared/mockAgents.js';
import { createMockGenerationContent } from '../../shared/mockGeneration.js';
import { buildPlanningContext } from '../../shared/新闻方法论.js';
import { QwenProvider } from '../providers/QwenProvider.js';
import { sampleInput } from './fixtures.js';

const toOllamaResponse = (content: unknown) =>
  Response.json({
    model: 'qwen3:8b',
    message: { role: 'assistant', content: JSON.stringify(content) },
    done: true,
  });

test('QwenProvider 通过 Ollama 执行完整三 Agent 工作流', async () => {
  const context = buildPlanningContext(sampleInput);
  const draft = createMockGenerationContent(context);
  const verification = createMockVerificationReview(context, draft);
  const editorial = createMockEditorialRevision(context, draft, verification);
  const responses = [draft, verification, editorial];
  let calls = 0;
  const provider = new QwenProvider({
    baseUrl: 'http://localhost:11434',
    model: 'qwen3:8b',
    fetchImplementation: async () => toOllamaResponse(responses[calls++]),
  });

  const generated = await provider.generate(context);
  const reviewed = await provider.verify(context, generated);
  const revised = await provider.edit(context, generated, reviewed);

  assert.equal(provider.name, 'qwen');
  assert.equal(calls, 3);
  assert.equal(revised.decision.priorityAngleId, 'system');
});
