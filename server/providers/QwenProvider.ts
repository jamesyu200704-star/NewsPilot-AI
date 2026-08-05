import type {
  EditorialRevision,
  GenerationContent,
  PlanningContext,
  VerificationReview,
} from '../../shared/generation.js';
import type { GenerationProvider } from './GenerationProvider.js';
import {
  OllamaProvider,
  type OllamaProviderOptions,
} from './OllamaProvider.js';

export class QwenProvider implements GenerationProvider {
  readonly name = 'qwen' as const;
  private readonly delegate: OllamaProvider;

  constructor(options: OllamaProviderOptions) {
    this.delegate = new OllamaProvider(options);
  }

  generate(context: PlanningContext): Promise<GenerationContent> {
    return this.delegate.generate(context);
  }

  verify(
    context: PlanningContext,
    draft: GenerationContent,
  ): Promise<VerificationReview> {
    return this.delegate.verify(context, draft);
  }

  edit(
    context: PlanningContext,
    draft: GenerationContent,
    verification: VerificationReview,
  ): Promise<EditorialRevision> {
    return this.delegate.edit(context, draft, verification);
  }
}
