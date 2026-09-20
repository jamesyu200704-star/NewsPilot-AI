import assert from 'node:assert/strict';
import type { Server } from 'node:http';
import type { AddressInfo } from 'node:net';
import test from 'node:test';
import { createApiServer } from '../app.js';
import { MockProvider } from '../providers/MockProvider.js';
import { GeneratorService } from '../services/generator.js';

const listen = async (server: Server) => {
  await new Promise<void>((resolve) => server.listen(0, '127.0.0.1', resolve));
  const address = server.address() as AddressInfo;
  return 'http://127.0.0.1:' + address.port;
};

const close = (server: Server) =>
  new Promise<void>((resolve, reject) => {
    server.close((error) => (error ? reject(error) : resolve()));
  });

test('POST /api/editor 拒绝缺少新闻编辑动作的请求', async () => {
  const provider = new MockProvider();
  const server = createApiServer(new GeneratorService(provider, provider));
  const baseUrl = await listen(server);

  try {
    const response = await fetch(baseUrl + '/api/editor', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        taskType: 'news_edit',
        sourceText: '学校于今天发布了新的图书馆开放安排，晚间开放时间延长至晚上十点，学生可以通过预约系统入馆。',
      }),
    });

    assert.equal(response.status, 400);
  } finally {
    await close(server);
  }
});

test('POST /api/editor 接受三万个中文字符的长稿', async () => {
  const provider = new MockProvider();
  const server = createApiServer(new GeneratorService(provider, provider));
  const baseUrl = await listen(server);

  try {
    const response = await fetch(baseUrl + '/api/editor', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        taskType: 'news_edit',
        action: 'polish',
        sourceText: '新'.repeat(30000),
      }),
    });

    assert.equal(response.status, 200);
  } finally {
    await close(server);
  }
});
