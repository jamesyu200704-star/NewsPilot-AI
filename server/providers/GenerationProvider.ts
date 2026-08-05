import type {
  GenerationContent,
  GenerationMode,
  EditorialRevision,
  PlanningContext,
  VerificationReview,
} from '../../shared/generation.js';

export interface GenerationProvider {
  readonly name: GenerationMode;
  generate(context: PlanningContext): Promise<GenerationContent>;
  verify?(
    context: PlanningContext,
    draft: GenerationContent,
  ): Promise<VerificationReview>;
  edit?(
    context: PlanningContext,
    draft: GenerationContent,
    verification: VerificationReview,
  ): Promise<EditorialRevision>;
}
