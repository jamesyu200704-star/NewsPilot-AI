import {
  editorialRevisionJsonSchema,
  generationContentJsonSchema,
  verificationReviewJsonSchema,
  type EditorialRevision,
  type GenerationContent,
  type PlanningContext,
  type VerificationReview,
} from '../../shared/generation.js';
import { buildFactCheckPrompt } from '../../prompts/事实核查提示词.js';
import { buildNewsEditorPrompt } from '../../prompts/新闻编辑提示词.js';
import { buildFinalEditorPrompt } from '../../prompts/新闻编辑终审提示词.js';
import {
  assertEditorialRevision,
  assertGenerationContent,
  assertVerificationReview,
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

const safeDiagnosticTokenPattern = /^[A-Za-z0-9._-]{1,80}$/u;

const asSafeDiagnosticToken = (value: unknown) =>
  typeof value === 'string' && safeDiagnosticTokenPattern.test(value)
    ? value
    : undefined;

const extractSafeErrorDiagnostics = async (response: Response) => {
  try {
    const payload: unknown = await response.json();
    if (!isRecord(payload) || !isRecord(payload.error)) {
      return [];
    }

    const type = asSafeDiagnosticToken(payload.error.type);
    const code = asSafeDiagnosticToken(payload.error.code);

    return [type ? 'type: ' + type : '', code ? 'code: ' + code : ''].filter(
      Boolean,
    );
  } catch {
    return [];
  }
};

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

  private async requestStructured<T>(
    prompt: { system: string; user: string },
    schemaName: string,
    schema: unknown,
    assertValue: (value: unknown) => asserts value is T,
  ): Promise<T> {
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
            { role: 'system', content: prompt.system },
            {
              role: 'user',
              content: prompt.user,
            },
          ],
          text: {
            format: {
              type: 'json_schema',
              name: schemaName,
              schema,
              strict: true,
            },
          },
          max_output_tokens: 12_000,
        }),
        signal: controller.signal,
      });

      if (!response.ok) {
        const requestId = asSafeDiagnosticToken(
          response.headers.get('x-request-id'),
        );
        const diagnostics = await extractSafeErrorDiagnostics(response);
        throw new Error(
          'OpenAI 请求失败（' +
            [
              'HTTP ' + response.status,
              ...diagnostics,
              ...(requestId ? ['request_id: ' + requestId] : []),
            ].join('，') +
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

      assertValue(content);
      return content;
    } finally {
      globalThis.clearTimeout(timeout);
    }
  }

  generate(context: PlanningContext): Promise<GenerationContent> {
    return this.requestStructured(
      buildNewsEditorPrompt(context),
      'news_generation_content',
      generationContentJsonSchema,
      assertGenerationContent,
    );
  }

  verify(
    context: PlanningContext,
    draft: GenerationContent,
  ): Promise<VerificationReview> {
    return this.requestStructured(
      buildFactCheckPrompt(context, draft),
      'news_fact_check_review',
      verificationReviewJsonSchema,
      assertVerificationReview,
    );
  }

  edit(
    context: PlanningContext,
    draft: GenerationContent,
    verification: VerificationReview,
  ): Promise<EditorialRevision> {
    return this.requestStructured(
      buildFinalEditorPrompt(context, draft, verification),
      'news_editorial_revision',
      editorialRevisionJsonSchema,
      assertEditorialRevision,
    );
  }
}
