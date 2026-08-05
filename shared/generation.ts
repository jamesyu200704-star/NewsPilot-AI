export interface BriefInput {
  topic: string;
  reportType: string;
  audience: string;
  scope: string;
  background: string;
}

export type StoryAngleId = 'people' | 'system' | 'trend';
export type GenerationMode = 'mock' | 'ollama' | 'qwen' | 'openai';

export type SearchSourceType = 'news' | 'policy' | 'data' | 'case';
export type SearchProviderName = 'mock' | 'brave';
export type SearchStatus = 'mock' | 'live' | 'failed';
export type KnowledgeKind =
  | 'news-value'
  | 'case-pattern'
  | 'interview-strategy';

export interface SearchResult {
  id: string;
  title: string;
  url: string;
  snippet: string;
  sourceName: string;
  sourceType: SearchSourceType;
  publishedAt?: string;
}

export interface KnowledgeMatch {
  id: string;
  kind: KnowledgeKind;
  title: string;
  summary: string;
  relevanceScore: number;
  tags: string[];
}

export interface RetrievalEvidence {
  id: string;
  origin: 'knowledge' | 'search';
  sourceType: SearchSourceType | KnowledgeKind;
  title: string;
  summary: string;
  relevanceScore: number;
  query?: string;
  sourceName?: string;
  sourceUrl?: string;
  publishedAt?: string;
}

export interface RetrievalContext {
  queries: string[];
  evidence: RetrievalEvidence[];
  searchProvider: SearchProviderName;
  searchStatus: SearchStatus;
  retrievedAt: string;
  notice?: string;
}

export type NewsTopicCategory =
  | 'education'
  | 'policy'
  | 'consumer'
  | 'technology'
  | 'general';

export type NewsValueDimensionId =
  | 'timeliness'
  | 'significance'
  | 'proximity'
  | 'conflict'
  | 'humanInterest'
  | 'interest';

export interface TopicAnalysis {
  category: NewsTopicCategory;
  summary: string;
  coreConflict: string;
  stakeholders: string[];
  evidenceGaps: string[];
}

export interface NewsValueDimension {
  id: NewsValueDimensionId;
  label: string;
  score: number;
  weight: number;
  rationale: string;
}

export interface NewsValueAssessment {
  dimensions: NewsValueDimension[];
  overallScore: number;
  confidence: 'low' | 'medium' | 'high';
  summary: string;
}

export interface NewsRuleMatch {
  id: string;
  title: string;
  reason: string;
}

export interface RuleDecision {
  matches: NewsRuleMatch[];
  requiredInterviewees: string[];
  requiredSources: string[];
  verificationPriorities: string[];
  riskFlags: string[];
}

export interface PlanningContext {
  input: BriefInput;
  topicAnalysis: TopicAnalysis;
  newsValueAssessment: NewsValueAssessment;
  ruleDecision: RuleDecision;
  retrievalContext: RetrievalContext;
}

export interface StoryAngle {
  id: StoryAngleId;
  title: string;
  perspective: string;
  newsValueScore: number;
  whyWorthReporting: string;
  newsValue: string[];
  interviewees: string[];
  interviewQuestions: string[];
  verificationChecklist: string[];
  risks: string[];
  nextActions: string[];
}

export interface GenerationContent {
  topicSummary: string;
  angles: StoryAngle[];
  dataNeeds: string[];
  verificationChecklist: string[];
  risks: string[];
  nextActions: string[];
}

export type FindingSeverity = 'low' | 'medium' | 'high';
export type ClaimStatus =
  | 'supported'
  | 'partially-supported'
  | 'unsupported'
  | 'needs-verification';

export interface FactCheckFinding {
  id: string;
  severity: FindingSeverity;
  category: 'source' | 'fabrication' | 'data' | 'ethics' | 'balance';
  claim: string;
  status: ClaimStatus;
  assessment: string;
  requiredAction: string;
  evidenceIds: string[];
}

export interface FactCheckReview {
  summary: string;
  findings: FactCheckFinding[];
  unsupportedClaims: string[];
  ethicsNotes: string[];
}

export interface RiskReviewItem {
  id: string;
  severity: FindingSeverity;
  category: 'privacy' | 'ethics' | 'legal' | 'balance' | 'safety';
  description: string;
  mitigation: string;
}

export interface RiskReview {
  overallRisk: FindingSeverity;
  releaseGate: 'hold' | 'proceed-with-verification';
  items: RiskReviewItem[];
}

export interface VerificationReview {
  factCheck: FactCheckReview;
  riskReview: RiskReview;
}

export interface EditorialDecision {
  disposition: 'needs-reporting' | 'ready-for-reporting';
  priorityAngleId: StoryAngleId;
  rationale: string;
  changes: string[];
  finalChecklist: string[];
}

export interface EditorialRevision {
  content: GenerationContent;
  decision: EditorialDecision;
}

export interface AgentTraceStep {
  agent: 'planning' | 'fact-check' | 'editor';
  status: 'completed' | 'fallback';
  mode: GenerationMode;
  summary: string;
}

export interface AgentReview {
  workflowVersion: 'news-agent-v1';
  verification: VerificationReview;
  editorial: EditorialDecision;
  trace: AgentTraceStep[];
}

export interface GenerationResult extends GenerationContent {
  topicAnalysis: TopicAnalysis;
  newsValueAssessment: NewsValueAssessment;
  ruleDecision: RuleDecision;
  retrievalContext: RetrievalContext;
  agentReview: AgentReview;
  generatedAt: string;
  mode: GenerationMode;
  fallbackNotice?: string;
}

const nonBlankPattern = '^.*\\S.*$';

const nonEmptyString = {
  type: 'string',
  minLength: 1,
  maxLength: 1600,
  pattern: nonBlankPattern,
} as const;

const boundedStringArray = (minItems: number, maxItems: number) => ({
  type: 'array',
  items: nonEmptyString,
  minItems,
  maxItems,
});

const fixedStringArray = (size: number) => boundedStringArray(size, size);

export const briefInputJsonSchema = {
  type: 'object',
  additionalProperties: false,
  properties: {
    topic: {
      type: 'string',
      minLength: 1,
      maxLength: 120,
      pattern: nonBlankPattern,
    },
    reportType: {
      type: 'string',
      minLength: 1,
      maxLength: 40,
      pattern: nonBlankPattern,
    },
    audience: { type: 'string', maxLength: 40 },
    scope: { type: 'string', maxLength: 40 },
    background: { type: 'string', maxLength: 600 },
  },
  required: ['topic', 'reportType', 'audience', 'scope', 'background'],
} as const;

export const storyAngleJsonSchema = {
  type: 'object',
  additionalProperties: false,
  properties: {
    id: { type: 'string', enum: ['people', 'system', 'trend'] },
    title: {
      type: 'string',
      minLength: 1,
      maxLength: 240,
      pattern: nonBlankPattern,
    },
    perspective: nonEmptyString,
    newsValueScore: { type: 'number', minimum: 0, maximum: 5 },
    whyWorthReporting: nonEmptyString,
    newsValue: fixedStringArray(3),
    interviewees: fixedStringArray(4),
    interviewQuestions: fixedStringArray(6),
    verificationChecklist: fixedStringArray(4),
    risks: fixedStringArray(3),
    nextActions: fixedStringArray(3),
  },
  required: [
    'id',
    'title',
    'perspective',
    'newsValueScore',
    'whyWorthReporting',
    'newsValue',
    'interviewees',
    'interviewQuestions',
    'verificationChecklist',
    'risks',
    'nextActions',
  ],
} as const;

export const topicAnalysisJsonSchema = {
  type: 'object',
  additionalProperties: false,
  properties: {
    category: {
      type: 'string',
      enum: ['education', 'policy', 'consumer', 'technology', 'general'],
    },
    summary: nonEmptyString,
    coreConflict: nonEmptyString,
    stakeholders: boundedStringArray(3, 24),
    evidenceGaps: boundedStringArray(2, 16),
  },
  required: [
    'category',
    'summary',
    'coreConflict',
    'stakeholders',
    'evidenceGaps',
  ],
} as const;

export const newsValueDimensionJsonSchema = {
  type: 'object',
  additionalProperties: false,
  properties: {
    id: {
      type: 'string',
      enum: [
        'timeliness',
        'significance',
        'proximity',
        'conflict',
        'humanInterest',
        'interest',
      ],
    },
    label: nonEmptyString,
    score: { type: 'number', minimum: 0, maximum: 5 },
    weight: { type: 'number', minimum: 0, maximum: 1 },
    rationale: nonEmptyString,
  },
  required: ['id', 'label', 'score', 'weight', 'rationale'],
} as const;

export const newsValueAssessmentJsonSchema = {
  type: 'object',
  additionalProperties: false,
  properties: {
    dimensions: {
      type: 'array',
      items: newsValueDimensionJsonSchema,
      minItems: 6,
      maxItems: 6,
    },
    overallScore: { type: 'number', minimum: 0, maximum: 10 },
    confidence: { type: 'string', enum: ['low', 'medium', 'high'] },
    summary: nonEmptyString,
  },
  required: ['dimensions', 'overallScore', 'confidence', 'summary'],
} as const;

export const newsRuleMatchJsonSchema = {
  type: 'object',
  additionalProperties: false,
  properties: {
    id: nonEmptyString,
    title: nonEmptyString,
    reason: nonEmptyString,
  },
  required: ['id', 'title', 'reason'],
} as const;

export const ruleDecisionJsonSchema = {
  type: 'object',
  additionalProperties: false,
  properties: {
    matches: {
      type: 'array',
      items: newsRuleMatchJsonSchema,
      minItems: 1,
      maxItems: 8,
    },
    requiredInterviewees: boundedStringArray(3, 24),
    requiredSources: boundedStringArray(2, 16),
    verificationPriorities: boundedStringArray(2, 16),
    riskFlags: boundedStringArray(2, 16),
  },
  required: [
    'matches',
    'requiredInterviewees',
    'requiredSources',
    'verificationPriorities',
    'riskFlags',
  ],
} as const;

export const retrievalEvidenceJsonSchema = {
  type: 'object',
  additionalProperties: false,
  properties: {
    id: nonEmptyString,
    origin: { type: 'string', enum: ['knowledge', 'search'] },
    sourceType: {
      type: 'string',
      enum: [
        'news',
        'policy',
        'data',
        'case',
        'news-value',
        'case-pattern',
        'interview-strategy',
      ],
    },
    title: nonEmptyString,
    summary: nonEmptyString,
    relevanceScore: { type: 'number', minimum: 0, maximum: 1 },
    query: nonEmptyString,
    sourceName: nonEmptyString,
    sourceUrl: {
      type: 'string',
      minLength: 8,
      maxLength: 2048,
      pattern: '^https?://.*$',
    },
    publishedAt: nonEmptyString,
  },
  required: [
    'id',
    'origin',
    'sourceType',
    'title',
    'summary',
    'relevanceScore',
  ],
} as const;

export const retrievalContextJsonSchema = {
  type: 'object',
  additionalProperties: false,
  properties: {
    queries: boundedStringArray(4, 6),
    evidence: {
      type: 'array',
      items: retrievalEvidenceJsonSchema,
      minItems: 1,
      maxItems: 16,
    },
    searchProvider: { type: 'string', enum: ['mock', 'brave'] },
    searchStatus: { type: 'string', enum: ['mock', 'live', 'failed'] },
    retrievedAt: { type: 'string', minLength: 1 },
    notice: {
      type: 'string',
      minLength: 1,
      maxLength: 240,
      pattern: nonBlankPattern,
    },
  },
  required: [
    'queries',
    'evidence',
    'searchProvider',
    'searchStatus',
    'retrievedAt',
  ],
} as const;

export const generationContentJsonSchema = {
  type: 'object',
  additionalProperties: false,
  properties: {
    topicSummary: {
      type: 'string',
      minLength: 1,
      maxLength: 800,
      pattern: nonBlankPattern,
    },
    angles: {
      type: 'array',
      items: storyAngleJsonSchema,
      minItems: 3,
      maxItems: 3,
    },
    dataNeeds: boundedStringArray(4, 10),
    verificationChecklist: boundedStringArray(4, 12),
    risks: boundedStringArray(3, 10),
    nextActions: boundedStringArray(3, 8),
  },
  required: [
    'topicSummary',
    'angles',
    'dataNeeds',
    'verificationChecklist',
    'risks',
    'nextActions',
  ],
} as const;

export const factCheckFindingJsonSchema = {
  type: 'object',
  additionalProperties: false,
  properties: {
    id: nonEmptyString,
    severity: { type: 'string', enum: ['low', 'medium', 'high'] },
    category: {
      type: 'string',
      enum: ['source', 'fabrication', 'data', 'ethics', 'balance'],
    },
    claim: nonEmptyString,
    status: {
      type: 'string',
      enum: [
        'supported',
        'partially-supported',
        'unsupported',
        'needs-verification',
      ],
    },
    assessment: nonEmptyString,
    requiredAction: nonEmptyString,
    evidenceIds: boundedStringArray(0, 6),
  },
  required: [
    'id',
    'severity',
    'category',
    'claim',
    'status',
    'assessment',
    'requiredAction',
    'evidenceIds',
  ],
} as const;

export const verificationReviewJsonSchema = {
  type: 'object',
  additionalProperties: false,
  properties: {
    factCheck: {
      type: 'object',
      additionalProperties: false,
      properties: {
        summary: nonEmptyString,
        findings: {
          type: 'array',
          items: factCheckFindingJsonSchema,
          minItems: 3,
          maxItems: 12,
        },
        unsupportedClaims: boundedStringArray(0, 10),
        ethicsNotes: boundedStringArray(2, 8),
      },
      required: ['summary', 'findings', 'unsupportedClaims', 'ethicsNotes'],
    },
    riskReview: {
      type: 'object',
      additionalProperties: false,
      properties: {
        overallRisk: { type: 'string', enum: ['low', 'medium', 'high'] },
        releaseGate: {
          type: 'string',
          enum: ['hold', 'proceed-with-verification'],
        },
        items: {
          type: 'array',
          minItems: 2,
          maxItems: 10,
          items: {
            type: 'object',
            additionalProperties: false,
            properties: {
              id: nonEmptyString,
              severity: { type: 'string', enum: ['low', 'medium', 'high'] },
              category: {
                type: 'string',
                enum: ['privacy', 'ethics', 'legal', 'balance', 'safety'],
              },
              description: nonEmptyString,
              mitigation: nonEmptyString,
            },
            required: [
              'id',
              'severity',
              'category',
              'description',
              'mitigation',
            ],
          },
        },
      },
      required: ['overallRisk', 'releaseGate', 'items'],
    },
  },
  required: ['factCheck', 'riskReview'],
} as const;

export const editorialDecisionJsonSchema = {
  type: 'object',
  additionalProperties: false,
  properties: {
    disposition: {
      type: 'string',
      enum: ['needs-reporting', 'ready-for-reporting'],
    },
    priorityAngleId: { type: 'string', enum: ['people', 'system', 'trend'] },
    rationale: nonEmptyString,
    changes: boundedStringArray(2, 8),
    finalChecklist: boundedStringArray(4, 12),
  },
  required: [
    'disposition',
    'priorityAngleId',
    'rationale',
    'changes',
    'finalChecklist',
  ],
} as const;

export const editorialRevisionJsonSchema = {
  type: 'object',
  additionalProperties: false,
  properties: {
    content: generationContentJsonSchema,
    decision: editorialDecisionJsonSchema,
  },
  required: ['content', 'decision'],
} as const;

export const agentReviewJsonSchema = {
  type: 'object',
  additionalProperties: false,
  properties: {
    workflowVersion: { type: 'string', enum: ['news-agent-v1'] },
    verification: verificationReviewJsonSchema,
    editorial: editorialDecisionJsonSchema,
    trace: {
      type: 'array',
      minItems: 3,
      maxItems: 3,
      items: {
        type: 'object',
        additionalProperties: false,
        properties: {
          agent: {
            type: 'string',
            enum: ['planning', 'fact-check', 'editor'],
          },
          status: { type: 'string', enum: ['completed', 'fallback'] },
          mode: { type: 'string', enum: ['mock', 'ollama', 'qwen', 'openai'] },
          summary: nonEmptyString,
        },
        required: ['agent', 'status', 'mode', 'summary'],
      },
    },
  },
  required: ['workflowVersion', 'verification', 'editorial', 'trace'],
} as const;

export const generationResultJsonSchema = {
  type: 'object',
  additionalProperties: false,
  properties: {
    ...generationContentJsonSchema.properties,
    topicAnalysis: topicAnalysisJsonSchema,
    newsValueAssessment: newsValueAssessmentJsonSchema,
    ruleDecision: ruleDecisionJsonSchema,
    retrievalContext: retrievalContextJsonSchema,
    agentReview: agentReviewJsonSchema,
    generatedAt: { type: 'string', minLength: 1 },
    mode: { type: 'string', enum: ['mock', 'ollama', 'qwen', 'openai'] },
    fallbackNotice: {
      type: 'string',
      minLength: 1,
      maxLength: 240,
      pattern: nonBlankPattern,
    },
  },
  required: [
    ...generationContentJsonSchema.required,
    'topicAnalysis',
    'newsValueAssessment',
    'ruleDecision',
    'retrievalContext',
    'agentReview',
    'generatedAt',
    'mode',
  ],
} as const;
