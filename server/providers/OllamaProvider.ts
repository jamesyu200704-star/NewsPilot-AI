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
import { OllamaClient, type OllamaFetchImplementation } from '../services/ollama.js';
import {
  assertGenerationContent,
  assertGenerationResult,
} from '../validation.js';
import type { GenerationProvider } from './GenerationProvider.js';

interface OllamaProviderOptions {
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

const ollamaGenerationContentJsonSchema = withoutPatternKeywords(
  generationContentJsonSchema,
);

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

  async generate(input: BriefInput): Promise<GenerationResult> {
    let content: GenerationContent | undefined;
    let parseError: Error | undefined;

    for (let attempt = 0; attempt < 2; attempt += 1) {
      const outputText = await this.client.chat({
        model: this.model,
        format: ollamaGenerationContentJsonSchema,
        messages: [
          { role: 'system', content: NEWS_BRIEF_SYSTEM_PROMPT },
          { role: 'user', content: createNewsBriefUserPrompt(input) },
        ],
      });

      try {
        const parsed: unknown = JSON.parse(outputText);
        assertGenerationContent(parsed);
        content = parsed as GenerationContent;
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

    const result: GenerationResult = {
      ...content,
      generatedAt: new Date().toISOString(),
      mode: 'ollama',
    };

    assertGenerationResult(result);
    return result;
  }
}
