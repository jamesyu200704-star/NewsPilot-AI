import type { BriefInput, GenerationResult } from '../types/index.js';
import { assertRuntimeGenerationResult } from '../../shared/runtimeGenerationValidation.js';

export type ClientFetchImplementation = (
  input: string | URL | Request,
  init?: RequestInit,
) => Promise<Response>;

interface ApiGenerationOptions {
  endpoint: string;
  timeoutMs: number;
  fallback: (input: BriefInput) => Promise<GenerationResult>;
  fetchImplementation?: ClientFetchImplementation;
  logger?: Pick<Console, 'warn'>;
}

const requestApiGeneration = async (
  input: BriefInput,
  options: ApiGenerationOptions,
): Promise<GenerationResult> => {
  const controller = new AbortController();
  const timeout = globalThis.setTimeout(() => controller.abort(), options.timeoutMs);

  try {
    const response = await (options.fetchImplementation ?? globalThis.fetch)(
      options.endpoint,
      {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(input),
        signal: controller.signal,
      },
    );

    if (!response.ok) {
      throw new Error('生成服务暂时不可用。');
    }

    const result: unknown = await response.json();
    assertRuntimeGenerationResult(result);
    return result;
  } finally {
    globalThis.clearTimeout(timeout);
  }
};

export async function generateApiBriefWithFallback(
  input: BriefInput,
  options: ApiGenerationOptions,
): Promise<GenerationResult> {
  try {
    return await requestApiGeneration(input, options);
  } catch (error) {
    (options.logger ?? console).warn(
      '[NewsPilot] API 生成失败，已降级为浏览器本地 Mock。',
      error,
    );
    return options.fallback(input);
  }
}
