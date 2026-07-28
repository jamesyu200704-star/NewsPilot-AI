export interface BriefInput {
  topic: string;
  reportType: string;
  audience: string;
  scope: string;
  background: string;
}

export type StoryAngleId = 'people' | 'system' | 'trend';
export type GenerationMode = 'mock' | 'ollama' | 'openai';

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
}

export interface GenerationResult extends GenerationContent {
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

const fixedStringArray = (size: number) => ({
  type: 'array',
  items: nonEmptyString,
  minItems: size,
  maxItems: size,
});

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
  },
  required: ['topicSummary', 'angles'],
} as const;

export const generationResultJsonSchema = {
  type: 'object',
  additionalProperties: false,
  properties: {
    ...generationContentJsonSchema.properties,
    generatedAt: { type: 'string', minLength: 1 },
    mode: { type: 'string', enum: ['mock', 'ollama', 'openai'] },
    fallbackNotice: {
      type: 'string',
      minLength: 1,
      maxLength: 240,
      pattern: nonBlankPattern,
    },
  },
  required: ['topicSummary', 'angles', 'generatedAt', 'mode'],
} as const;
