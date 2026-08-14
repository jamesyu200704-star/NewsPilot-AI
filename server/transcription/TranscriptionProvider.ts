export interface BinaryTranscriptionInput {
  fileName: string;
  mimeType: string;
  bytes: Uint8Array;
}

export interface BinaryTranscriptionSegment {
  speaker: string;
  text: string;
  startMs?: number;
  endMs?: number;
  confidence?: number;
}

export interface BinaryTranscriptionResult {
  text: string;
  segments: BinaryTranscriptionSegment[];
}

export interface BinaryTranscriptionProvider {
  readonly name: 'local_whisper';
  transcribe(input: BinaryTranscriptionInput): Promise<BinaryTranscriptionResult>;
}
