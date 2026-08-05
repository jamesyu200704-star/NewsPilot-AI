import assert from 'node:assert/strict';
import test from 'node:test';
import { createMockGenerationContent } from '../../shared/mockGeneration.js';
import type {
  GenerationContent,
  PlanningContext,
  SearchResult,
} from '../../shared/generation.js';
import type { GenerationProvider } from '../providers/GenerationProvider.js';
import type { SearchProvider } from '../search/SearchProvider.js';
import { GeneratorService } from '../services/generator.js';
import { RetrievalService } from '../services/检索服务.js';
import { sampleInput } from './fixtures.js';

class RecordingProvider implements GenerationProvider {
  readonly name = 'mock' as const;
  context: PlanningContext | undefined;

  generate(context: PlanningContext): Promise<GenerationContent> {
    this.context = context;
    return Promise.resolve(createMockGenerationContent(context));
  }
}

class EvidenceSearchProvider implements SearchProvider {
  readonly name = 'brave' as const;

  search(): Promise<SearchResult[]> {
    return Promise.resolve([
      {
        id: 'public-source',
        title: '高校人工智能政策原文',
        url: 'https://example.edu/policy',
        snippet: '公开政策原文摘要。',
        sourceName: '高校官网',
        sourceType: 'policy',
      },
    ]);
  }
}

test('生成工作流先检索再把证据交给 Provider 和最终报告', async () => {
  const provider = new RecordingProvider();
  const retrievalService = new RetrievalService(new EvidenceSearchProvider());
  const service = new GeneratorService(
    provider,
    provider,
    { warn: () => undefined },
    retrievalService,
  );

  const result = await service.generate(sampleInput);

  assert.equal(provider.context?.retrievalContext.searchStatus, 'live');
  assert.ok(
    provider.context?.retrievalContext.evidence.some(
      (item) => item.sourceUrl === 'https://example.edu/policy',
    ),
  );
  assert.equal(result.retrievalContext.searchStatus, 'live');
  assert.ok(result.retrievalContext.evidence.some((item) => item.origin === 'knowledge'));
  assert.ok(result.retrievalContext.evidence.some((item) => item.origin === 'search'));
});
