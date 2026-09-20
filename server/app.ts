import express, {
  type Express,
  type ErrorRequestHandler,
  type RequestHandler,
} from 'express';
import { createServer } from 'node:http';
import {
  createGenerateRouter,
  type GenerateRouteOptions,
} from './routes/generate.js';
import type { GeneratorService } from './services/generator.js';
import { EditorialService } from './services/editor.js';
import { createEditorRouter } from './routes/editor.js';
import {
  createEvidenceRouter,
  type EvidenceRouteOptions,
} from './routes/evidence.js';
import {
  createTranscriptionRouter,
  type TranscriptionRouteOptions,
} from './routes/transcription.js';

// 共享 Schema 允许 30,000 个字符；中文 UTF-8 最多约占 90KB，再预留 JSON 字段开销。
const JSON_BODY_LIMIT = 128 * 1024;

export type ApiServerOptions = GenerateRouteOptions & EvidenceRouteOptions & TranscriptionRouteOptions;

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

  // Do not log the Error object: parser/provider errors may retain request or upstream data.
  console.error('[NewsPilot] API 请求处理失败。', { errorName: error.name });
  response.status(500).json({ error: '生成服务暂时不可用。' });
};

export const createApiApp = (
  generatorService: GeneratorService,
  options: ApiServerOptions = {},
): Express => {
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
      searchProvider: options.evidenceSearchService?.providerName || generatorService.retrievalProviderName,
      transcriptionProvider: options.transcriptionProvider?.name || 'manual',
    });
  });
  app.use('/api/generate', createGenerateRouter(generatorService, options));
  app.use(
    '/api/editor',
    createEditorRouter(
      new EditorialService(
        generatorService.editorialPrimaryProvider,
        undefined,
        console,
        options.evidenceSearchService,
      ),
      options,
    ),
  );
  app.use('/api/evidence', createEvidenceRouter(options));
  app.use('/api/transcription', createTranscriptionRouter(options));
  app.use((_request, response) => {
    response.status(404).json({ error: 'Not Found' });
  });
  app.use(handleRequestError);

  return app;
};

export const createApiServer = (
  generatorService: GeneratorService,
  options: ApiServerOptions = {},
) => createServer(createApiApp(generatorService, options));
