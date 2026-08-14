import type {
  AssignmentType,
  ReportingBrief,
} from './学生报道模型.js';

export type AssignmentRequirementKey =
  | 'assignmentType'
  | 'deadline'
  | 'targetLength'
  | 'minimumInterviewees'
  | 'requiresDifferentSourceTypes'
  | 'requiresHumanStory'
  | 'requiresInterviewOutline'
  | 'requiresInterviewSummary'
  | 'formatRequirements'
  | 'otherHardConstraints';

export type RequirementConfidence = 'high' | 'medium' | 'low';
export type AssignmentRequirementValue =
  | AssignmentType
  | string
  | number
  | boolean
  | string[]
  | undefined;

export interface ExtractedAssignmentRequirement {
  key: AssignmentRequirementKey;
  label: string;
  value: AssignmentRequirementValue;
  evidence: string;
  confidence: RequirementConfidence;
  needsConfirmation: boolean;
  confirmed: boolean;
}

export interface AssignmentRequirementParseResult {
  rawText: string;
  fields: ExtractedAssignmentRequirement[];
  byKey: Record<AssignmentRequirementKey, ExtractedAssignmentRequirement>;
}

const labels: Record<AssignmentRequirementKey, string> = {
  assignmentType: '作业类型',
  deadline: '截止时间',
  targetLength: '字数要求',
  minimumInterviewees: '最少采访人数',
  requiresDifferentSourceTypes: '不同类型信源',
  requiresHumanStory: '人物故事',
  requiresInterviewOutline: '采访提纲',
  requiresInterviewSummary: '采访总结',
  formatRequirements: '格式要求',
  otherHardConstraints: '其他硬性约束',
};

const chineseNumbers: Record<string, number> = {
  一: 1,
  二: 2,
  两: 2,
  三: 3,
  四: 4,
  五: 5,
  六: 6,
  七: 7,
  八: 8,
  九: 9,
  十: 10,
};

const toNumber = (value: string) =>
  /^\d+$/u.test(value) ? Number(value) : chineseNumbers[value];

const sentences = (text: string) =>
  text
    .split(/(?<=[。！？；;\n])/u)
    .map((sentence) => sentence.trim())
    .filter(Boolean);

const evidenceFor = (text: string, pattern: RegExp) =>
  sentences(text).find((sentence) => pattern.test(sentence)) || '';

const isSuggestion = (evidence: string) => /建议|可选|视情况|酌情/u.test(evidence);

const field = (
  key: AssignmentRequirementKey,
  value: AssignmentRequirementValue,
  evidence: string,
  confidence: RequirementConfidence,
  needsConfirmation = confidence !== 'high',
): ExtractedAssignmentRequirement => ({
  key,
  label: labels[key],
  value,
  evidence: evidence || '原文中未找到明确依据',
  confidence,
  needsConfirmation,
  confirmed: false,
});

const parseAssignmentType = (text: string) => {
  const types: AssignmentType[] = [
    '人物特稿',
    '校园调查',
    '深度报道',
    '评论',
    '消息',
  ];
  const value = types.find((type) => text.includes(type));
  const evidence = value ? evidenceFor(text, new RegExp(value, 'u')) : '';
  return field('assignmentType', value, evidence, value ? 'high' : 'low');
};

const parseDeadline = (text: string) => {
  const match = text.match(
    /((?:20\d{2})[年/.\-](?:0?[1-9]|1[0-2])[月/.\-](?:0?[1-9]|[12]\d|3[01])日?)(?:\s*(\d{1,2}[:：]\d{2}))?/u,
  );
  if (!match) return field('deadline', undefined, '', 'low');
  const normalizedDate = match[1]
    .replace(/[年/.]/gu, '-')
    .replace(/月/gu, '-')
    .replace(/日/gu, '')
    .split('-')
    .map((part, index) => (index === 0 ? part : part.padStart(2, '0')))
    .join('-');
  const time = match[2]?.replace('：', ':');
  return field(
    'deadline',
    time ? `${normalizedDate}T${time}` : normalizedDate,
    evidenceFor(text, new RegExp(match[1].replace(/[.*+?^${}()|[\]\\]/gu, '\\$&'), 'u')),
    'high',
  );
};

const parseNumberField = (
  key: 'targetLength' | 'minimumInterviewees',
  text: string,
  pattern: RegExp,
) => {
  const match = text.match(pattern);
  const value = match?.[1] ? toNumber(match[1]) : undefined;
  return field(
    key,
    value,
    match ? evidenceFor(text, new RegExp(match[0].replace(/[.*+?^${}()|[\]\\]/gu, '\\$&'), 'u')) : '',
    value ? 'high' : 'low',
  );
};

const parseBooleanField = (
  key:
    | 'requiresDifferentSourceTypes'
    | 'requiresHumanStory'
    | 'requiresInterviewOutline'
    | 'requiresInterviewSummary',
  text: string,
  pattern: RegExp,
) => {
  const evidence = evidenceFor(text, pattern);
  if (!evidence) return field(key, undefined, '', 'low');
  const suggested = isSuggestion(evidence);
  const negativeWindow = evidence.match(
    new RegExp(`(?:不要求|无需|无须|不必|不用)[^。；，,]{0,10}${pattern.source}`, 'u'),
  );
  const explicitlyNotRequired = Boolean(negativeWindow);
  return field(
    key,
    !explicitlyNotRequired,
    evidence,
    suggested ? 'medium' : 'high',
    suggested,
  );
};

export function parseAssignmentRequirements(
  rawText: string,
): AssignmentRequirementParseResult {
  const text = rawText.trim();
  const formatMatch = text.match(/\b(Markdown|PDF|Word)\b|(?:小[一二三四五]|宋体|黑体|仿宋|行距|字号)[^。；\n]*/iu);
  const knownPatterns = /(?:人物特稿|校园调查|深度报道|评论|消息|截止|字|采访|信源|人物故事|Markdown|PDF|Word)/iu;
  const hardConstraints = sentences(text).filter(
    (sentence) => /必须|不得|严禁|硬性/u.test(sentence) && !knownPatterns.test(sentence),
  );
  const fields: ExtractedAssignmentRequirement[] = [
    parseAssignmentType(text),
    parseDeadline(text),
    parseNumberField('targetLength', text, /(\d{3,6})\s*字/u),
    parseNumberField(
      'minimumInterviewees',
      text,
      /(?:至少|最少|不得少于)\s*(?:采访\s*)?([一二两三四五六七八九十\d]+)\s*(?:名|位|人)/u,
    ),
    parseBooleanField(
      'requiresDifferentSourceTypes',
      text,
      /(?:不同|多种|多类)[^。；\n]{0,8}(?:类型)?信源/u,
    ),
    parseBooleanField('requiresHumanStory', text, /人物故事|人物经历|人物线索/u),
    parseBooleanField('requiresInterviewOutline', text, /采访提纲/u),
    parseBooleanField('requiresInterviewSummary', text, /采访总结/u),
    field(
      'formatRequirements',
      formatMatch?.[0],
      formatMatch ? evidenceFor(text, new RegExp(formatMatch[0], 'iu')) : '',
      formatMatch ? 'high' : 'low',
    ),
    field(
      'otherHardConstraints',
      hardConstraints,
      hardConstraints.join('；'),
      hardConstraints.length ? 'medium' : 'low',
      true,
    ),
  ];
  return {
    rawText,
    fields,
    byKey: Object.fromEntries(fields.map((item) => [item.key, item])) as Record<
      AssignmentRequirementKey,
      ExtractedAssignmentRequirement
    >,
  };
}

export function applyConfirmedAssignmentRequirements(
  brief: ReportingBrief,
  requirements: ExtractedAssignmentRequirement[],
): ReportingBrief {
  const next = { ...brief };
  for (const requirement of requirements) {
    if (!requirement.confirmed || requirement.value === undefined) continue;
    switch (requirement.key) {
      case 'assignmentType':
        next.assignmentType = requirement.value as AssignmentType;
        break;
      case 'deadline':
        next.deadline = String(requirement.value);
        break;
      case 'targetLength':
      case 'minimumInterviewees':
        next[requirement.key] = Number(requirement.value);
        break;
      case 'requiresDifferentSourceTypes':
      case 'requiresHumanStory':
      case 'requiresInterviewOutline':
      case 'requiresInterviewSummary':
        next[requirement.key] = Boolean(requirement.value);
        break;
      case 'formatRequirements':
        next.formatRequirements = String(requirement.value);
        break;
      case 'otherHardConstraints':
        next.otherHardConstraints = [...(requirement.value as string[])];
        break;
    }
  }
  return next;
}
