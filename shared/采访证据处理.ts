import type { EvidenceItem } from './证据领域模型.js';
import type { SourceRecord } from './证据领域模型.js';
import type {
  EvidenceGap,
  InterviewNote,
  QuoteCandidate,
  ReportingLead,
  ReportingTask,
  TranscriptSegment,
  InterviewSource,
} from './报道执行模型.js';

export interface InterviewEvidenceInput {
  sessionId: string;
  sourceId: string;
  notes: InterviewNote[];
  transcriptSegments: TranscriptSegment[];
  now?: string;
}

export interface InterviewClaimCandidate {
  id: string;
  sourceId: string;
  sessionId: string;
  text: string;
  sourceNoteId?: string;
  sourceTranscriptSegmentId?: string;
  status: 'attributed_unverified';
}

export interface InterviewEvidenceResult {
  claimCandidates: InterviewClaimCandidate[];
  quoteCandidates: QuoteCandidate[];
  leads: ReportingLead[];
  evidenceItems: EvidenceItem[];
  reviewWarnings: string[];
}

export function processInterviewEvidence(input: InterviewEvidenceInput): InterviewEvidenceResult {
  const timestamp = input.now || new Date().toISOString();
  const confirmedNotes = input.notes.filter((note) => note.reviewStatus === 'confirmed');
  const claimCandidates = confirmedNotes
    .filter((note) => ['fact', 'direct_quote', 'paraphrase', 'contradiction'].includes(note.kind))
    .map((note, index) => ({
      id: `interview-claim-${input.sessionId}-${index + 1}`,
      sourceId: input.sourceId,
      sessionId: input.sessionId,
      text: note.text,
      sourceNoteId: note.id,
      status: 'attributed_unverified' as const,
    }));

  const quoteCandidates: QuoteCandidate[] = confirmedNotes
    .filter((note) => note.kind === 'direct_quote' && !note.isPrivate && !note.isOffRecord)
    .map((note, index) => ({
      id: `quote-${input.sessionId}-note-${index + 1}`,
      sourceId: input.sourceId,
      sessionId: input.sessionId,
      text: note.text.replace(/^[“"]|[”"]$/gu, ''),
      sourceNoteId: note.id,
      capturedAt: note.capturedAt,
      reviewStatus: 'candidate',
      attributionMode: 'unconfirmed',
      isOffRecord: note.isOffRecord,
      isPrivate: note.isPrivate,
      withdrawn: false,
    }));

  const reviewWarnings: string[] = [];
  for (const segment of input.transcriptSegments) {
    if ((segment.confidence ?? 1) < 0.7) reviewWarnings.push(`低置信度片段 ${segment.id} 必须人工校正。`);
    if (segment.sensitiveTermFlags.length) reviewWarnings.push(`片段 ${segment.id} 含姓名、数字、机构或专有词，必须逐字复核。`);
    if (
      segment.reviewStatus === 'confirmed' ||
      segment.reviewStatus === 'corrected'
    ) {
      if ((segment.confidence ?? 1) >= 0.7 && !segment.sensitiveTermFlags.length) {
        quoteCandidates.push({
          id: `quote-${input.sessionId}-segment-${segment.id}`,
          sourceId: input.sourceId,
          sessionId: input.sessionId,
          text: segment.text,
          sourceTranscriptSegmentId: segment.id,
          capturedAt: timestamp,
          reviewStatus: 'candidate',
          attributionMode: 'unconfirmed',
          isOffRecord: false,
          isPrivate: false,
          withdrawn: false,
        });
      }
    }
  }

  const leads: ReportingLead[] = confirmedNotes
    .filter((note) => note.kind === 'new_lead' || note.kind === 'follow_up')
    .map((note, index) => ({
      id: `lead-${input.sessionId}-${index + 1}`,
      sessionId: input.sessionId,
      sourceId: input.sourceId,
      text: note.text,
      status: 'new',
      relatedClaimIds: [],
      createdAt: timestamp,
    }));

  return { claimCandidates, quoteCandidates, leads, evidenceItems: [], reviewWarnings };
}

export function promoteInterviewCandidateToEvidence(input: {
  candidate: InterviewClaimCandidate;
  source: InterviewSource;
  claimId: string;
  relation: EvidenceItem['relation'];
  userConfirmed: boolean;
  now?: string;
}): { sourceRecord: SourceRecord; evidenceItem: EvidenceItem } {
  if (!input.userConfirmed) throw new Error('采访材料必须由用户确认后才能进入证据工作区。');
  if (!input.claimId.trim()) throw new Error('采访材料必须绑定待核验主张。');
  const timestamp = input.now || new Date().toISOString();
  const sourceId = `interview-source-${input.source.id}`;
  const sourceRecord: SourceRecord = {
    id: sourceId,
    title: `采访记录｜${input.source.publicLabel || input.source.role}`,
    publisher: input.source.publicLabel || input.source.role,
    retrievedAt: timestamp,
    sourceType: 'interview_material',
    credibilityTier: 'unrated',
    independenceGroupId: `interview-${input.source.id}`,
    originStatus: 'resolved',
    isLikelyRepost: false,
    shortSummary: '经记者确认纳入的受访者陈述；仍是归因陈述，不等于已核实事实。',
    excerpt: input.candidate.text.slice(0, 500),
    supportsClaimIds: input.relation === 'supports' ? [input.claimId] : [],
    contradictsClaimIds: input.relation === 'contradicts' ? [input.claimId] : [],
    userAccepted: true,
    userRejected: false,
    extractionStatus: 'success',
    warnings: ['采访陈述须归因，并用原始文件、对方回应或独立来源继续核验。'],
    classificationHistory: [{
      at: timestamp,
      actor: 'rules',
      sourceType: 'interview_material',
      credibilityTier: 'unrated',
      reason: '采访材料不会被自动评级或认定为事实。',
    }],
  };
  const evidenceItem: EvidenceItem = {
    id: `interview-evidence-${input.candidate.id}`,
    sourceId,
    excerpt: input.candidate.text.slice(0, 500),
    normalizedMeaning: input.candidate.text.slice(0, 500),
    relation: input.relation,
    claimIds: [input.claimId],
    directness: 'direct',
    userConfirmed: true,
    createdAt: timestamp,
  };
  return { sourceRecord, evidenceItem };
}

const gapCompletionCriteria: Record<EvidenceGap['type'], string> = {
  original_document: '取得并保存可定位的原始文件，或记录无法取得的原因。',
  party_response: '取得当事方回应，或记录拒绝、明确未回复时间和已尝试渠道。',
  opposing_view: '取得不同立场的可归因回应，或说明未能取得的原因。',
  data: '取得带口径、时间范围和出处的数据，或放弃相关数字主张。',
  corroboration: '取得独立佐证，或把该说法保留为未核实的受访者陈述。',
  timeline: '核对至少两个可定位时间节点并解释差异。',
  scope_mismatch: '统一主张和证据的时间、地域与人群范围。',
  numeric_conflict: '定位冲突数字的原始口径，不自动选择较大或较新数值。',
  source_unreachable: '完成至少两种联系渠道尝试并记录替代来源。',
  quote_unconfirmed: '回听或逐字复核并确认归因；否则不得作为直接引语。',
  anonymous_source_risk: '记录匿名必要性、身份核验方式和编辑风险判断。',
  attribution_unconfirmed: '与受访者确认 named、anonymous、background 或 off-record 边界。',
};

export function createEvidenceGapTasks(
  gaps: EvidenceGap[],
  timestamp = new Date().toISOString(),
): ReportingTask[] {
  return gaps
    .filter((gap) => gap.status === 'open' || gap.status === 'in_progress')
    .map((gap, index) => ({
      id: `task-gap-${gap.id}`,
      title: `关闭证据缺口：${gap.description}`,
      description: gap.requiredAction,
      type: 'close_evidence_gap',
      status: gap.status === 'in_progress' ? 'in_progress' : 'todo',
      priority: 'critical',
      dueAt: timestamp,
      estimatedMinutes: 45,
      dependencyIds: [],
      sourceIds: gap.sourceIds || [],
      claimIds: [...gap.claimIds],
      evidenceGapIds: [gap.id],
      completionCriteria: gapCompletionCriteria[gap.type],
      isTodayFocus: index < 3,
      order: index + 1,
      createdAt: timestamp,
      updatedAt: timestamp,
    }));
}
