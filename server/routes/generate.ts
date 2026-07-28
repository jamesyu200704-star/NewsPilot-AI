import { Router } from 'express';
import type { GeneratorService } from '../services/generator.js';
import { assertBriefInput, SchemaValidationError } from '../validation.js';

const DEFAULT_MAX_CONCURRENT_GENERATIONS = 2;
const DEFAULT_MAX_REQUESTS_PER_WINDOW = 6;
const DEFAULT_RATE_LIMIT_WINDOW_MS = 60_000;

interface RateLimitEntry {
  requestCount: number;
  windowStartedAt: number;
}

export interface GenerateRouteOptions {
  maxConcurrentGenerations?: number;
  maxRequestsPerWindow?: number;
  rateLimitWindowMs?: number;
  now?: () => number;
}

const positiveIntegerOr = (value: number | undefined, fallback: number) =>
  value !== undefined && Number.isInteger(value) && value > 0 ? value : fallback;

const isJsonContentType = (contentType: string | undefined) => {
  const mediaType = contentType?.split(';', 1)[0]?.trim().toLowerCase();
  return (
    mediaType === 'application/json' ||
    /^application\/[a-z0-9!#$&^_.+-]+\+json$/u.test(mediaType ?? '')
  );
};

export const createGenerateRouter = (
  generatorService: GeneratorService,
  options: GenerateRouteOptions = {},
) => {
  const router = Router();
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
      rateLimits.set(clientId, {
        requestCount: 1,
        windowStartedAt: currentTime,
      });
      return 0;
    }

    if (entry.requestCount >= maxRequestsPerWindow) {
      return Math.max(
        1,
        Math.ceil(
          (entry.windowStartedAt + rateLimitWindowMs - currentTime) / 1_000,
        ),
      );
    }

    entry.requestCount += 1;
    return 0;
  };

  router.post('/', async (request, response) => {
    if (!isJsonContentType(request.headers['content-type'])) {
      response.status(415).json({ error: '请求必须使用 application/json。' });
      return;
    }

    const retryAfter = consumeRateLimit(
      request.ip || request.socket.remoteAddress || 'unknown',
    );

    if (retryAfter > 0) {
      response
        .set('Retry-After', String(retryAfter))
        .status(429)
        .json({ error: '请求过于频繁，请稍后重试。' });
      return;
    }

    try {
      assertBriefInput(request.body);

      if (activeGenerations >= maxConcurrentGenerations) {
        response
          .set('Retry-After', '1')
          .status(429)
          .json({ error: '生成任务繁忙，请稍后重试。' });
        return;
      }

      activeGenerations += 1;

      try {
        response.status(200).json(await generatorService.generate(request.body));
      } finally {
        activeGenerations -= 1;
      }
    } catch (error) {
      if (error instanceof SchemaValidationError) {
        response.status(400).json({ error: '请求参数不符合要求。' });
        return;
      }

      console.error('[NewsPilot] 生成接口失败。', error);
      response.status(500).json({ error: '生成服务暂时不可用。' });
    }
  });

  return router;
};
