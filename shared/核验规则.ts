import type {
  Claim,
  ClaimEvidenceMatrixRow,
  EvidenceItem,
  SourceRecord,
} from './证据领域模型.js';

const primaryTypes = new Set(['primary_document', 'official_data', 'interview_material']);
const highQualitySecondary = new Set(['academic_source', 'news_report', 'official_statement']);

export function linkEvidenceToClaims(
  claims: Claim[],
  sources: SourceRecord[],
  evidence: EvidenceItem[],
) {
  const claimIds = new Set(claims.map((item) => item.id));
  const sourceIds = new Set(sources.map((item) => item.id));
  for (const item of evidence) {
    if (!sourceIds.has(item.sourceId)) throw new Error(`证据 ${item.id} 的 sourceId 不存在。`);
    for (const claimId of item.claimIds) {
      if (!claimIds.has(claimId)) throw new Error(`证据 ${item.id} 引用了不存在的 claimId。`);
    }
  }
  return claims.map((item) => ({
    ...item,
    evidenceIds: evidence.filter((evidenceItem) => evidenceItem.claimIds.includes(item.id)).map((evidenceItem) => evidenceItem.id),
  }));
}

export function buildP1ClaimEvidenceMatrix(
  claims: Claim[],
  sources: SourceRecord[],
  evidence: EvidenceItem[],
): ClaimEvidenceMatrixRow[] {
  linkEvidenceToClaims(claims, sources, evidence);
  const sourceById = new Map(sources.map((item) => [item.id, item]));
  return claims.map((claim) => {
    const related = evidence.filter((item) => item.claimIds.includes(claim.id) && item.userConfirmed);
    const supports = related.filter((item) => item.relation === 'supports');
    const contradicts = related.filter((item) => item.relation === 'contradicts');
    const context = related.filter((item) => item.relation === 'context');
    const trusted = (item: EvidenceItem) => {
      const source = sourceById.get(item.sourceId);
      return Boolean(
        source &&
        !source.userRejected &&
        ['A', 'B'].includes(source.credibilityTier) &&
        !['social_post', 'repost', 'commercial_content', 'unknown'].includes(source.sourceType),
      );
    };
    const trustedSupports = supports.filter(trusted);
    const trustedContradicts = contradicts.filter(trusted);
    const sourceGroups = new Set(
      trustedSupports.map((item) => {
        const source = sourceById.get(item.sourceId)!;
        return source.independenceGroupId || source.id;
      }),
    );
    const primarySourceCount = new Set(
      trustedSupports
        .filter((item) => {
          const source = sourceById.get(item.sourceId)!;
          return primaryTypes.has(source.sourceType) && source.credibilityTier === 'A' && item.directness === 'direct';
        })
        .map((item) => item.sourceId),
    ).size;
    const secondaryGroups = new Set(
      trustedSupports
        .filter((item) => {
          const source = sourceById.get(item.sourceId)!;
          return highQualitySecondary.has(source.sourceType) && ['A', 'B'].includes(source.credibilityTier);
        })
        .map((item) => sourceById.get(item.sourceId)!.independenceGroupId || item.sourceId),
    ).size;
    const scopeWarnings = trustedSupports.some((item) => {
      const source = sourceById.get(item.sourceId)!;
      return source.warnings.some((warning) => /旧版|过期|时间.*不一致|地域.*不一致|范围.*不一致/u.test(warning));
    });

    let verificationStatus: ClaimEvidenceMatrixRow['verificationStatus'] = 'unverified';
    let reasoning = '当前没有足以核实该主张的证据。';
    if (trustedSupports.length && trustedContradicts.length) {
      verificationStatus = 'conflicted';
      reasoning = '存在可信支持证据与可信反驳证据，系统保留冲突，不进行数量投票或自动裁决。';
    } else if (claim.type === 'hypothesis' || claim.type === 'prediction' || !claim.isUserConfirmed) {
      reasoning = '该项仍是工作假设或尚未由用户确认，不能自动升级为已核实事实。';
    } else if (!scopeWarnings && (primarySourceCount >= 1 || secondaryGroups >= 2)) {
      verificationStatus = 'verified';
      reasoning = primarySourceCount
        ? '一个直接且适用范围一致的 A 级原始来源支持该主张，且没有可信冲突。'
        : '至少两个相互独立的高质量二手来源支持该主张，且没有可信冲突。';
    } else if (trustedSupports.length > 0) {
      verificationStatus = 'partially_verified';
      reasoning = scopeWarnings
        ? '存在可靠支持材料，但时间、地域或适用范围与当前主张尚未完全一致。'
        : '存在一份可靠支持材料，但独立性、范围或直接性尚不足以完整核实。';
    }
    return {
      claimId: claim.id,
      supportingEvidenceIds: supports.map((item) => item.id),
      contradictingEvidenceIds: contradicts.map((item) => item.id),
      contextualEvidenceIds: context.map((item) => item.id),
      independentSourceGroupCount: sourceGroups.size,
      primarySourceCount,
      verificationStatus,
      reasoning,
      remainingWork: verificationStatus === 'verified' ? [] : verificationStatus === 'conflicted'
        ? ['核对来源的时间、地理、定义与适用范围差异。', '采访双方并取得可定位的原始文件或记录。']
        : [...claim.missingEvidence],
    };
  });
}
