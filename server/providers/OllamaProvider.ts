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
import { OllamaClient, type OllamaFetchImplementation } from '../services/ollama.js';
import {
  assertEditorialRevision,
  assertGenerationContent,
  assertVerificationReview,
} from '../validation.js';
import type { GenerationProvider } from './GenerationProvider.js';

export interface OllamaProviderOptions {
  baseUrl: string;
  model: string;
  timeoutMs?: number;
  fetchImplementation?: OllamaFetchImplementation;
}

const withoutPatternKeywords = (value: unknown): unknown => {
  if (Array.isArray(value)) {
    return value.map(withoutPatternKeywords);
  }

  if (typeof value !== 'object' || value === null) {
    return value;
  }

  return Object.fromEntries(
    Object.entries(value)
      .filter(([key]) => key !== 'pattern')
      .map(([key, item]) => [key, withoutPatternKeywords(item)]),
  );
};

export class OllamaProvider implements GenerationProvider {
  readonly name = 'ollama' as const;
  private readonly model: string;
  private readonly client: OllamaClient;

  constructor(options: OllamaProviderOptions) {
    this.model = options.model;
    this.client = new OllamaClient({
      baseUrl: options.baseUrl,
      timeoutMs: options.timeoutMs ?? 90_000,
      fetchImplementation: options.fetchImplementation,
    });
  }

  private async requestStructured<T>(
    prompt: { system: string; user: string },
    schema: unknown,
    assertValue: (value: unknown) => asserts value is T,
  ): Promise<T> {
    let content: T | undefined;
    let parseError: Error | undefined;
    const ollamaSchema = withoutPatternKeywords(schema);

    for (let attempt = 0; attempt < 2; attempt += 1) {
      const outputText = await this.client.chat({
        model: this.model,
        format: ollamaSchema,
        messages: [
          { role: 'system', content: prompt.system },
          { role: 'user', content: prompt.user },
        ],
      });

      try {
        const parsed: unknown = JSON.parse(outputText);
        assertValue(parsed);
        content = parsed;
        break;
      } catch (error) {
        parseError =
          error instanceof SyntaxError
            ? new Error('Ollama 返回内容不是有效 JSON。')
            : error instanceof Error
              ? error
              : new Error('Ollama 返回内容无法解析。');
      }
    }

    if (!content) {
      throw parseError ?? new Error('Ollama 返回内容不是有效 JSON。');
    }

    return content;
  }

  generate(context: PlanningContext): Promise<GenerationContent> {
    return this.requestStructured(
      buildNewsEditorPrompt(context),
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
      editorialRevisionJsonSchema,
      assertEditorialRevision,
    );
  }
}
