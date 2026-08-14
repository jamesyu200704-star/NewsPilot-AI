import type { Claim, ConflictRecord, ConflictType, EvidenceItem, SourceRecord } from './证据领域模型.js';

const classifyConflict = (claim: Claim, support: EvidenceItem[], contradict: EvidenceItem[]): ConflictType => {
  const text = `${claim.text} ${support.map((item) => item.excerpt).join(' ')} ${contradict.map((item) => item.excerpt).join(' ')}`;
  if (/\d+(?:\.\d+)?\s*(?:%|人|名|元|次|件|例|万|亿)/u.test(text)) return 'numeric';
  if (/\d{4}[年\-/]|学期|今日|昨日|此前|当前|自.*起/u.test(text)) return 'temporal';
  if (/所有|全部|本课程|学校层面|校区|适用|范围|部分/u.test(text)) return 'scope';
  if (/定义|所称|是指/u.test(text)) return 'definition';
  if (/因为|原因|导致|造成/u.test(text)) return 'causal';
  if (/规定|允许|禁止|要求/u.test(text)) return 'rule_description';
  return 'testimony';
};

export function detectEvidenceConflicts(
  claims: Claim[],
  sources: SourceRecord[],
  evidence: EvidenceItem[],
): ConflictRecord[] {
  const sourceIds = new Set(sources.filter((item) =>
    !item.userRejected &&
    ['A', 'B'].includes(item.credibilityTier) &&
    !['social_post', 'repost', 'commercial_content', 'unknown'].includes(item.sourceType),
  ).map((item) => item.id));
  return claims.flatMap((claim, index) => {
    const related = evidence.filter((item) => item.claimIds.includes(claim.id) && item.userConfirmed && sourceIds.has(item.sourceId));
    const supports = related.filter((item) => item.relation === 'supports');
    const contradicts = related.filter((item) => item.relation === 'contradicts');
    if (!supports.length || !contradicts.length) return [];
    const type = classifyConflict(claim, supports, contradicts);
    return [{
      id: `CF-${String(index + 1).padStart(3, '0')}`,
      claimId: claim.id,
      type,
      supportingEvidenceIds: supports.map((item) => item.id),
      contradictingEvidenceIds: contradicts.map((item) => item.id),
      explanation: `来源对“${claim.text}”存在实质分歧；可能涉及${type === 'scope' ? '适用范围或规则层级' : type === 'numeric' ? '统计口径或数值' : type === 'temporal' ? '时间点' : '定义与陈述'}差异，系统不自动裁决。`,
      possibleScopeDifference: type === 'scope',
      nextSteps: type === 'scope'
        ? ['核对各来源的适用范围、校区、课程和规则层级。', '取得双方使用的原始文件并采访规则制定者与执行者。']
        : ['核对来源定义、时间、样本和原始记录。', '采访分歧双方并保留冲突说明。'],
      status: 'open',
    } satisfies ConflictRecord];
  });
}
