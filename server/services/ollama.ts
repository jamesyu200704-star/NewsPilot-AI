export type OllamaFetchImplementation = (
  input: string | URL | Request,
  init?: RequestInit,
) => Promise<Response>;

export class OllamaConnectionError extends Error {
  constructor() {
    super('请启动 Ollama 服务。');
    this.name = 'OllamaConnectionError';
  }
}

export class OllamaModelNotFoundError extends Error {
  constructor() {
    super('请下载对应模型。');
    this.name = 'OllamaModelNotFoundError';
  }
}

export class OllamaResponseError extends Error {
  constructor(message = '本地 AI 响应失败。') {
    super(message);
    this.name = 'OllamaResponseError';
  }
}

interface OllamaChatOptions {
  baseUrl: string;
  timeoutMs: number;
  fetchImplementation?: OllamaFetchImplementation;
}

interface OllamaChatRequest {
  model: string;
  messages: Array<{ role: 'system' | 'user'; content: string }>;
  format: unknown;
}

type JsonRecord = Record<string, unknown>;

const isRecord = (value: unknown): value is JsonRecord =>
  typeof value === 'object' && value !== null && !Array.isArray(value);

export const getOllamaUserMessage = (error: unknown) => {
  if (
    error instanceof OllamaConnectionError ||
    error instanceof OllamaModelNotFoundError
  ) {
    return error.message;
  }

  return '本地 AI 响应失败。';
};

export class OllamaClient {
  private readonly baseUrl: string;
  private readonly timeoutMs: number;
  private readonly fetchImplementation: OllamaFetchImplementation;

  constructor(options: OllamaChatOptions) {
    this.baseUrl = options.baseUrl.replace(/\/+$/u, '');
    this.timeoutMs = options.timeoutMs;
    this.fetchImplementation = options.fetchImplementation ?? globalThis.fetch;
  }

  async chat(request: OllamaChatRequest): Promise<string> {
    const controller = new AbortController();
    const timeout = globalThis.setTimeout(
      () => controller.abort(),
      this.timeoutMs,
    );
    let response: Response;

    try {
      response = await this.fetchImplementation(this.baseUrl + '/api/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          ...request,
          stream: false,
          think: false,
          options: { temperature: 0 },
        }),
        signal: controller.signal,
      });
    } catch (error) {
      if (
        error instanceof TypeError ||
        (error instanceof DOMException && error.name === 'AbortError')
      ) {
        throw new OllamaConnectionError();
      }

      throw error;
    } finally {
      globalThis.clearTimeout(timeout);
    }

    if (response.status === 404) {
      throw new OllamaModelNotFoundError();
    }

    if (!response.ok) {
      throw new OllamaResponseError(
        'Ollama 请求失败（HTTP ' + response.status + '）。',
      );
    }

    let payload: unknown;

    try {
      payload = await response.json();
    } catch {
      throw new OllamaResponseError('Ollama 返回了无法识别的响应。');
    }

    if (
      !isRecord(payload) ||
      !isRecord(payload.message) ||
      typeof payload.message.content !== 'string' ||
      !payload.message.content.trim()
    ) {
      throw new OllamaResponseError('Ollama 响应中没有可用的结构化文本。');
    }

    return payload.message.content;
  }
}
