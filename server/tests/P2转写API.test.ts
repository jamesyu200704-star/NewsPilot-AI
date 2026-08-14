import assert from 'node:assert/strict';
import type { Server } from 'node:http';
import type { AddressInfo } from 'node:net';
import test from 'node:test';
import { createApiServer } from '../app.js';
import { MockProvider } from '../providers/MockProvider.js';
import { GeneratorService } from '../services/generator.js';
import type {
  BinaryTranscriptionInput,
  BinaryTranscriptionProvider,
} from '../transcription/TranscriptionProvider.js';

const listen = async (server: Server) => {
  await new Promise<void>((resolve) => server.listen(0, '127.0.0.1', resolve));
  const address = server.address() as AddressInfo;
  return `http://127.0.0.1:${address.port}`;
};

const close = (server: Server) => new Promise<void>((resolve, reject) => {
  server.close((error) => (error ? reject(error) : resolve()));
});

class StubLocalWhisperProvider implements BinaryTranscriptionProvider {
  readonly name = 'local_whisper' as const;
  calls: BinaryTranscriptionInput[] = [];

  async transcribe(input: BinaryTranscriptionInput) {
    this.calls.push(input);
    return {
      text: '受访者：这是本地转写文本。',
      segments: [{ speaker: '受访者', text: '这是本地转写文本。', startMs: 0, endMs: 1800, confidence: 0.91 }],
    };
  }
}

const webmBytes = new Uint8Array([0x1a, 0x45, 0xdf, 0xa3, 0, 0, 0, 0]);

test('公共/手动模式明确关闭音频转写接口', async () => {
  const mock = new MockProvider();
  const server = createApiServer(new GeneratorService(mock, mock));
  const baseUrl = await listen(server);
  try {
    const response = await fetch(`${baseUrl}/api/transcription`, {
      method: 'POST',
      headers: {
        'content-type': 'audio/webm',
        'x-newspilot-client': 'web',
        'x-file-name': 'interview.webm',
      },
      body: webmBytes,
    });
    assert.equal(response.status, 503);
    assert.match(JSON.stringify(await response.json()), /仅在本地完整模式/u);
  } finally {
    await close(server);
  }
});

test('本地 Whisper 接口双重校验文件并只返回转写数据', async () => {
  const mock = new MockProvider();
  const transcriptionProvider = new StubLocalWhisperProvider();
  const server = createApiServer(new GeneratorService(mock, mock), {
    transcriptionProvider,
    transcriptionMaxFileMb: 100,
  });
  const baseUrl = await listen(server);
  try {
    const missingHeader = await fetch(`${baseUrl}/api/transcription`, {
      method: 'POST',
      headers: { 'content-type': 'audio/webm', 'x-file-name': 'interview.webm' },
      body: webmBytes,
    });
    assert.equal(missingHeader.status, 403);

    const invalid = await fetch(`${baseUrl}/api/transcription`, {
      method: 'POST',
      headers: {
        'content-type': 'text/html',
        'x-newspilot-client': 'web',
        'x-file-name': 'attack.html',
      },
      body: '<script>alert(1)</script>',
    });
    assert.equal(invalid.status, 415);

    const valid = await fetch(`${baseUrl}/api/transcription`, {
      method: 'POST',
      headers: {
        'content-type': 'audio/webm',
        'x-newspilot-client': 'web',
        'x-file-name': 'interview.webm',
      },
      body: webmBytes,
    });
    assert.equal(valid.status, 200);
    assert.equal(transcriptionProvider.calls.length, 1);
    assert.deepEqual(await valid.json(), {
      provider: 'local_whisper',
      text: '受访者：这是本地转写文本。',
      segments: [{ speaker: '受访者', text: '这是本地转写文本。', startMs: 0, endMs: 1800, confidence: 0.91 }],
      warnings: ['本地自动转写未经人工复核，不能直接作为准确引语或事实证据。'],
    });
  } finally {
    await close(server);
  }
});
