import type { SourceRecord } from './证据领域模型.js';

const trackingParameters = /^(?:utm_[a-z0-9_]+|spm|from|source|ref|referrer|fbclid|gclid|mc_[a-z0-9_]+)$/iu;

export function canonicalizeSourceUrl(value: string): string {
  const url = new URL(value);
  if (!['http:', 'https:'].includes(url.protocol)) throw new Error('来源 URL 只允许 HTTP 或 HTTPS。');
  url.protocol = url.protocol.toLowerCase();
  url.hostname = url.hostname.toLowerCase().replace(/^m\./u, '');
  url.hash = '';
  for (const key of [...url.searchParams.keys()]) {
    if (trackingParameters.test(key)) url.searchParams.delete(key);
  }
  url.searchParams.sort();
  url.pathname = url.pathname.replace(/\/{2,}/gu, '/').replace(/\/$/u, '') || '/';
  const text = url.toString();
  return text.endsWith('/') && !url.search ? text.slice(0, -1) : text;
}

const normalizeText = (value: string) =>
  value.toLowerCase().replace(/[\s\p{P}\p{S}]+/gu, '');

const bigrams = (value: string) => {
  const text = normalizeText(value);
  const result = new Set<string>();
  for (let index = 0; index < text.length - 1; index += 1) result.add(text.slice(index, index + 2));
  return result;
};

const similarity = (left: string, right: string) => {
  const a = bigrams(left);
  const b = bigrams(right);
  if (!a.size || !b.size) return 0;
  let intersection = 0;
  for (const value of a) if (b.has(value)) intersection += 1;
  return (2 * intersection) / (a.size + b.size);
};

export interface DuplicateMatch {
  sourceId: string;
  duplicateOfSourceId: string;
  kind: 'exact' | 'near' | 'repost';
  score: number;
}

export function identifyDuplicateSources(sources: SourceRecord[]): DuplicateMatch[] {
  const matches: DuplicateMatch[] = [];
  for (let index = 0; index < sources.length; index += 1) {
    for (let other = 0; other < index; other += 1) {
      const current = sources[index];
      const candidate = sources[other];
      const exact = Boolean(
        (current.contentHash && current.contentHash === candidate.contentHash) ||
        (current.canonicalUrl && current.canonicalUrl === candidate.canonicalUrl),
      );
      const score = Math.max(
        similarity(current.title, candidate.title),
        similarity(current.shortSummary, candidate.shortSummary),
      );
      const explicitRepost = current.isLikelyRepost || current.originSourceId === candidate.id ||
        /转载自|来源[:：]/u.test(`${current.excerpt || ''} ${current.shortSummary}`);
      if (exact || explicitRepost || score >= 0.82) {
        matches.push({
          sourceId: current.id,
          duplicateOfSourceId: candidate.id,
          kind: exact ? 'exact' : explicitRepost ? 'repost' : 'near',
          score: exact ? 1 : score,
        });
        break;
      }
    }
  }
  return matches;
}

export function groupIndependentSources(
  sources: SourceRecord[],
  duplicates = identifyDuplicateSources(sources),
): SourceRecord[] {
  const byId = new Map(sources.map((item) => [item.id, item]));
  const groups = new Map<string, string>();
  const resolve = (sourceId: string): string => {
    const duplicate = duplicates.find((item) => item.sourceId === sourceId);
    if (!duplicate) return `IG-${sourceId}`;
    return groups.get(duplicate.duplicateOfSourceId) || resolve(duplicate.duplicateOfSourceId);
  };
  return sources.map((item) => {
    const group = resolve(item.id);
    groups.set(item.id, group);
    const duplicate = duplicates.find((match) => match.sourceId === item.id);
    return {
      ...item,
      independenceGroupId: group,
      ...(duplicate ? {
        nearDuplicateGroupId: `DG-${duplicate.duplicateOfSourceId}`,
        originSourceId: item.originSourceId || byId.get(duplicate.duplicateOfSourceId)?.id,
        isLikelyRepost: duplicate.kind === 'repost' || item.isLikelyRepost,
      } : {}),
    };
  });
}
