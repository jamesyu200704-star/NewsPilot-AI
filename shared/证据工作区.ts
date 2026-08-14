import type {
  EvidenceWorkspaceExport,
  EvidenceWorkspaceState,
} from './证据领域模型.js';

export function createEmptyEvidenceWorkspace(now = new Date().toISOString()): EvidenceWorkspaceState {
  return {
    schemaVersion: 1,
    claims: [],
    searchPlan: null,
    sources: [],
    evidence: [],
    claimEvidenceMatrix: [],
    conflicts: [],
    uploadedMaterials: [],
    updatedAt: now,
  };
}

const isRecord = (value: unknown): value is Record<string, unknown> =>
  value !== null && typeof value === 'object' && !Array.isArray(value);
const isDate = (value: unknown) => typeof value === 'string' && !Number.isNaN(Date.parse(value));
const isStringArray = (value: unknown) => Array.isArray(value) && value.every((item) => typeof item === 'string');
const isClaim = (value: unknown) => isRecord(value) && typeof value.id === 'string' &&
  typeof value.text === 'string' && ['fact', 'opinion', 'hypothesis', 'allegation', 'prediction', 'statistic'].includes(String(value.type)) &&
  ['critical', 'major', 'minor'].includes(String(value.importance)) && isStringArray(value.evidenceIds) && isStringArray(value.missingEvidence);
const isSource = (value: unknown) => isRecord(value) && typeof value.id === 'string' && typeof value.title === 'string' &&
  isDate(value.retrievedAt) && typeof value.sourceType === 'string' && typeof value.credibilityTier === 'string' &&
  isStringArray(value.supportsClaimIds) && isStringArray(value.contradictsClaimIds) && Array.isArray(value.warnings) && Array.isArray(value.classificationHistory);
const isEvidence = (value: unknown) => isRecord(value) && typeof value.id === 'string' && typeof value.sourceId === 'string' &&
  typeof value.excerpt === 'string' && typeof value.normalizedMeaning === 'string' && isStringArray(value.claimIds);
const isMatrixRow = (value: unknown) => isRecord(value) && typeof value.claimId === 'string' &&
  isStringArray(value.supportingEvidenceIds) && isStringArray(value.contradictingEvidenceIds) && isStringArray(value.contextualEvidenceIds);
const isConflict = (value: unknown) => isRecord(value) && typeof value.id === 'string' && typeof value.claimId === 'string' &&
  isStringArray(value.supportingEvidenceIds) && isStringArray(value.contradictingEvidenceIds) && isStringArray(value.nextSteps);
const isMaterial = (value: unknown) => isRecord(value) && typeof value.id === 'string' && typeof value.fileName === 'string' &&
  typeof value.fileSize === 'number' && typeof value.contentHash === 'string' && Array.isArray(value.warnings);
const isSearchPlan = (value: unknown) => value === null || (isRecord(value) && typeof value.id === 'string' &&
  typeof value.projectId === 'string' && typeof value.topic === 'string' && Array.isArray(value.queries));

export function isEvidenceWorkspace(value: unknown): value is EvidenceWorkspaceState {
  return isRecord(value) && value.schemaVersion === 1 && isDate(value.updatedAt) &&
    Array.isArray(value.claims) && value.claims.every(isClaim) &&
    isSearchPlan(value.searchPlan) && Array.isArray(value.sources) && value.sources.every(isSource) &&
    Array.isArray(value.evidence) && value.evidence.every(isEvidence) &&
    Array.isArray(value.claimEvidenceMatrix) && value.claimEvidenceMatrix.every(isMatrixRow) &&
    Array.isArray(value.conflicts) && value.conflicts.every(isConflict) &&
    Array.isArray(value.uploadedMaterials) && value.uploadedMaterials.every(isMaterial);
}

export function serializeEvidenceWorkspace(
  workspace: EvidenceWorkspaceState,
  exportedAt = new Date().toISOString(),
) {
  return JSON.stringify({
    format: 'newspilot-evidence-workspace',
    ...workspace,
    exportedAt,
  } satisfies EvidenceWorkspaceExport, null, 2);
}

export function parseEvidenceWorkspaceExport(serialized: string): EvidenceWorkspaceExport {
  let value: unknown;
  try { value = JSON.parse(serialized); } catch { throw new Error('证据工作区文件已损坏。'); }
  if (!isRecord(value) || value.format !== 'newspilot-evidence-workspace') throw new Error('证据工作区格式无效。');
  if (value.schemaVersion !== 1) throw new Error(`不支持的证据工作区版本：${String(value.schemaVersion)}。`);
  if (!isDate(value.exportedAt) || !isEvidenceWorkspace(value)) throw new Error('证据工作区字段校验失败。');
  return value as unknown as EvidenceWorkspaceExport;
}
