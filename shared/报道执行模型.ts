export type ReportingTaskType =
  | 'define_angle'
  | 'research'
  | 'contact_source'
  | 'prepare_interview'
  | 'interview'
  | 'process_interview'
  | 'verify_claim'
  | 'close_evidence_gap'
  | 'build_outline'
  | 'assignment_check'
  | 'export_submission'
  | 'custom';

export type ReportingTaskStatus =
  | 'todo'
  | 'in_progress'
  | 'blocked'
  | 'done'
  | 'dropped';

export type ReportingTaskPriority = 'critical' | 'high' | 'medium' | 'low';

export interface ReportingTask {
  id: string;
  title: string;
  description: string;
  type: ReportingTaskType;
  status: ReportingTaskStatus;
  priority: ReportingTaskPriority;
  dueAt: string;
  estimatedMinutes: number;
  dependencyIds: string[];
  sourceIds: string[];
  claimIds: string[];
  evidenceGapIds: string[];
  completionCriteria: string;
  manualBlocker?: string;
  isTodayFocus: boolean;
  order: number;
  createdAt: string;
  updatedAt: string;
}

export type InterviewSourceStatus =
  | 'identified'
  | 'contact_drafted'
  | 'contacted'
  | 'responded'
  | 'scheduled'
  | 'interviewed'
  | 'follow_up_needed'
  | 'completed'
  | 'declined'
  | 'unreachable'
  | 'dropped';

export type InterviewSourceType =
  | 'student'
  | 'teacher'
  | 'expert'
  | 'school_administrator'
  | 'policy_maker'
  | 'affected_group'
  | 'business'
  | 'witness'
  | 'other';

export type SourceAccessibility = 'high' | 'medium' | 'low' | 'unknown';

export interface ContactMethod {
  type: 'email' | 'phone' | 'wechat' | 'in_person' | 'other';
  value: string;
  isPrivate: true;
}

export interface SourceAttribution {
  mode: 'named' | 'anonymous' | 'background' | 'off_record' | 'unconfirmed';
  publicLabel: string;
  identityPrivate: boolean;
}

export interface InterviewConsent {
  recordingAllowed: boolean;
  materialUseAllowed: boolean;
  attributionConfirmed: boolean;
  attributionMode: SourceAttribution['mode'];
  checkedAt?: string;
  notes?: string;
}

export interface InterviewSource {
  id: string;
  identity: string;
  publicLabel: string;
  role: string;
  sourceType: InterviewSourceType;
  status: InterviewSourceStatus;
  accessibility: SourceAccessibility;
  informationValue: string;
  relationshipToTopic: string;
  possibleBias: string;
  contactMethods: ContactMethod[];
  attribution: SourceAttribution;
  consent: InterviewConsent | null;
  alternativeSourceIds: string[];
  scheduledAt?: string;
  nextAction: string;
  privateNotes: string;
  createdAt: string;
  updatedAt: string;
}

export type OutreachTemplateType =
  | 'student'
  | 'teacher'
  | 'expert'
  | 'school_administrator'
  | 'commercial'
  | 'sensitive';

export interface OutreachAttempt {
  id: string;
  sourceId: string;
  channel: ContactMethod['type'];
  templateType: OutreachTemplateType;
  message: string;
  attemptedAt: string;
  responseStatus: 'not_recorded' | 'waiting' | 'accepted' | 'declined' | 'no_response';
  delivery: 'draft_only' | 'manual_record';
  followUpAt?: string;
  notes?: string;
}

export type InterviewQuestionCategory =
  | 'opening'
  | 'fact'
  | 'experience'
  | 'cause'
  | 'conflict'
  | 'verification'
  | 'follow_up'
  | 'closing';

export type QuestionRiskFlag =
  | 'leading'
  | 'double_barreled'
  | 'speculation'
  | 'too_broad'
  | 'attitude_only'
  | 'privacy'
  | 'duplicate'
  | 'irrelevant'
  | 'unbound';

export interface InterviewQuestion {
  id: string;
  sourceId: string;
  category: InterviewQuestionCategory;
  text: string;
  purpose: string;
  expectedEvidence: string;
  claimIds: string[];
  evidenceGapIds: string[];
  followUps: string[];
  riskFlags: QuestionRiskFlag[];
  order: number;
  userConfirmed: boolean;
}

export interface InterviewDebrief {
  confirmedPointIds: string[];
  newLeadIds: string[];
  unansweredQuestionIds: string[];
  conflictIds: string[];
  quoteCandidateIds: string[];
  nextSourceIds: string[];
  followUpTaskIds: string[];
  completedAt: string;
}

export interface InterviewSession {
  id: string;
  sourceId: string;
  status: 'planned' | 'scheduled' | 'in_progress' | 'review_required' | 'completed' | 'cancelled';
  purpose: string;
  scheduledAt?: string;
  startedAt?: string;
  endedAt?: string;
  consent: InterviewConsent | null;
  questionIds: string[];
  currentQuestionId?: string;
  transcriptId?: string;
  debrief?: InterviewDebrief;
  createdAt: string;
  updatedAt: string;
}

export type InterviewNoteKind =
  | 'fact'
  | 'direct_quote'
  | 'paraphrase'
  | 'contradiction'
  | 'follow_up'
  | 'new_lead'
  | 'not_answered';

export interface InterviewNote {
  id: string;
  sessionId: string;
  sourceId: string;
  questionId?: string;
  kind: InterviewNoteKind;
  text: string;
  capturedAt: string;
  audioTimestampMs?: number;
  reviewStatus: 'unreviewed' | 'confirmed' | 'rejected';
  isPrivate: boolean;
  isOffRecord: boolean;
}

export interface TranscriptSegment {
  id: string;
  transcriptId: string;
  speaker: string;
  text: string;
  startMs?: number;
  endMs?: number;
  confidence?: number;
  reviewStatus: 'unreviewed' | 'confirmed' | 'corrected' | 'rejected';
  sensitiveTermFlags: Array<'name' | 'number' | 'organization' | 'term'>;
}

export interface InterviewTranscript {
  id: string;
  sessionId: string;
  sourceId: string;
  provider: 'manual' | 'local_whisper';
  fileName?: string;
  mimeType?: string;
  status: 'draft' | 'review_required' | 'reviewed' | 'failed';
  segments: TranscriptSegment[];
  warnings: string[];
  createdAt: string;
  updatedAt: string;
}

export interface QuoteCandidate {
  id: string;
  sourceId: string;
  sessionId: string;
  text: string;
  sourceNoteId?: string;
  sourceTranscriptSegmentId?: string;
  capturedAt: string;
  reviewStatus: 'candidate' | 'confirmed' | 'rejected';
  attributionMode: SourceAttribution['mode'];
  isOffRecord: boolean;
  isPrivate: boolean;
  withdrawn: boolean;
}

export interface ReportingLead {
  id: string;
  sessionId: string;
  sourceId: string;
  text: string;
  status: 'new' | 'researching' | 'verified' | 'dropped';
  relatedClaimIds: string[];
  createdAt: string;
}

export type EvidenceGapType =
  | 'original_document'
  | 'party_response'
  | 'opposing_view'
  | 'data'
  | 'corroboration'
  | 'timeline'
  | 'scope_mismatch'
  | 'numeric_conflict'
  | 'source_unreachable'
  | 'quote_unconfirmed'
  | 'anonymous_source_risk'
  | 'attribution_unconfirmed';

export interface EvidenceGap {
  id: string;
  type: EvidenceGapType;
  claimIds: string[];
  sourceIds?: string[];
  description: string;
  status: 'open' | 'in_progress' | 'resolved' | 'accepted_risk' | 'dropped';
  requiredAction: string;
  resolutionNote?: string;
  createdAt: string;
  updatedAt: string;
}

export type StoryStructureType =
  | 'profile'
  | 'campus_phenomenon'
  | 'policy_implementation'
  | 'data_investigation'
  | 'hard_news'
  | 'change_story';

export interface StoryOutlineSection {
  id: string;
  title: string;
  purpose: string;
  materialIds: string[];
  claimIds: string[];
  quoteIds: string[];
  evidenceIds: string[];
  gapIds: string[];
  draftNotes: string;
  supportStatus: 'supported' | 'partial' | 'unsupported' | 'conflicted';
  order: number;
}

export interface StoryOutline {
  id: string;
  structureType: StoryStructureType;
  workingTitle: string;
  centralQuestion: string;
  sections: StoryOutlineSection[];
  updatedAt: string;
}

export type AssignmentCheckStatus = 'passed' | 'warning' | 'blocking' | 'not_applicable';

export interface AssignmentCheckItem {
  id: string;
  key:
    | 'assignment_type'
    | 'deadline'
    | 'minimum_interviews'
    | 'source_diversity'
    | 'protagonist'
    | 'different_views'
    | 'scene'
    | 'interview_guide'
    | 'interview_summary'
    | 'word_count'
    | 'critical_claims'
    | 'conflicts'
    | 'unconfirmed_quote'
    | 'off_record'
    | 'privacy'
    | 'file_format'
    | 'file_name';
  label: string;
  status: AssignmentCheckStatus;
  detail: string;
  action?: string;
}

export type ExportMode =
  | 'full_private_backup'
  | 'redacted_share'
  | 'course_submission'
  | 'open_demo';

export interface ExecutionWorkspaceState {
  schemaVersion: 1;
  tasks: ReportingTask[];
  sources: InterviewSource[];
  outreachAttempts: OutreachAttempt[];
  sessions: InterviewSession[];
  questions: InterviewQuestion[];
  notes: InterviewNote[];
  transcripts: InterviewTranscript[];
  quotes: QuoteCandidate[];
  leads: ReportingLead[];
  evidenceGaps: EvidenceGap[];
  outlines: StoryOutline[];
  assignmentChecks: AssignmentCheckItem[];
  updatedAt: string;
}
