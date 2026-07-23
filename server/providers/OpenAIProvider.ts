import {
  generationContentJsonSchema,
  type BriefInput,
  type GenerationContent,
  type GenerationResult,
} from '../../shared/generation.js';
import {
  assertGenerationContent,
  assertGenerationResult,
} from '../validation.js';
import type { GenerationProvider } from './GenerationProvider.js';

const OPENAI_RESPONSES_ENDPOINT = 'https://api.openai.com/v1/responses';

const SYSTEM_PROMPT = `你是 NewsPilot 的新闻选题与采访策划助手。
只生成前期策划建议，不得声称已经完成采访、调查或事实核验，不得虚构真实人物、引语、机构结论或精确统计。
请严格输出三个角度，并依次使用 id：people、system、trend。
每个角度必须包含：3 条新闻价值、4 类采访对象、6 个采访问题、4 条事实核查清单、3 条风险提醒、3 条下一步行动。
所有内容使用简体中文，具体、可执行，并明确待核验边界。`;

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
            { role: 'system', content: SYSTEM_PROMPT },
            {
              role: 'user',
              content: '请根据以下用户输入生成新闻策划方案：\n' + JSON.stringify(input),
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
