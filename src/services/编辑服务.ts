import type { EditorialTaskRequest, EditorialTaskResult } from '../../shared/编辑任务模型';

export type EditorialServiceErrorCode = 'cancelled' | 'timeout' | 'busy' | 'invalid' | 'offline' | 'failed';

export class EditorialServiceError extends Error {
  constructor(public readonly code: EditorialServiceErrorCode, message: string) {
    super(message);
    this.name = 'EditorialServiceError';
  }
}

const readResponseError = async (response: Response) => {
  try {
    const body = await response.json() as { error?: unknown };
    return typeof body.error === 'string' ? body.error.trim() : '';
  } catch {
    return '';
  }
};

export const runEditorialTask = async (
  input: EditorialTaskRequest,
  requestSignal?: AbortSignal,
): Promise<EditorialTaskResult> => {
  const controller = new AbortController();
  let timedOut = false;
  const timeout = window.setTimeout(() => {
    timedOut = true;
    controller.abort();
  }, 90_000);
  const cancelRequest = () => controller.abort();
  requestSignal?.addEventListener('abort', cancelRequest, { once: true });
  try {
    const response = await fetch('/api/editor', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(input), signal: controller.signal });
    if (!response.ok) {
      const responseMessage = await readResponseError(response);
      if (response.status === 400) {
        throw new EditorialServiceError('invalid', responseMessage || '输入内容不符合要求，请检查后再试。');
      }
      if (response.status === 429) {
        throw new EditorialServiceError('busy', '当前请求较多，请稍等片刻再试。');
      }
      throw new EditorialServiceError('failed', '本地生成没有完成，输入内容已保留，请重新生成。');
    }
    return (await response.json()) as EditorialTaskResult;
  } catch (error) {
    if (error instanceof EditorialServiceError) throw error;
    if (controller.signal.aborted) {
      if (timedOut) throw new EditorialServiceError('timeout', '处理时间超过 90 秒，输入内容已保留，请重新生成。');
      throw new EditorialServiceError('cancelled', '已取消生成，输入内容已保留。');
    }
    if (error instanceof TypeError) {
      throw new EditorialServiceError('offline', '无法连接本地生成服务，请确认工作台服务已启动。');
    }
    throw new EditorialServiceError('failed', '暂时无法处理，输入内容已保留，请重新生成。');
  } finally {
    window.clearTimeout(timeout);
    requestSignal?.removeEventListener('abort', cancelRequest);
  }
};
