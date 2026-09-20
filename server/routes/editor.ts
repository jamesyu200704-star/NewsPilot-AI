import { Router } from 'express';
import type { EditorialService } from '../services/editor.js';
import { assertEditorialTaskRequest, SchemaValidationError } from '../validation.js';

export interface EditorRouteOptions {
  maxConcurrentGenerations?: number;
  maxRequestsPerWindow?: number;
  rateLimitWindowMs?: number;
}

export const createEditorRouter = (
  editorService: EditorialService,
  options: EditorRouteOptions = {},
) => {
  const router = Router();
  const maximum = options.maxConcurrentGenerations ?? 2;
  let active = 0;

  router.post('/', async (request, response) => {
    const contentType = request.headers['content-type']?.toLowerCase() ?? '';
    if (!contentType.startsWith('application/json')) {
      response.status(415).json({ error: '请求必须使用 application/json。' });
      return;
    }

    try {
      assertEditorialTaskRequest(request.body);
    } catch (error) {
      if (error instanceof SchemaValidationError) {
        console.warn('[NewsPilot] 编辑任务请求校验失败：' + error.issues.join('；'));
        response.status(400).json({ error: '请求参数不符合要求。' });
        return;
      }
      throw error;
    }

    try {
      if (active >= maximum) {
        response.status(429).json({ error: '编辑任务繁忙，请稍后重试。' });
        return;
      }
      active += 1;
      try {
        response.status(200).json(await editorService.run(request.body));
      } finally {
        active -= 1;
      }
    } catch (error) {
      console.error('[NewsPilot] 编辑接口失败。', error);
      response.status(500).json({ error: '编辑服务暂时不可用。' });
    }
  });

  return router;
};
