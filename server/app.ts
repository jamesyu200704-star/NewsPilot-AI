import express, {
  type ErrorRequestHandler,
  type RequestHandler,
} from 'express';
import { createServer } from 'node:http';
import {
  createGenerateRouter,
  type GenerateRouteOptions,
} from './routes/generate.js';
import type { GeneratorService } from './services/generator.js';

const JSON_BODY_LIMIT = 32 * 1024;

export type ApiServerOptions = GenerateRouteOptions;

interface RequestBodyError extends Error {
  status?: number;
  type?: string;
}

const securityHeaders: RequestHandler = (_request, response, next) => {
  response.set({
    'Cache-Control': 'no-store',
    'X-Content-Type-Options': 'nosniff',
  });
  next();
};

const handleRequestError: ErrorRequestHandler = (
  error: RequestBodyError,
  _request,
  response,
  _next,
) => {
  if (error.type === 'entity.too.large') {
    response.status(413).json({ error: '请求内容过大。' });
    return;
  }

  if (error instanceof SyntaxError && error.status === 400) {
    response.status(400).json({ error: '请求参数不符合要求。' });
    return;
  }

  console.error('[NewsPilot] API 请求处理失败。', error);
  response.status(500).json({ error: '生成服务暂时不可用。' });
};

export const createApiServer = (
  generatorService: GeneratorService,
  options: ApiServerOptions = {},
) => {
  const app = express();
  app.disable('x-powered-by');
  app.use(securityHeaders);
  app.use(
    express.json({
      limit: JSON_BODY_LIMIT,
      strict: true,
      type: ['application/json', 'application/*+json'],
    }),
  );

  app.get('/api/health', (_request, response) => {
    response.status(200).json({
      ok: true,
      provider: generatorService.providerName,
      fallbackProvider: generatorService.fallbackProviderName,
      searchProvider: generatorService.retrievalProviderName,
    });
  });
  app.use('/api/generate', createGenerateRouter(generatorService, options));
  app.use((_request, response) => {
    response.status(404).json({ error: 'Not Found' });
  });
  app.use(handleRequestError);

  return createServer(app);
};
