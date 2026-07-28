import type { BriefInput, GenerationResult } from '../types/index.js';

export type ClientGenerationMode = 'mock' | 'local-ai';

interface GenerationStrategies {
  mock: (input: BriefInput) => Promise<GenerationResult>;
  localAi: (input: BriefInput) => Promise<GenerationResult>;
}

export const generateBriefForMode = (
  input: BriefInput,
  mode: ClientGenerationMode,
  strategies: GenerationStrategies,
) => (mode === 'local-ai' ? strategies.localAi(input) : strategies.mock(input));
