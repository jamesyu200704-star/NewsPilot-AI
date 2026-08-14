import type { GenerationMode, NewsValueAssessment } from './generation.js';

export type ReportingMode = 'course' | 'campus_media';
export type AssignmentType =
  | '消息'
  | '人物特稿'
  | '校园调查'
  | '深度报道'
  | '评论'
  | '其他';
export type VerdictStatus = 'GO' | 'REVISE' | 'HOLD' | 'DROP';
export type Accessibility = 'high' | 'medium' | 'low';
export type VerificationStatus =
  | 'verified'
  | 'partially_verified'
  | 'unverified'
  | 'conflicted';

export interface ReportingBrief {
  mode: ReportingMode;
  rawTopic: string;
  assignmentType: AssignmentType;
  courseName?: string;
  platform?: string;
  deadline?: string;
  publishAt?: string;
  targetLength?: number;
  minimumInterviewees?: number;
  geographicScope?: string;
  targetAudience?: string;
  availableInterviewees: string[];
  existingMaterials: string[];
  reportingResources: string[];
  ethicalConstraints: string[];
  teacherRequirements?: string;
  assignmentRequirementsText?: string;
  campusFocus?: string;
  currentHook?: string;
  requiresDifferentSourceTypes?: boolean;
  requiresHumanStory?: boolean;
  requiresInterviewOutline?: boolean;
  requiresPlanningDocument?: boolean;
  requiresInterviewSummary?: boolean;
  formatRequirements?: string;
  otherHardConstraints?: string[];
}

export interface TopicFrame {
  rawTopic: string;
  newsQuestion: string;
  workingHypothesis: string;
  knownFacts: string[];
  assumptions: string[];
  unknowns: string[];
  verificationNeeds: string[];
}

export interface Verdict {
  status: VerdictStatus;
  reasons: string[];
  greatestStrength: string;
  greatestRisk: string;
  narrowingAdvice: string;
  minimumViableVersion: string;
}

export interface StrategyCard {
  id: string;
  name: string;
  suitableFor: string[];
  unsuitableFor: string[];
  requiredEvidence: string[];
  minimumSources: string[];
  commonRisks: string[];
  recommendedStructure: string[];
  studentFeasibilityNotes: string[];
  signals: string[];
  minimumInterviewRequirements: string[];
  minimumEvidenceRequirements: string[];
  recommendedInterviewees: string[];
  failureModes: string[];
  ethicalRisks: string[];
  studentDifficulty: 'low' | 'medium' | 'high';
  minimumWorkDays: number;
  basis: {
    summary: string;
    sourceStatus: '已人工审核' | '待人工审核';
    sourceReferences: string[];
  };
}

export interface AngleScore {
  newsValue: number;
  audienceRelevance: number;
  sourceAccessibility: number;
  evidenceAvailability: number;
  deadlineFeasibility: number;
  scenePotential: number;
  ethicalSafety: number;
}

export interface CandidateAngle {
  id: string;
  strategyId: string;
  strategyName: string;
  title: string;
  question: string;
  rationale: string;
  coreConflict: string;
  score: AngleScore;
  totalScore: number;
  evidenceNeeded: string[];
  sourceRoles: string[];
  feasibilityNote: string;
  risks: string[];
}

export interface SourceMapItem {
  id: string;
  role: string;
  informationValue: string;
  relationshipToTopic: string;
  accessibility: Accessibility;
  possibleBias: string;
  alternativeSources: string[];
  verificationTargets: string[];
}

export type InterviewStage =
  | '破冰问题'
  | '事实问题'
  | '经历问题'
  | '原因问题'
  | '冲突问题'
  | '验证问题'
  | '追问建议'
  | '收尾问题';

export interface InterviewQuestion {
  stage: InterviewStage;
  question: string;
  purpose: string;
  expectedEvidence: string;
  followUps: string[];
  risks: string[];
  isLeading: boolean;
  isDoubleBarreled: boolean;
}

export interface InterviewPlan {
  sourceId: string;
  sourceRole: string;
  questions: InterviewQuestion[];
}

export type EvidenceSourceType =
  | 'primary_document'
  | 'official_statement'
  | 'news_report'
  | 'academic_source'
  | 'social_post'
  | 'user_material';

export interface EvidenceRecord {
  id: string;
  title: string;
  publisher: string;
  author?: string;
  publishedAt?: string;
  url?: string;
  retrievedAt: string;
  sourceType: EvidenceSourceType;
  credibilityTier: 'A' | 'B' | 'C' | 'lead_only';
  summary: string;
  supports: string[];
  contradicts: string[];
  derivedFromEvidenceIds?: string[];
}

export interface ClaimEvidenceMatrix {
  claim: string;
  requiredEvidence: string[];
  linkedEvidenceIds: string[];
  status: VerificationStatus;
  remainingWork: string[];
}

export interface ActionItem {
  order: number;
  when: string;
  action: string;
  output: string;
}

export interface StudentReportingPlan {
  brief: ReportingBrief;
  assignmentSummary: string;
  topicFrame: TopicFrame;
  verdict: Verdict;
  newsValueAssessment: NewsValueAssessment;
  feasibilityScore: number;
  candidateAngles: CandidateAngle[];
  recommendedAngleId: string;
  sourceMap: SourceMapItem[];
  interviewPlans: InterviewPlan[];
  evidenceLedger: EvidenceRecord[];
  claimEvidenceMatrix: ClaimEvidenceMatrix[];
  factCheckChecklist: string[];
  ethicalRisks: string[];
  missingInformation: string[];
  actionPlan: ActionItem[];
  submissionChecklist: string[];
  generatedAt: string;
  mode: GenerationMode;
  fallbackNotice?: string;
}
