import type {
  BinaryTranscriptionInput,
  BinaryTranscriptionProvider,
  BinaryTranscriptionResult,
  BinaryTranscriptionSegment,
} from './TranscriptionProvider.js';

interface WhisperResponse {
  text?: unknown;
  segments?: unknown;
}

const parseSegment = (value: unknown): BinaryTranscriptionSegment | null => {
  if (!value || typeof value !== 'object') return null;
  const segment = value as Record<string, unknown>;
  if (typeof segment.text !== 'string' || !segment.text.trim()) return null;
  const speaker = typeof segment.speaker === 'string' && segment.speaker.trim()
    ? segment.speaker.trim()
    : '待标注说话人';
  const start = typeof segment.start === 'number' ? segment.start : undefined;
  const end = typeof segment.end === 'number' ? segment.end : undefined;
  const confidence = typeof segment.confidence === 'number'
    ? segment.confidence
    : typeof segment.avg_logprob === 'number'
      ? Math.max(0, Math.min(1, Math.exp(segment.avg_logprob)))
      : undefined;
  return {
    speaker,
    text: segment.text.trim(),
    startMs: start === undefined ? undefined : Math.round(start * 1000),
    endMs: end === undefined ? undefined : Math.round(end * 1000),
    confidence,
  };
};

export class LocalWhisperProvider implements BinaryTranscriptionProvider {
  readonly name = 'local_whisper' as const;

  constructor(
    private readonly baseUrl: string,
    private readonly timeoutMs = 120_000,
    private readonly fetchImpl: typeof fetch = fetch,
  ) {
    const url = new URL(baseUrl);
    if (!['http:', 'https:'].includes(url.protocol)) throw new Error('本地 Whisper 地址协议无效。');
    if (!['127.0.0.1', 'localhost', '::1'].includes(url.hostname)) {
      throw new Error('本地 Whisper 服务必须绑定回环地址，避免音频发送到远端。');
    }
  }

  async transcribe(input: BinaryTranscriptionInput): Promise<BinaryTranscriptionResult> {
    const form = new FormData();
    const audioCopy = new Uint8Array(input.bytes.byteLength);
    audioCopy.set(input.bytes);
    form.append('file', new Blob([audioCopy.buffer], { type: input.mimeType }), input.fileName);
    form.append('model', 'whisper-1');
    form.append('response_format', 'verbose_json');
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), this.timeoutMs);
    try {
      const response = await this.fetchImpl(`${this.baseUrl.replace(/\/+$/u, '')}/v1/audio/transcriptions`, {
        method: 'POST',
        body: form,
        signal: controller.signal,
      });
      if (!response.ok) throw new Error('本地 Whisper 转写失败，请改用人工粘贴。');
      const body = await response.json() as WhisperResponse;
      const text = typeof body.text === 'string' ? body.text.trim() : '';
      if (!text) throw new Error('本地 Whisper 未返回有效文本，请改用人工粘贴。');
      const segments = Array.isArray(body.segments)
        ? body.segments.map(parseSegment).filter((segment): segment is BinaryTranscriptionSegment => segment !== null)
        : [];
      return { text, segments };
    } catch (error) {
      if (error instanceof Error && error.name === 'AbortError') {
        throw new Error('本地 Whisper 转写超时，请改用人工粘贴。');
      }
      if (error instanceof Error && error.message.includes('本地 Whisper')) throw error;
      throw new Error('无法连接本地 Whisper，请改用人工粘贴。');
    } finally {
      clearTimeout(timer);
    }
  }
}
