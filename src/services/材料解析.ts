import type {
  EvidenceItem,
  SourceRecord,
  UploadedMaterial,
} from '../../shared/证据领域模型.js';

const allowed = {
  txt: ['text/plain'],
  md: ['text/markdown', 'text/plain'],
  csv: ['text/csv', 'application/vnd.ms-excel', 'text/plain'],
  json: ['application/json', 'text/json', 'text/plain'],
  pdf: ['application/pdf'],
  docx: [
    'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
    'application/zip',
    'application/octet-stream',
  ],
} as const;

type SupportedExtension = keyof typeof allowed;

export class MaterialParseError extends Error {}

export interface MaterialLimits {
  maxFileBytes?: number;
  maxProjectBytes?: number;
  currentProjectBytes?: number;
  maxUncompressedBytes?: number;
}

interface ParseOptions extends MaterialLimits {
  now?: () => string;
  pdfTextExtractor?: (buffer: ArrayBuffer) => Promise<{ text: string; pageCount: number }>;
}

type CachedExtraction = {
  extension: SupportedExtension;
  text: string;
  pageCount?: number;
  extractionStatus: UploadedMaterial['extractionStatus'];
  warnings: string[];
};

const extractionCache = new Map<string, CachedExtraction>();
const MAX_EXTRACTION_CACHE_ENTRIES = 40;

const extensionOf = (name: string) => name.split('.').pop()?.toLowerCase() as SupportedExtension | undefined;
const bytesToHex = (bytes: Uint8Array) => [...bytes].map((value) => value.toString(16).padStart(2, '0')).join('');
const digest = async (buffer: ArrayBuffer) => {
  const hash = await crypto.subtle.digest('SHA-256', buffer);
  return bytesToHex(new Uint8Array(hash));
};
const randomId = (prefix: string) => `${prefix}-${crypto.randomUUID?.() || `${Date.now()}-${Math.random().toString(36).slice(2)}`}`;
const normalize = (value: string) => value.replace(/\0/gu, '').replace(/\r\n?/gu, '\n').trim();

const assertMagic = async (file: File, extension: SupportedExtension) => {
  const head = new Uint8Array(await file.slice(0, 12).arrayBuffer());
  const ascii = new TextDecoder('latin1').decode(head);
  if (head[0] === 0x4d && head[1] === 0x5a) throw new MaterialParseError('文件头显示该文件可能是伪装的可执行文件。');
  if (extension === 'pdf' && !ascii.startsWith('%PDF-')) throw new MaterialParseError('PDF 文件头无效或文件已损坏。');
  if (extension === 'docx' && !(head[0] === 0x50 && head[1] === 0x4b)) throw new MaterialParseError('DOCX 文件头无效或文件已损坏。');
};

export async function validateMaterialFile(file: File, limits: MaterialLimits = {}) {
  const extension = extensionOf(file.name);
  if (!extension || !Object.hasOwn(allowed, extension)) {
    throw new MaterialParseError('不支持的文件类型；仅支持 TXT、Markdown、PDF、DOCX、CSV 和 JSON。');
  }
  const maxFileBytes = limits.maxFileBytes ?? 10 * 1024 * 1024;
  const maxProjectBytes = limits.maxProjectBytes ?? 50 * 1024 * 1024;
  if (file.size <= 0) throw new MaterialParseError('文件为空。');
  if (file.size > maxFileBytes) throw new MaterialParseError('文件大小超过单文件限制。');
  if ((limits.currentProjectBytes || 0) + file.size > maxProjectBytes) {
    throw new MaterialParseError('项目材料总量超过限制。');
  }
  if (file.type && !(allowed[extension] as readonly string[]).includes(file.type)) {
    throw new MaterialParseError('文件 MIME 类型与扩展名不匹配。');
  }
  await assertMagic(file, extension);
  return extension;
}

const extractPdf = async (buffer: ArrayBuffer) => {
  const { getDocument, GlobalWorkerOptions } = await import('pdfjs-dist');
  GlobalWorkerOptions.workerSrc = new URL(
    'pdfjs-dist/build/pdf.worker.min.mjs',
    import.meta.url,
  ).toString();
  const document = await getDocument({ data: new Uint8Array(buffer), useWorkerFetch: false }).promise;
  const pages: string[] = [];
  for (let pageNumber = 1; pageNumber <= document.numPages; pageNumber += 1) {
    const page = await document.getPage(pageNumber);
    const content = await page.getTextContent();
    pages.push(content.items.map((item) => 'str' in item ? item.str : '').join(' '));
  }
  return { text: pages.join('\n\n'), pageCount: document.numPages };
};

const extractDocx = async (buffer: ArrayBuffer, maxUncompressedBytes: number) => {
  const [{ default: JSZip }, mammoth] = await Promise.all([
    import('jszip'),
    import('mammoth/mammoth.browser'),
  ]);
  const zip = await JSZip.loadAsync(buffer, { checkCRC32: true, createFolders: false });
  const names = Object.keys(zip.files);
  if (names.some((name) => /vbaProject\.bin|embeddings\/|activeX\/|customUI\//iu.test(name))) {
    throw new MaterialParseError('DOCX 包含宏、脚本或嵌入对象，当前版本拒绝解析。');
  }
  let uncompressedSize = 0;
  for (const name of names) {
    if (zip.files[name].dir) continue;
    const bytes = await zip.files[name].async('uint8array');
    uncompressedSize += bytes.byteLength;
    if (uncompressedSize > maxUncompressedBytes) throw new MaterialParseError('DOCX 解压后体积超过限制，可能是压缩炸弹。');
  }
  const result = await mammoth.extractRawText({ arrayBuffer: buffer });
  return { text: result.value, warnings: result.messages.map((message) => message.message) };
};

const chunkEvidence = (
  text: string,
  sourceId: string,
  now: string,
  pageCount?: number,
): EvidenceItem[] => {
  const paragraphs = text.split(/\n{2,}|(?<=[。！？!?])\s+/u).map((item) => item.trim()).filter((item) => item.length >= 4);
  return paragraphs.slice(0, 20).map((excerpt, index) => ({
    id: `${sourceId}-E-${String(index + 1).padStart(3, '0')}`,
    sourceId,
    excerpt: excerpt.slice(0, 800),
    normalizedMeaning: excerpt.slice(0, 400),
    ...(pageCount === 1 ? { location: { pageNumber: 1, paragraphIndex: index } } : { location: { paragraphIndex: index } }),
    relation: 'context',
    claimIds: [],
    directness: 'interpretive',
    userConfirmed: false,
    createdAt: now,
  }));
};

export async function parseUploadedMaterial(
  file: File,
  projectId: string,
  options: ParseOptions = {},
): Promise<{ material: UploadedMaterial; source: SourceRecord; evidence: EvidenceItem[] }> {
  const extension = await validateMaterialFile(file, options);
  const buffer = await file.arrayBuffer();
  const now = options.now?.() || new Date().toISOString();
  const materialId = randomId('M');
  const sourceId = randomId('S');
  const contentHash = await digest(buffer);
  const cached = extractionCache.get(contentHash);
  const warnings = ['上传材料是不可信外部数据；系统不会执行其中的代码、宏、脚本、工具调用或提示词指令。'];
  let text = '';
  let pageCount: number | undefined;
  let extractionStatus: UploadedMaterial['extractionStatus'] = 'success';
  if (cached && cached.extension === extension) {
    text = cached.text;
    pageCount = cached.pageCount;
    extractionStatus = cached.extractionStatus;
    warnings.push(...cached.warnings, '检测到相同内容哈希，已复用本次浏览器会话中的解析结果。');
  } else try {
    if (extension === 'docx') {
      const parsed = await extractDocx(buffer, options.maxUncompressedBytes ?? 40 * 1024 * 1024);
      text = parsed.text;
      warnings.push(...parsed.warnings);
    } else if (extension === 'pdf') {
      const parsed = await (options.pdfTextExtractor || extractPdf)(buffer);
      text = parsed.text;
      pageCount = parsed.pageCount;
      if (!normalize(text)) {
        extractionStatus = 'failed';
        warnings.push('该文件可能是扫描版，当前版本无法识别图片文字，请上传可复制文本的版本或手动粘贴内容。');
      }
    } else if (extension === 'json') {
      const value: unknown = JSON.parse(await file.text());
      text = JSON.stringify(value, null, 2);
    } else {
      text = await file.text();
    }
  } catch (error) {
    if (error instanceof MaterialParseError) throw error;
    extractionStatus = 'failed';
    warnings.push(error instanceof Error ? `材料解析失败：${error.message}` : '材料解析失败。');
  }
  text = normalize(text).slice(0, options.maxUncompressedBytes ?? 40 * 1024 * 1024);
  if (!cached) {
    if (extractionCache.size >= MAX_EXTRACTION_CACHE_ENTRIES) {
      const oldestHash = extractionCache.keys().next().value;
      if (typeof oldestHash === 'string') extractionCache.delete(oldestHash);
    }
    extractionCache.set(contentHash, {
      extension, text, ...(pageCount ? { pageCount } : {}), extractionStatus,
      warnings: warnings.slice(1),
    });
  }
  const material: UploadedMaterial = {
    id: materialId,
    projectId,
    fileName: file.name,
    fileType: extension,
    fileSize: file.size,
    contentHash,
    uploadedAt: now,
    extractionStatus,
    ...(text ? { extractedText: text } : {}),
    ...(pageCount ? { pageCount } : {}),
    warnings,
    sourceRecordId: sourceId,
  };
  const source: SourceRecord = {
    id: sourceId,
    title: file.name,
    retrievedAt: now,
    sourceType: 'user_material',
    credibilityTier: 'unrated',
    contentHash,
    originStatus: 'origin_unresolved',
    isLikelyRepost: false,
    shortSummary: text.slice(0, 500) || '材料未能提取文本，只保留文件元数据。',
    supportsClaimIds: [],
    contradictsClaimIds: [],
    userAccepted: false,
    userRejected: false,
    extractionStatus: extractionStatus === 'success' ? 'success' : 'failed',
    warnings: [...warnings],
    classificationHistory: [{
      at: now,
      actor: 'rules',
      sourceType: 'user_material',
      credibilityTier: 'unrated',
      reason: '用户上传材料不自动获得 A 级，必须由用户确认材料性质和来源。',
    }],
  };
  return { material, source, evidence: extractionStatus === 'success' ? chunkEvidence(text, sourceId, now, pageCount) : [] };
}
