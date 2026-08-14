import type {
  ClaimEvidenceMatrix,
  EvidenceRecord,
  VerificationStatus,
} from '../shared/学生报道模型.js';

const unique = <T>(items: T[]) => [...new Set(items)];

const independentPublishers = (items: EvidenceRecord[]) =>
  unique(items.map((item) => item.publisher.trim()).filter(Boolean)).length;

const resolveStatus = (
  supports: EvidenceRecord[],
  contradicts: EvidenceRecord[],
): VerificationStatus => {
  if (supports.length > 0 && contradicts.length > 0) return 'conflicted';
  if (supports.length === 0 && contradicts.length > 0) return 'conflicted';
  const usable = supports.filter(
    (item) => item.sourceType !== 'social_post' && item.credibilityTier !== 'lead_only',
  );
  const hasPrimary = usable.some((item) => item.sourceType === 'primary_document');
  if (hasPrimary || independentPublishers(usable) >= 2) return 'verified';
  if (usable.length > 0) return 'partially_verified';
  return 'unverified';
};

export const buildClaimEvidenceMatrix = (
  claims: string[],
  evidence: EvidenceRecord[],
): ClaimEvidenceMatrix[] =>
  claims.map((claim) => {
    const supports = evidence.filter((item) => item.supports.includes(claim));
    const contradicts = evidence.filter((item) => item.contradicts.includes(claim));
    const linked = unique([...supports, ...contradicts].map((item) => item.id));
    const status = resolveStatus(supports, contradicts);
    const remainingWork =
      status === 'verified'
        ? []
        : status === 'conflicted'
          ? ['回到原始来源核对时间、定义和适用范围，并分别向冲突来源求证。']
          : status === 'partially_verified'
            ? ['补充一个原始来源或第二个相互独立的可靠来源。']
            : ['尚无可靠证据；不得写成事实或生成引语。'];
    return {
      claim,
      requiredEvidence: ['一个原始来源，或两个相互独立的可靠来源'],
      linkedEvidenceIds: linked,
      status,
      remainingWork,
    };
  });
