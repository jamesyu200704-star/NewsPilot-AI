import assert from 'node:assert/strict';
import type { Server } from 'node:http';
import type { AddressInfo } from 'node:net';
import test from 'node:test';
import { createApiServer } from '../app.js';
import type { GenerationProvider } from '../providers/GenerationProvider.js';
import { MockProvider } from '../providers/MockProvider.js';
import { GeneratorService } from '../services/GeneratorService.js';
import { sampleInput } from './fixtures.js';

const listen = async (server: Server) => {
  await new Promise<void>((resolve) => server.listen(0, '127.0.0.1', resolve));
  const address = server.address() as AddressInfo;
  return 'http://127.0.0.1:' + address.port;
};

const close = (server: Server) =>
  new Promise<void>((resolve, reject) => {
    server.close((error) => (error ? reject(error) : resolve()));
  });

class CountingProvider implements GenerationProvider {
  readonly name = 'mock' as const;
  calls = 0;
  private readonly delegate = new MockProvider();

  generate(input: Parameters<GenerationProvider['generate']>[0]) {
    this.calls += 1;
    return this.delegate.generate(input);
  }
}

class BlockingProvider implements GenerationProvider {
  readonly name = 'mock' as const;
  calls = 0;
  private readonly delegate = new MockProvider();
  private resolveStarted: (() => void) | undefined;
  private resolveRelease: (() => void) | undefined;
  readonly started = new Promise<void>((resolve) => {
    this.resolveStarted = resolve;
  });
  private readonly releaseGate = new Promise<void>((resolve) => {
    this.resolveRelease = resolve;
  });

  async generate(input: Parameters<GenerationProvider['generate']>[0]) {
    this.calls += 1;
    this.resolveStarted?.();
    await this.releaseGate;
    return this.delegate.generate(input);
  }

  release() {
    this.resolveRelease?.();
  }
}

test('POST /api/generate 返回经过服务层的 GenerationResult', async () => {
  const mockProvider = new MockProvider();
  const server = createApiServer(new GeneratorService(mockProvider, mockProvider));

  const baseUrl = await listen(server);

  try {
    const response = await fetch(baseUrl + '/api/generate', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(sampleInput),
    });
    const result = (await response.json()) as {
      mode: string;
      angles: unknown[];
    };

    assert.equal(response.status, 200);
    assert.equal(result.mode, 'mock');
    assert.equal(result.angles.length, 3);

    const invalidResponse = await fetch(baseUrl + '/api/generate', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ topic: '' }),
    });
    assert.equal(invalidResponse.status, 400);

    const healthResponse = await fetch(baseUrl + '/api/health');
    const health = (await healthResponse.json()) as { provider: string };
    assert.equal(healthResponse.status, 200);
    assert.equal(health.provider, 'mock');
  } finally {
    await close(server);
  }
});

test('POST /api/generate 拒绝非 JSON Content-Type', async () => {
  const provider = new CountingProvider();
  const server = createApiServer(new GeneratorService(provider, provider));
  const baseUrl = await listen(server);

  try {
    const response = await fetch(baseUrl + '/api/generate', {
      method: 'POST',
      headers: { 'Content-Type': 'text/plain;charset=UTF-8' },
      body: JSON.stringify(sampleInput),
    });

    assert.equal(response.status, 415);
    assert.equal(provider.calls, 0);
  } finally {
    await close(server);
  }
});

test('POST /api/generate 在请求窗口耗尽后返回 429', async () => {
  const provider = new CountingProvider();
  const server = createApiServer(new GeneratorService(provider, provider), {
    maxRequestsPerWindow: 1,
    rateLimitWindowMs: 60_000,
  });
  const baseUrl = await listen(server);
  const request = () =>
    fetch(baseUrl + '/api/generate', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(sampleInput),
    });

  try {
    const firstResponse = await request();
    const secondResponse = await request();

    assert.equal(firstResponse.status, 200);
    assert.equal(secondResponse.status, 429);
    assert.equal(provider.calls, 1);
    assert.ok(Number(secondResponse.headers.get('Retry-After')) >= 1);
  } finally {
    await close(server);
  }
});

test('POST /api/generate 限制同时执行的 Provider 调用', async () => {
  const provider = new BlockingProvider();
  const server = createApiServer(new GeneratorService(provider, provider), {
    maxConcurrentGenerations: 1,
  });
  const baseUrl = await listen(server);
  const request = () =>
    fetch(baseUrl + '/api/generate', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(sampleInput),
    });
  let firstRequest: Promise<Response> | undefined;

  try {
    firstRequest = request();
    await provider.started;

    const secondResponse = await request();
    assert.equal(secondResponse.status, 429);
    assert.equal(provider.calls, 1);

    provider.release();
    const firstResponse = await firstRequest;
    assert.equal(firstResponse.status, 200);
  } finally {
    provider.release();
    await firstRequest?.catch(() => undefined);
    await close(server);
  }
});
