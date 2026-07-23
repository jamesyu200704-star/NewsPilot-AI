import type {
  BriefInput,
  GenerationMode,
  GenerationResult,
} from '../../shared/generation.js';

export interface GenerationProvider {
  readonly name: GenerationMode;
  generate(input: BriefInput): Promise<GenerationResult>;
}
