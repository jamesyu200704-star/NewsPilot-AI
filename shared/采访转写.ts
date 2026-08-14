import type { InterviewTranscript, TranscriptSegment } from './报道执行模型.js';

export interface ManualTranscriptionInput {
  id: string;
  sessionId: string;
  sourceId: string;
  text: string;
  fileName?: string;
  now?: string;
}

export interface TranscriptionProvider<Input> {
  readonly name: 'manual' | 'local_whisper';
  transcribe(input: Input): Promise<InterviewTranscript>;
}

const speakerPattern = /^\s*([^：:\n]{1,24})[：:]\s*(.+)$/u;

const sensitiveFlags = (text: string): TranscriptSegment['sensitiveTermFlags'] => {
  const flags: TranscriptSegment['sensitiveTermFlags'] = [];
  if (/\b\d+(?:[.,]\d+)?\b|[一二三四五六七八九十百千万]+(?:月|日|次|人|名|%)/u.test(text)) flags.push('number');
  if (/学生处|教务处|学校|学院|公司|平台|委员会|政府|教育部/u.test(text)) flags.push('organization');
  if (/[《》]|[A-Z]{2,}|人工智能|生成式/u.test(text)) flags.push('term');
  if (/^[\p{Script=Han}]{2,4}(?:老师|同学|主任|校长|教授)/u.test(text)) flags.push('name');
  return flags;
};

export class ManualTranscriptProvider implements TranscriptionProvider<ManualTranscriptionInput> {
  readonly name = 'manual' as const;

  async transcribe(input: ManualTranscriptionInput): Promise<InterviewTranscript> {
    if (!input.text.trim()) throw new Error('请粘贴采访记录或导入 TXT / Markdown 文件。');
    if (input.fileName && !/\.(txt|md|markdown)$/iu.test(input.fileName)) {
      throw new Error('人工转写仅接受 TXT 或 Markdown 文本文件。');
    }
    const timestamp = input.now || new Date().toISOString();
    const lines = input.text
      .replace(/\r\n?/gu, '\n')
      .split('\n')
      .map((line) => line.trim())
      .filter(Boolean);
    const segments = lines.map((line, index): TranscriptSegment => {
      const match = speakerPattern.exec(line);
      const speaker = match?.[1]?.trim() || '待标注说话人';
      const text = match?.[2]?.trim() || line;
      return {
        id: `${input.id}-segment-${index + 1}`,
        transcriptId: input.id,
        speaker,
        text,
        reviewStatus: 'unreviewed',
        sensitiveTermFlags: sensitiveFlags(text),
      };
    });
    return {
      id: input.id,
      sessionId: input.sessionId,
      sourceId: input.sourceId,
      provider: 'manual',
      fileName: input.fileName,
      status: 'review_required',
      segments,
      warnings: ['人工导入内容尚未复核；姓名、数字、机构和专有词必须逐项确认。'],
      createdAt: timestamp,
      updatedAt: timestamp,
    };
  }
}

export interface AudioUploadInput {
  fileName: string;
  mimeType: string;
  size: number;
  bytes: Uint8Array;
  maxFileMb: number;
}

const audioTypes: Record<string, string[]> = {
  mp3: ['audio/mpeg', 'audio/mp3'],
  wav: ['audio/wav', 'audio/x-wav', 'audio/wave'],
  m4a: ['audio/mp4', 'audio/x-m4a', 'audio/m4a'],
  webm: ['audio/webm'],
};

const signatureMatches = (extension: string, bytes: Uint8Array) => {
  if (extension === 'wav') return bytes.length >= 4 && String.fromCharCode(...bytes.slice(0, 4)) === 'RIFF';
  if (extension === 'webm') return bytes.length >= 4 && bytes[0] === 0x1a && bytes[1] === 0x45 && bytes[2] === 0xdf && bytes[3] === 0xa3;
  if (extension === 'm4a') return bytes.length >= 8 && String.fromCharCode(...bytes.slice(4, 8)) === 'ftyp';
  if (extension === 'mp3') {
    return (bytes.length >= 3 && String.fromCharCode(...bytes.slice(0, 3)) === 'ID3') ||
      (bytes.length >= 2 && bytes[0] === 0xff && (bytes[1]! & 0xe0) === 0xe0);
  }
  return false;
};

export function validateAudioUpload(input: AudioUploadInput):
  | { ok: true; input: AudioUploadInput }
  | { ok: false; error: string } {
  const extension = input.fileName.split('.').pop()?.toLowerCase() || '';
  if (!Object.hasOwn(audioTypes, extension)) return { ok: false, error: '只接受 MP3、WAV、M4A 或 WebM 音频。' };
  if (!audioTypes[extension]!.includes(input.mimeType.toLowerCase())) return { ok: false, error: '文件 MIME 类型与扩展名不匹配。' };
  if (!Number.isFinite(input.size) || input.size <= 0 || input.size > input.maxFileMb * 1024 * 1024) {
    return { ok: false, error: `音频大小必须在 ${input.maxFileMb}MB 以内。` };
  }
  if (!signatureMatches(extension, input.bytes)) return { ok: false, error: '音频文件签名无效或与扩展名不一致。' };
  return { ok: true, input };
}
