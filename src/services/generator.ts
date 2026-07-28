import { generateMockBrief } from '../../shared/mockGeneration.js';
import type { BriefInput, GenerationResult } from '../types';
import { generateApiBriefWithFallback } from './apiGenerator';
import {
  generateBriefForMode,
  type ClientGenerationMode,
} from './generationMode';

const API_ENDPOINT = '/api/generate';
const DEFAULT_API_TIMEOUT_MS = 120_000;

const configuredTimeout = Number(import.meta.env.VITE_API_TIMEOUT_MS);
const apiTimeoutMs =
  Number.isInteger(configuredTimeout) && configuredTimeout > 0
    ? configuredTimeout
    : DEFAULT_API_TIMEOUT_MS;

export type { ClientGenerationMode } from './generationMode';

export const clientGenerationMode: ClientGenerationMode =
  ['api', 'ollama', 'local-ai'].includes(
    (import.meta.env.VITE_GENERATION_MODE || 'mock').toLowerCase(),
  )
    ? 'local-ai'
    : 'mock';

export { generateMockBrief };

export function generateBrief(
  input: BriefInput,
  mode: ClientGenerationMode = clientGenerationMode,
): Promise<GenerationResult> {
  return generateBriefForMode(input, mode, {
    mock: generateMockBrief,
    localAi: (localAiInput) =>
      generateApiBriefWithFallback(localAiInput, {
        endpoint: API_ENDPOINT,
        timeoutMs: apiTimeoutMs,
        fallback: generateMockBrief,
      }),
  });
}
