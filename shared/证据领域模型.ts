export type ClaimType =
  | 'fact'
  | 'opinion'
  | 'hypothesis'
  | 'allegation'
  | 'prediction'
  | 'statistic';

export type ClaimImportance = 'critical' | 'major' | 'minor';
export type P1VerificationStatus =
  | 'verified'
  | 'partially_verified'
  | 'unverified'
  | 'conflicted';

export interface Claim {
  id: string;
  text: string;
  type: ClaimType;
  importance: ClaimImportance;
  subject?: string;
  predicate?: string;
  object?: string;
  timeScope?: string;
  geographicScope?: string;
  source:
    | 'user_input'
    | 'assignment'
    | 'generated_plan'
    | 'interview_note'
    | 'uploaded_material'
    | 'search_result';
  isUserConfirmed: boolean;
  evidenceIds: string[];
  verificationStatus: P1VerificationStatus | 'not_applicable';
  missingEvidence: string[];
  createdAt: string;
  updatedAt: string;
}

export type SourceType =
  | 'primary_document'
  | 'official_statement'
  | 'official_data'
  | 'academic_source'
  | 'news_report'
  | 'interview_material'
  | 'user_material'
  | 'social_post'
  | 'commercial_content'
  | 'repost'
  | 'unknown';

export type CredibilityTier = 'A' | 'B' | 'C' | 'lead_only' | 'unrated';

export interface SourceClassificationHistory {
  at: string;
  actor: 'rules' | 'user';
  sourceType: SourceType;
  credibilityTier: CredibilityTier;
  reason: string;
}

export interface SourceRecord {
  id: string;
  title: string;
  url?: string;
  canonicalUrl?: string;
  domain?: string;
  publisher?: string;
  author?: string;
  publishedAt?: string;
  updatedAt?: string;
  retrievedAt: string;
  sourceType: SourceType;
  credibilityTier: CredibilityTier;
  language?: string;
  contentHash?: string;
  nearDuplicateGroupId?: string;
  independenceGroupId?: string;
  originSourceId?: string;
  originStatus?: 'resolved' | 'origin_unresolved';
  isLikelyRepost: boolean;
  shortSummary: string;
  excerpt?: string;
  pageNumber?: number;
  sectionTitle?: string;
  supportsClaimIds: string[];
  contradictsClaimIds: string[];
  userAccepted: boolean;
  userRejected: boolean;
  extractionStatus: 'success' | 'partial' | 'failed' | 'metadata_only';
  warnings: string[];
  classificationHistory: SourceClassificationHistory[];
}

export interface EvidenceItem {
  id: string;
  sourceId: string;
  excerpt: string;
  normalizedMeaning: string;
  location?: {
    pageNumber?: number;
    paragraphIndex?: number;
    sectionTitle?: string;
    anchor?: string;
  };
  relation: 'supports' | 'contradicts' | 'context' | 'not_relevant';
  claimIds: string[];
  directness: 'direct' | 'indirect' | 'interpretive';
  userConfirmed: boolean;
  createdAt: string;
}

export interface SearchQuery {
  id: string;
  claimIds: string[];
  query: string;
  purpose: string;
  targetSourceTypes: SourceType[];
  preferredDomains?: string[];
  timeRange?: { from?: string; to?: string };
  priority: 'high' | 'medium' | 'low';
  userEditable: boolean;
}

export interface SearchPlan {
  id: string;
  projectId: string;
  topic: string;
  queries: SearchQuery[];
  createdAt: string;
  generatedBy: 'rules' | 'local_llm' | 'user' | 'hybrid';
}

export interface ClaimEvidenceMatrixRow {
  claimId: string;
  supportingEvidenceIds: string[];
  contradictingEvidenceIds: string[];
  contextualEvidenceIds: string[];
  independentSourceGroupCount: number;
  primarySourceCount: number;
  verificationStatus: P1VerificationStatus;
  reasoning: string;
  remainingWork: string[];
}

export type ConflictType =
  | 'numeric'
  | 'temporal'
  | 'rule_description'
  | 'testimony'
  | 'scope'
  | 'definition'
  | 'causal';

export interface ConflictRecord {
  id: string;
  claimId: string;
  type: ConflictType;
  supportingEvidenceIds: string[];
  contradictingEvidenceIds: string[];
  explanation: string;
  possibleScopeDifference: boolean;
  nextSteps: string[];
  status: 'open' | 'resolved_by_user';
}

export interface UploadedMaterial {
  id: string;
  projectId: string;
  fileName: string;
  fileType: string;
  fileSize: number;
  contentHash: string;
  uploadedAt: string;
  extractionStatus: 'pending' | 'success' | 'partial' | 'failed';
  extractedText?: string;
  pageCount?: number;
  warnings: string[];
  sourceRecordId?: string;
}

export interface EvidenceWorkspaceState {
  schemaVersion: 1;
  claims: Claim[];
  searchPlan: SearchPlan | null;
  sources: SourceRecord[];
  evidence: EvidenceItem[];
  claimEvidenceMatrix: ClaimEvidenceMatrixRow[];
  conflicts: ConflictRecord[];
  uploadedMaterials: UploadedMaterial[];
  updatedAt: string;
}

export interface EvidenceWorkspaceExport extends EvidenceWorkspaceState {
  format: 'newspilot-evidence-workspace';
  exportedAt: string;
}
