import { generateMockBrief } from '../../shared/mockGeneration.js';
import type { BriefInput, GenerationResult } from '../../shared/generation.js';
import type { GenerationProvider } from './GenerationProvider.js';

export class MockProvider implements GenerationProvider {
  readonly name = 'mock' as const;

  constructor(private readonly delayMs = 0) {}

  generate(input: BriefInput): Promise<GenerationResult> {
    return generateMockBrief(input, this.delayMs);
  }
}
