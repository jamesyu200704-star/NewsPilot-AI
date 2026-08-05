import assert from 'node:assert/strict';
import test from 'node:test';
import {
  createMockEditorialRevision,
  createMockVerificationReview,
} from '../../shared/mockAgents.js';
import { createMockGenerationContent } from '../../shared/mockGeneration.js';
import type {
  EditorialRevision,
  GenerationContent,
  PlanningContext,
  VerificationReview,
} from '../../shared/generation.js';
import type { GenerationProvider } from '../providers/GenerationProvider.js';
import { GeneratorService } from '../services/generator.js';
import { sampleInput } from './fixtures.js';

class TrackingAgentProvider implements GenerationProvider {
  readonly name = 'openai' as const;
  readonly calls: string[] = [];

  generate(context: PlanningContext): Promise<GenerationContent> {
    this.calls.push('planning');
    return Promise.resolve(createMockGenerationContent(context));
  }

  verify(
    context: PlanningContext,
    draft: GenerationContent,
  ): Promise<VerificationReview> {
    this.calls.push('fact-check');
    return Promise.resolve(createMockVerificationReview(context, draft));
  }

  edit(
    context: PlanningContext,
    draft: GenerationContent,
    verification: VerificationReview,
  ): Promise<EditorialRevision> {
    this.calls.push('editor');
    const revision = createMockEditorialRevision(context, draft, verification);
    return Promise.resolve({
      ...revision,
      content: {
        ...revision.content,
        topicSummary: `${revision.content.topicSummary}（经编辑终审）`,
      },
    });
  }
}

test('生成服务严格按策划、事实核查、新闻编辑顺序运行', async () => {
  const provider = new TrackingAgentProvider();
  const service = new GeneratorService(
    provider,
    provider,
    { warn: () => undefined },
  );

  const result = await service.generate(sampleInput);

  assert.deepEqual(provider.calls, ['planning', 'fact-check', 'editor']);
  assert.match(result.topicSummary, /经编辑终审/u);
  assert.equal(result.agentReview.workflowVersion, 'news-agent-v1');
  assert.ok(result.agentReview.verification.factCheck.findings.length >= 3);
  assert.ok(result.agentReview.verification.riskReview.items.length >= 2);
  assert.equal(result.agentReview.trace[0]?.agent, 'planning');
  assert.equal(result.agentReview.trace[1]?.agent, 'fact-check');
  assert.equal(result.agentReview.trace[2]?.agent, 'editor');
});
