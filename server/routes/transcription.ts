import express, { type RequestHandler } from 'express';
import { validateAudioUpload } from '../../shared/采访转写.js';
import type { BinaryTranscriptionProvider } from '../transcription/TranscriptionProvider.js';

export interface TranscriptionRouteOptions {
  transcriptionProvider?: BinaryTranscriptionProvider;
  transcriptionMaxFileMb?: number;
}

const requireBrowserClient: RequestHandler = (request, response, next) => {
  if (request.get('x-newspilot-client') !== 'web') {
    response.status(403).json({ error: '请求来源校验失败。' });
    return;
  }
  next();
};

export function createTranscriptionRouter(options: TranscriptionRouteOptions = {}) {
  const router = express.Router();
  const maxFileMb = Math.max(1, Math.min(100, options.transcriptionMaxFileMb || 100));
  router.post(
    '/',
    requireBrowserClient,
    express.raw({ type: ['audio/mpeg', 'audio/mp3', 'audio/wav', 'audio/x-wav', 'audio/wave', 'audio/mp4', 'audio/x-m4a', 'audio/m4a', 'audio/webm'], limit: `${maxFileMb}mb` }),
    async (request, response, next) => {
      try {
        if (!options.transcriptionProvider) {
          response.status(503).json({ error: '音频转写仅在本地完整模式启用；请改用人工粘贴 TXT / Markdown。' });
          return;
        }
        const mimeType = request.get('content-type')?.split(';')[0]?.trim().toLowerCase() || '';
        const fileNameHeader = request.get('x-file-name') || '';
        const fileName = decodeURIComponent(fileNameHeader).replace(/[\\/\0\r\n]/gu, '').slice(0, 180);
        if (!Buffer.isBuffer(request.body)) {
          response.status(415).json({ error: '只接受 MP3、WAV、M4A 或 WebM 音频。' });
          return;
        }
        const bytes = new Uint8Array(request.body);
        const validation = validateAudioUpload({ fileName, mimeType, size: bytes.byteLength, bytes, maxFileMb });
        if (!validation.ok) {
          response.status(415).json({ error: validation.error });
          return;
        }
        const result = await options.transcriptionProvider.transcribe({ fileName, mimeType, bytes });
        response.status(200).json({
          provider: options.transcriptionProvider.name,
          text: result.text,
          segments: result.segments,
          warnings: ['本地自动转写未经人工复核，不能直接作为准确引语或事实证据。'],
        });
      } catch (error) {
        next(error);
      }
    },
  );
  return router;
}
