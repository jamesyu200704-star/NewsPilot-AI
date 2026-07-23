import { createServer, type IncomingMessage, type ServerResponse } from 'node:http';
import type { GeneratorService } from './services/GeneratorService.js';
import { assertBriefInput, SchemaValidationError } from './validation.js';

const MAX_BODY_BYTES = 32 * 1024;
const DEFAULT_MAX_CONCURRENT_GENERATIONS = 2;
const DEFAULT_MAX_REQUESTS_PER_WINDOW = 6;
const DEFAULT_RATE_LIMIT_WINDOW_MS = 60_000;

class BodyTooLargeError extends Error {}

interface RateLimitEntry {
  requestCount: number;
  windowStartedAt: number;
}

export interface ApiServerOptions {
  maxConcurrentGenerations?: number;
  maxRequestsPerWindow?: number;
  rateLimitWindowMs?: number;
  now?: () => number;
}

const positiveIntegerOr = (value: number | undefined, fallback: number) =>
  value !== undefined && Number.isInteger(value) && value > 0 ? value : fallback;

const isJsonContentType = (contentType: string | string[] | undefined) => {
  if (typeof contentType !== 'string') {
    return false;
  }

  const mediaType = contentType.split(';', 1)[0]?.trim().toLowerCase();
  return (
    mediaType === 'application/json' ||
    /^application\/[a-z0-9!#$&^_.+-]+\+json$/.test(mediaType ?? '')
  );
};

const sendJson = (
  response: ServerResponse,
  statusCode: number,
  body: unknown,
  headers: Record<string, string> = {},
) => {
  response.writeHead(statusCode, {
    'Content-Type': 'application/json; charset=utf-8',
    'Cache-Control': 'no-store',
    'X-Content-Type-Options': 'nosniff',
    ...headers,
  });
  response.end(JSON.stringify(body));
};

const readJsonBody = async (request: IncomingMessage): Promise<unknown> => {
  const chunks: Buffer[] = [];
  let totalBytes = 0;

  for await (const chunk of request) {
    const buffer = Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk);
    totalBytes += buffer.byteLength;

    if (totalBytes > MAX_BODY_BYTES) {
      throw new BodyTooLargeError('请求体过大。');
    }

    chunks.push(buffer);
  }

  const body = Buffer.concat(chunks).toString('utf8');
  return JSON.parse(body);
};

export const createApiServer = (
  generatorService: GeneratorService,
  options: ApiServerOptions = {},
) => {
  const maxConcurrentGenerations = positiveIntegerOr(
    options.maxConcurrentGenerations,
    DEFAULT_MAX_CONCURRENT_GENERATIONS,
  );
  const maxRequestsPerWindow = positiveIntegerOr(
    options.maxRequestsPerWindow,
    DEFAULT_MAX_REQUESTS_PER_WINDOW,
  );
  const rateLimitWindowMs = positiveIntegerOr(
    options.rateLimitWindowMs,
    DEFAULT_RATE_LIMIT_WINDOW_MS,
  );
  const now = options.now ?? Date.now;
  const rateLimits = new Map<string, RateLimitEntry>();
  let activeGenerations = 0;

  const consumeRateLimit = (clientId: string) => {
    const currentTime = now();

    for (const [key, entry] of rateLimits) {
      if (currentTime - entry.windowStartedAt >= rateLimitWindowMs) {
        rateLimits.delete(key);
      }
    }

    const entry = rateLimits.get(clientId);

    if (!entry) {
      rateLimits.set(clientId, { requestCount: 1, windowStartedAt: currentTime });
      return 0;
    }

    if (entry.requestCount >= maxRequestsPerWindow) {
      return Math.max(
        1,
        Math.ceil((entry.windowStartedAt + rateLimitWindowMs - currentTime) / 1_000),
      );
    }

    entry.requestCount += 1;
    return 0;
  };

  return createServer(async (request, response) => {
    const url = new URL(request.url ?? '/', 'http://localhost');

    if (request.method === 'GET' && url.pathname === '/api/health') {
      sendJson(response, 200, {
        ok: true,
        provider: generatorService.providerName,
        fallbackProvider: generatorService.fallbackProviderName,
      });
      return;
    }

    if (request.method === 'POST' && url.pathname === '/api/generate') {
      if (!isJsonContentType(request.headers['content-type'])) {
        sendJson(response, 415, { error: '请求必须使用 application/json。' });
        return;
      }

      const retryAfter = consumeRateLimit(request.socket.remoteAddress ?? 'unknown');

      if (retryAfter > 0) {
        sendJson(
          response,
          429,
          { error: '请求过于频繁，请稍后重试。' },
          { 'Retry-After': String(retryAfter) },
        );
        return;
      }

      try {
        const input = await readJsonBody(request);
        assertBriefInput(input);

        if (activeGenerations >= maxConcurrentGenerations) {
          sendJson(
            response,
            429,
            { error: '生成任务繁忙，请稍后重试。' },
            { 'Retry-After': '1' },
          );
          return;
        }

        activeGenerations += 1;

        try {
          const result = await generatorService.generate(input);
          sendJson(response, 200, result);
        } finally {
          activeGenerations -= 1;
        }
      } catch (error) {
        if (error instanceof BodyTooLargeError) {
          sendJson(response, 413, { error: '请求内容过大。' });
          return;
        }

        if (error instanceof SyntaxError || error instanceof SchemaValidationError) {
          sendJson(response, 400, { error: '请求参数不符合要求。' });
          return;
        }

        console.error('[NewsPilot] 生成接口失败。', error);
        sendJson(response, 500, { error: '生成服务暂时不可用。' });
      }
      return;
    }

    sendJson(response, 404, { error: 'Not Found' });
  });
};
