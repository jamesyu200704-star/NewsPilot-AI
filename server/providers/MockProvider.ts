import { generateMockContent } from '../../shared/mockGeneration.js';
import {
  createMockEditorialRevision,
  createMockVerificationReview,
} from '../../shared/mockAgents.js';
import type {
  EditorialRevision,
  GenerationContent,
  PlanningContext,
  VerificationReview,
} from '../../shared/generation.js';
import type { GenerationProvider } from './GenerationProvider.js';

export class MockProvider implements GenerationProvider {
  readonly name = 'mock' as const;

  constructor(private readonly delayMs = 0) {}

  generate(context: PlanningContext): Promise<GenerationContent> {
    return generateMockContent(context, this.delayMs);
  }

  verify(
    context: PlanningContext,
    draft: GenerationContent,
  ): Promise<VerificationReview> {
    return Promise.resolve(createMockVerificationReview(context, draft));
  }

  edit(
    context: PlanningContext,
    draft: GenerationContent,
    verification: VerificationReview,
  ): Promise<EditorialRevision> {
    return Promise.resolve(
      createMockEditorialRevision(context, draft, verification),
    );
  }
}
