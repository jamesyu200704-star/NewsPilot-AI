import { generateMockBrief } from '../../shared/mockGeneration.js';
import type { BriefInput, GenerationResult } from '../types';
import { generateApiBriefWithFallback } from './apiGenerator';

const API_ENDPOINT = '/api/generate';
const DEFAULT_API_TIMEOUT_MS = 35_000;

const configuredTimeout = Number(import.meta.env.VITE_API_TIMEOUT_MS);
const apiTimeoutMs =
  Number.isInteger(configuredTimeout) && configuredTimeout > 0
    ? configuredTimeout
    : DEFAULT_API_TIMEOUT_MS;

export type ClientGenerationMode = 'mock' | 'api';

export const clientGenerationMode: ClientGenerationMode =
  (import.meta.env.VITE_GENERATION_MODE || 'mock').toLowerCase() === 'api'
    ? 'api'
    : 'mock';

export { generateMockBrief };

export async function generateBrief(input: BriefInput): Promise<GenerationResult> {
  if (clientGenerationMode !== 'api') {
    return generateMockBrief(input);
  }

  return generateApiBriefWithFallback(input, {
    endpoint: API_ENDPOINT,
    timeoutMs: apiTimeoutMs,
    fallback: generateMockBrief,
  });
}
