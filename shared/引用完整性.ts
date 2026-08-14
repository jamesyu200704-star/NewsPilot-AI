import type { EvidenceWorkspaceState } from './证据领域模型.js';

export function validateCitationIntegrity(workspace: EvidenceWorkspaceState) {
  const claimIds = new Set(workspace.claims.map((item) => item.id));
  const sourceById = new Map(workspace.sources.map((item) => [item.id, item]));
  const evidenceIds = new Set(workspace.evidence.map((item) => item.id));
  for (const item of workspace.evidence) {
    const source = sourceById.get(item.sourceId);
    if (!source) throw new Error(`证据 ${item.id} 引用了不存在的 sourceId 来源。`);
    if (!item.excerpt.trim() || !item.location) throw new Error(`证据 ${item.id} 缺少可定位的证据片段。`);
    if (source.extractionStatus === 'metadata_only') {
      throw new Error(`来源 ${source.id} 只有搜索摘要或元数据，尚未获取原始页面，不能作为证据。`);
    }
    for (const claimId of item.claimIds) if (!claimIds.has(claimId)) throw new Error(`证据 ${item.id} 的 claimId 不存在。`);
  }
  for (const claim of workspace.claims) {
    for (const evidenceId of claim.evidenceIds) if (!evidenceIds.has(evidenceId)) throw new Error(`主张 ${claim.id} 引用了不存在的 evidenceId。`);
  }
  for (const row of workspace.claimEvidenceMatrix) {
    if (!claimIds.has(row.claimId)) throw new Error(`证据矩阵引用了不存在的 claimId。`);
    for (const evidenceId of [...row.supportingEvidenceIds, ...row.contradictingEvidenceIds, ...row.contextualEvidenceIds]) {
      if (!evidenceIds.has(evidenceId)) throw new Error(`证据矩阵引用了不存在的 evidenceId ${evidenceId}。`);
    }
  }
  return true;
}
