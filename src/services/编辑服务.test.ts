// @vitest-environment jsdom
import { afterEach, describe, expect, it, vi } from 'vitest';
import { EditorialServiceError, runEditorialTask } from './编辑服务';

const input = { taskType: 'interview' as const, sourceText: '校园夜间班车' };

afterEach(() => {
  vi.useRealTimers();
  vi.restoreAllMocks();
});

const captureError = async (promise: Promise<unknown>) => {
  try {
    await promise;
    throw new Error('预期请求失败');
  } catch (error) {
    return error as EditorialServiceError;
  }
};

describe('runEditorialTask', () => {
  it('网络无法连接时给出本地服务提示', async () => {
    globalThis.fetch = vi.fn().mockRejectedValue(new TypeError('fetch failed')) as typeof fetch;
    const error = await captureError(runEditorialTask(input));
    expect(error.code).toBe('offline');
    expect(error.message).toContain('无法连接本地生成服务');
  });

  it('请求繁忙时给出稍后重试提示', async () => {
    globalThis.fetch = vi.fn().mockResolvedValue(new Response('{}', { status: 429 })) as typeof fetch;
    const error = await captureError(runEditorialTask(input));
    expect(error.code).toBe('busy');
    expect(error.message).toContain('请求较多');
  });

  it('输入不合法时保留服务端的可操作说明', async () => {
    globalThis.fetch = vi.fn().mockResolvedValue(new Response(JSON.stringify({ error: '请补充采访主题。' }), {
      status: 400,
      headers: { 'Content-Type': 'application/json' },
    })) as typeof fetch;
    const error = await captureError(runEditorialTask(input));
    expect(error.code).toBe('invalid');
    expect(error.message).toBe('请补充采访主题。');
  });

  it('服务端失败时不把技术错误直接展示给用户', async () => {
    globalThis.fetch = vi.fn().mockResolvedValue(new Response(JSON.stringify({ error: 'Ollama ECONNREFUSED stack trace' }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' },
    })) as typeof fetch;
    const error = await captureError(runEditorialTask(input));
    expect(error.code).toBe('failed');
    expect(error.message).not.toMatch(/Ollama|ECONNREFUSED|stack/iu);
  });

  it('用户取消时明确说明输入仍然保留', async () => {
    globalThis.fetch = vi.fn((_url, init) => new Promise<Response>((_resolve, reject) => {
      init?.signal?.addEventListener('abort', () => reject(new DOMException('Aborted', 'AbortError')));
    })) as typeof fetch;
    const controller = new AbortController();
    const pending = runEditorialTask(input, controller.signal);
    controller.abort();
    const error = await captureError(pending);
    expect(error.code).toBe('cancelled');
    expect(error.message).toContain('输入内容已保留');
  });

  it('超过九十秒时给出超时提示而不是取消提示', async () => {
    vi.useFakeTimers();
    globalThis.fetch = vi.fn((_url, init) => new Promise<Response>((_resolve, reject) => {
      init?.signal?.addEventListener('abort', () => reject(new DOMException('Aborted', 'AbortError')));
    })) as typeof fetch;
    const errorPromise = captureError(runEditorialTask(input));
    await vi.advanceTimersByTimeAsync(90_000);
    const error = await errorPromise;
    expect(error.code).toBe('timeout');
    expect(error.message).toContain('超过 90 秒');
  });
});
