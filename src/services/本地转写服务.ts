import { validateAudioUpload } from '../../shared/采访转写.js';
import type { InterviewTranscript, TranscriptSegment } from '../../shared/报道执行模型.js';

interface LocalWhisperResponse {
  provider?: unknown;
  text?: unknown;
  segments?: unknown;
  warnings?: unknown;
  error?: unknown;
}

const parseSegment = (value: unknown, transcriptId: string, index: number): TranscriptSegment | null => {
  if (!value || typeof value !== 'object') return null;
  const segment = value as Record<string, unknown>;
  if (typeof segment.text !== 'string' || !segment.text.trim()) return null;
  const confidence = typeof segment.confidence === 'number' ? segment.confidence : undefined;
  const flags: TranscriptSegment['sensitiveTermFlags'] = [];
  if (/\d/u.test(segment.text)) flags.push('number');
  if (/学校|学院|部门|公司|平台/u.test(segment.text)) flags.push('organization');
  return {
    id: `${transcriptId}-segment-${index + 1}`,
    transcriptId,
    speaker: typeof segment.speaker === 'string' && segment.speaker.trim() ? segment.speaker.trim() : '待标注说话人',
    text: segment.text.trim(),
    startMs: typeof segment.startMs === 'number' ? segment.startMs : undefined,
    endMs: typeof segment.endMs === 'number' ? segment.endMs : undefined,
    confidence,
    reviewStatus: 'unreviewed',
    sensitiveTermFlags: flags,
  };
};

export async function transcribeWithLocalWhisper(input: {
  file: File;
  transcriptId: string;
  sessionId: string;
  sourceId: string;
  maxFileMb?: number;
}): Promise<InterviewTranscript> {
  const header = new Uint8Array(await input.file.slice(0, 16).arrayBuffer());
  const validation = validateAudioUpload({
    fileName: input.file.name,
    mimeType: input.file.type,
    size: input.file.size,
    bytes: header,
    maxFileMb: input.maxFileMb || 100,
  });
  if (!validation.ok) throw new Error(validation.error);
  let response: Response;
  try {
    response = await fetch('/api/transcription', {
      method: 'POST',
      headers: {
        'content-type': input.file.type,
        'x-newspilot-client': 'web',
        'x-file-name': encodeURIComponent(input.file.name),
      },
      body: input.file,
    });
  } catch {
    throw new Error('本地 Whisper 不可用，音频未上传云端；请改用人工粘贴。');
  }
  const body = await response.json().catch(() => ({})) as LocalWhisperResponse;
  if (!response.ok) {
    throw new Error(typeof body.error === 'string' ? body.error : '本地 Whisper 不可用，请改用人工粘贴。');
  }
  if (body.provider !== 'local_whisper' || typeof body.text !== 'string') {
    throw new Error('本地 Whisper 返回格式无效，请改用人工粘贴。');
  }
  const segments = Array.isArray(body.segments)
    ? body.segments.map((segment, index) => parseSegment(segment, input.transcriptId, index)).filter((segment): segment is TranscriptSegment => segment !== null)
    : [];
  const timestamp = new Date().toISOString();
  return {
    id: input.transcriptId,
    sessionId: input.sessionId,
    sourceId: input.sourceId,
    provider: 'local_whisper',
    fileName: input.file.name,
    mimeType: input.file.type,
    status: 'review_required',
    segments,
    warnings: Array.isArray(body.warnings) ? body.warnings.filter((item): item is string => typeof item === 'string') : ['自动转写未经人工复核。'],
    createdAt: timestamp,
    updatedAt: timestamp,
  };
}
