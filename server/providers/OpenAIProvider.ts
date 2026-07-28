import {
  generationContentJsonSchema,
  type BriefInput,
  type GenerationContent,
  type GenerationResult,
} from '../../shared/generation.js';
import {
  createNewsBriefUserPrompt,
  NEWS_BRIEF_SYSTEM_PROMPT,
} from '../../prompts/newsBrief.js';
import {
  assertGenerationContent,
  assertGenerationResult,
} from '../validation.js';
import type { GenerationProvider } from './GenerationProvider.js';

const OPENAI_RESPONSES_ENDPOINT = 'https://api.openai.com/v1/responses';

export type FetchImplementation = (
  input: string | URL | Request,
  init?: RequestInit,
) => Promise<Response>;

interface OpenAIProviderOptions {
  apiKey?: string;
  model: string;
  timeoutMs?: number;
  fetchImplementation?: FetchImplementation;
}

type JsonRecord = Record<string, unknown>;

const isRecord = (value: unknown): value is JsonRecord =>
  typeof value === 'object' && value !== null;

const extractOutputText = (payload: unknown) => {
  if (!isRecord(payload)) {
    throw new Error('OpenAI 返回了无法识别的响应。');
  }

  if (typeof payload.output_text === 'string' && payload.output_text) {
    return payload.output_text;
  }

  if (!Array.isArray(payload.output)) {
    throw new Error('OpenAI 响应中缺少 output。');
  }

  for (const outputItem of payload.output) {
    if (!isRecord(outputItem) || !Array.isArray(outputItem.content)) {
      continue;
    }

    for (const contentItem of outputItem.content) {
      if (!isRecord(contentItem)) {
        continue;
      }

      if (contentItem.type === 'refusal') {
        throw new Error('OpenAI 拒绝了本次生成请求。');
      }

      if (contentItem.type === 'output_text' && typeof contentItem.text === 'string') {
        return contentItem.text;
      }
    }
  }

  throw new Error('OpenAI 响应中没有可用的结构化文本。');
};

export class OpenAIProvider implements GenerationProvider {
  readonly name = 'openai' as const;
  private readonly apiKey: string;
  private readonly model: string;
  private readonly timeoutMs: number;
  private readonly fetchImplementation: FetchImplementation;

  constructor(options: OpenAIProviderOptions) {
    this.apiKey = options.apiKey?.trim() ?? '';
    this.model = options.model;
    this.timeoutMs = options.timeoutMs ?? 30_000;
    this.fetchImplementation = options.fetchImplementation ?? globalThis.fetch;
  }

  async generate(input: BriefInput): Promise<GenerationResult> {
    if (!this.apiKey) {
      throw new Error('服务端未配置 OPENAI_API_KEY。');
    }

    const controller = new AbortController();
    const timeout = globalThis.setTimeout(() => controller.abort(), this.timeoutMs);

    try {
      const response = await this.fetchImplementation(OPENAI_RESPONSES_ENDPOINT, {
        method: 'POST',
        headers: {
          Authorization: 'Bearer ' + this.apiKey,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          model: this.model,
          store: false,
          input: [
            { role: 'system', content: NEWS_BRIEF_SYSTEM_PROMPT },
            {
              role: 'user',
              content: createNewsBriefUserPrompt(input),
            },
          ],
          text: {
            format: {
              type: 'json_schema',
              name: 'news_generation_result',
              schema: generationContentJsonSchema,
              strict: true,
            },
          },
          max_output_tokens: 12_000,
        }),
        signal: controller.signal,
      });

      if (!response.ok) {
        const requestId = response.headers.get('x-request-id');
        throw new Error(
          'OpenAI 请求失败（HTTP ' +
            response.status +
            (requestId ? '，request_id: ' + requestId : '') +
            '）。',
        );
      }

      const payload: unknown = await response.json();
      const outputText = extractOutputText(payload);
      let content: unknown;

      try {
        content = JSON.parse(outputText);
      } catch {
        throw new Error('OpenAI 返回内容不是有效 JSON。');
      }

      assertGenerationContent(content);

      const result: GenerationResult = {
        ...(content as GenerationContent),
        generatedAt: new Date().toISOString(),
        mode: 'openai',
      };

      assertGenerationResult(result);
      return result;
    } finally {
      globalThis.clearTimeout(timeout);
    }
  }
}
