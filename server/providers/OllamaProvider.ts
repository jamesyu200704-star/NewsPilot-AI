import {
  editorialRevisionJsonSchema,
  generationContentJsonSchema,
  verificationReviewJsonSchema,
  type EditorialRevision,
  type GenerationContent,
  type PlanningContext,
  type VerificationReview,
} from '../../shared/generation.js';
import { buildFactCheckPrompt } from '../../prompts/事实核查提示词.js';
import { buildNewsEditorPrompt } from '../../prompts/新闻编辑提示词.js';
import { buildFinalEditorPrompt } from '../../prompts/新闻编辑终审提示词.js';
import { buildEditorialTaskPrompt } from '../../prompts/编辑任务提示词.js';
import {
  createMockEditorialTaskResult,
  editorialTaskResultJsonSchema,
  interviewPlanJsonSchema,
  normalizeInterviewPlan,
  type EditorialTaskRequest,
  type EditorialTaskResult,
  type InterviewPlan,
} from '../../shared/编辑任务模型.js';
import { OllamaClient, type OllamaFetchImplementation } from '../services/ollama.js';
import {
  assertEditorialRevision,
  assertGenerationContent,
  assertVerificationReview,
  assertEditorialTaskResult,
  assertInterviewPlan,
} from '../validation.js';
import type { GenerationProvider } from './GenerationProvider.js';
import type { EditorialTaskProvider } from './EditorialTaskProvider.js';

export interface OllamaProviderOptions {
  baseUrl: string;
  model: string;
  timeoutMs?: number;
  fetchImplementation?: OllamaFetchImplementation;
}

const withoutPatternKeywords = (value: unknown): unknown => {
  if (Array.isArray(value)) {
    return value.map(withoutPatternKeywords);
  }

  if (typeof value !== 'object' || value === null) {
    return value;
  }

  return Object.fromEntries(
    Object.entries(value)
      .filter(
        ([key]) =>
          key !== 'pattern' && key !== 'maxLength',
      )
      .map(([key, item]) => [key, withoutPatternKeywords(item)]),
  );
};

const isRecord = (value: unknown): value is Record<string, unknown> =>
  typeof value === 'object' && value !== null;

const restoreInvalidEditorialScores = (
  value: unknown,
  draft: GenerationContent,
): unknown => {
  if (!isRecord(value) || !isRecord(value.content)) {
    return value;
  }

  const content = value.content;
  if (!Array.isArray(content.angles)) {
    return value;
  }

  const draftScores = new Map(
    draft.angles.map((angle) => [angle.id, angle.newsValueScore]),
  );
  let changed = false;
  const angles = content.angles.map((angle) => {
    if (!isRecord(angle) || typeof angle.id !== 'string') {
      return angle;
    }

    const score = angle.newsValueScore;
    if (
      typeof score !== 'number' ||
      !Number.isFinite(score) ||
      (score >= 0 && score <= 5)
    ) {
      return angle;
    }

    const draftScore = draftScores.get(angle.id as GenerationContent['angles'][number]['id']);
    if (draftScore === undefined) {
      return angle;
    }

    changed = true;
    return { ...angle, newsValueScore: draftScore };
  });

  return changed
    ? { ...value, content: { ...content, angles } }
    : value;
};

const protectedFactPattern = /\d{1,4}年\d{1,2}月\d{1,2}日|\d{1,2}月\d{1,2}日|\d+(?:\.\d+)?比\d+(?:\.\d+)?|[零一二三四五六七八九十两]+比[零一二三四五六七八九十两]+|\d+(?:\.\d+)?(?:万|亿|%|％|人|元|点|时|分钟|小时|天|年|月|日|次|届|名|个)?|[零一二三四五六七八九十两]+点|(?:上|下|本|这)?周[一二三四五六日天]|今天|明天|昨日|昨天|当日|次日|今晚/gu;

const chineseDigitValues: Record<string, number> = {
  零: 0, 一: 1, 二: 2, 两: 2, 三: 3, 四: 4,
  五: 5, 六: 6, 七: 7, 八: 8, 九: 9,
};

const normalizeChineseHour = (fact: string) => {
  const match = fact.match(/^([零一二三四五六七八九十两]+)点$/u);
  if (!match) return fact;
  const numeral = match[1];
  const tenIndex = numeral.indexOf('十');
  if (tenIndex < 0) {
    const value = [...numeral].reduce((total, digit) => total * 10 + chineseDigitValues[digit], 0);
    return `${value}点`;
  }
  const tens = tenIndex === 0 ? 1 : chineseDigitValues[numeral[tenIndex - 1]];
  const units = tenIndex === numeral.length - 1 ? 0 : chineseDigitValues[numeral[tenIndex + 1]];
  return `${tens * 10 + units}点`;
};

const normalizeChineseNumber = (value: string) => {
  if (/^[零一二三四五六七八九十两]+$/u.test(value) === false) return value;
  if (value === '十') return '10';
  const tenIndex = value.indexOf('十');
  if (tenIndex < 0) return String([...value].reduce((total, digit) => total * 10 + chineseDigitValues[digit], 0));
  const tens = tenIndex === 0 ? 1 : chineseDigitValues[value[tenIndex - 1]];
  const units = tenIndex === value.length - 1 ? 0 : chineseDigitValues[value[tenIndex + 1]];
  return String(tens * 10 + units);
};

const normalizeProtectedFact = (fact: string) => {
  const score = fact.match(/^([零一二三四五六七八九十两]+)比([零一二三四五六七八九十两]+)$/u);
  return score ? `${normalizeChineseNumber(score[1])}比${normalizeChineseNumber(score[2])}` : normalizeChineseHour(fact);
};

const protectedFacts = (text: string) => new Map(
  (text.match(protectedFactPattern) || []).map((fact) => [normalizeProtectedFact(fact), fact]),
);

const orderedProtectedFacts = (text: string) =>
  (text.match(protectedFactPattern) || []).map(normalizeProtectedFact);

const assertPolishPreservesProtectedFacts = (sourceText: string, result: EditorialTaskResult) => {
  const sourceFacts = protectedFacts(sourceText);
  const outputFacts = protectedFacts(`${result.title}\n${result.output}`);
  const outputBodyFacts = protectedFacts(result.output);
  const invented = [...outputFacts].find(([fact]) => !sourceFacts.has(fact))?.[1];
  const omitted = [...sourceFacts].find(([fact]) => !outputBodyFacts.has(fact))?.[1];
  if (invented || omitted) {
    throw new Error(`语言润色改变了受保护事实：${invented ? `新增“${invented}”` : `遗漏“${omitted}”`}。`);
  }
};

const assertPolishChangesBody = (sourceText: string, result: EditorialTaskResult) => {
  const comparable = (text: string) => text.replace(/\s+/gu, '').trim();
  if (comparable(sourceText) === comparable(result.output)) {
    throw new Error('语言润色未对正文产生实际修改，请合并重复句、删除赘词并重新改写。');
  }
};

const assertMeaningTermsPreserved = (sourceText: string, result: EditorialTaskResult) => {
  const output = result.output;
  const quantifierGroups: Array<{ name: string; source: RegExp; output: RegExp; opposite: RegExp }> = [
    { name: '全部范围', source: /大家|所有|全体/u, output: /大家|所有|全体|与会人员|参会者/u, opposite: /部分|少数|个别/u },
    { name: '多数范围', source: /很多|多数/u, output: /很多|多数|大量|不少/u, opposite: /部分|少数|个别/u },
    { name: '部分范围', source: /部分|少数|个别/u, output: /部分|少数|个别/u, opposite: /大家一致|所有人|全体一致/u },
  ];
  for (const group of quantifierGroups) {
    if (group.source.test(sourceText) && (group.opposite.test(output) || !group.output.test(output))) {
      throw new Error(`语言润色改变了原稿中的事实关系或数量判断“${group.name}”。`);
    }
  }
  if (/大家(?!一致)/u.test(sourceText) && /大家一致|全体一致|所有人一致/u.test(output)) {
    throw new Error('语言润色强化了原稿没有的一致性判断。');
  }
  const sourceHasSupport = /支持|赞成|欢迎/u.test(sourceText);
  const sourceHasOpposition = /反对|不支持|质疑|不理解/u.test(sourceText);
  if (sourceHasSupport && sourceHasOpposition && (!/支持|赞成|欢迎/u.test(output) || !/反对|不支持|质疑|不理解/u.test(output))) {
    throw new Error('语言润色遗漏了原稿中相反的观点关系。');
  }
  if (sourceHasSupport && !sourceHasOpposition && /反对|不支持|质疑/u.test(output)) {
    throw new Error('语言润色新增了原稿没有的反对观点。');
  }
  if (sourceHasOpposition && !sourceHasSupport && /支持|赞成|欢迎/u.test(output)) {
    throw new Error('语言润色新增了原稿没有的支持观点。');
  }
};

const futureStatusPattern = (verb: string) =>
  new RegExp(`(?:计划|拟|准备|将于).{0,12}${verb}`, 'u');

const assertNoUnsupportedStatusShift = (sourceText: string, result: EditorialTaskResult) => {
  const output = `${result.title}\n${result.output}`;
  for (const verb of ['宣布', '发布', '举行', '发生', '完成', '启动', '开通', '取消']) {
    const futureStatus = futureStatusPattern(verb);
    if (sourceText.includes(verb) && !futureStatus.test(sourceText) && futureStatus.test(output)) {
      throw new Error(`编辑结果把原稿中已经发生的“${verb}”改成了计划发生。`);
    }
  }
};

const assertNoInferredOpeningRange = (sourceText: string, result: EditorialTaskResult) => {
  if (/闭馆时间/u.test(sourceText) && /开放时间(?:为|是).{0,20}(?:到|至)/u.test(result.output) && !/开放时间(?:为|是).{0,20}(?:到|至)/u.test(sourceText)) {
    throw new Error('编辑结果从闭馆时间推断了原稿没有提供的开放时段。');
  }
};

const assertNoInventedProtectedFacts = (sourceText: string, result: EditorialTaskResult) => {
  const sourceFacts = protectedFacts(sourceText);
  const outputFacts = protectedFacts(`${result.title}\n${result.output}`);
  const invented = [...outputFacts].find(([fact]) => !sourceFacts.has(fact))?.[1];
  if (invented) throw new Error(`编辑结果新增了原稿没有的事实项“${invented}”。`);
};

const assertProtectedFactOrder = (sourceText: string, result: EditorialTaskResult) => {
  const sourceFacts = orderedProtectedFacts(sourceText);
  const outputFacts = orderedProtectedFacts(result.output);
  let cursor = 0;
  for (const fact of sourceFacts) {
    const index = outputFacts.indexOf(fact, cursor);
    if (index < 0) throw new Error(`编辑结果遗漏或调换了原稿事实“${fact}”。`);
    cursor = index + 1;
  }
};

const assertCommentaryHasOpinion = (sourceText: string, result: EditorialTaskResult) => {
  const output = result.output;
  if (!/(应该|应当|值得|不能|不应|关键在于|需要|有必要|更重要的是|这说明|这意味着)/u.test(output)) {
    throw new Error('新闻评论只有事实摘要，没有形成明确的评论观点。');
  }
  assertProtectedFactOrder(sourceText, result);
};

const sentenceSupportRatio = (sentence: string, sourceText: string) => {
  const normalized = sentence.replace(/[^\p{Script=Han}A-Za-z0-9]/gu, '');
  if (normalized.length < 2) return 1;
  const pairs = Array.from({ length: normalized.length - 1 }, (_, index) => normalized.slice(index, index + 2));
  return pairs.filter((pair) => sourceText.includes(pair)).length / pairs.length;
};

const assertCommentaryGrounded = (sourceText: string, result: EditorialTaskResult) => {
  const factualAction = /正在|已经|已于|计划|拟|宣布|发布|表示|回应|决定|增设|增加|提供|实施|启动|推出|举行|完成|取消|发生|收集/u;
  const normativeOpinion = /应当|应该|不应|不能|有必要|值得|关键在于|需要/u;
  const unsupported = result.output
    .split(/[。！？\n]+/u)
    .map((sentence) => sentence.trim())
    .find((sentence) =>
      sentence.length >= 6 &&
      factualAction.test(sentence) &&
      !normativeOpinion.test(sentence) &&
      sentenceSupportRatio(sentence, sourceText) < 0.5,
    );
  if (unsupported) throw new Error(`新闻评论新增了原稿无法支持的事实陈述：“${unsupported}”。`);
};

const editNotes = (action: EditorialTaskRequest['action']) => action === 'structure'
  ? ['调整导语和段落顺序，突出关键事实。']
  : action === 'commentary'
    ? ['围绕原稿事实提炼评论观点。']
    : ['压缩重复表达，调整句式，使新闻语言更准确、简洁。'];

const createSafeEditorialFallback = (input: EditorialTaskRequest, reason: unknown): EditorialTaskResult => {
  const firstSentence = input.sourceText.trim().split(/[。！？!?]/u)[0]?.trim() || '新闻材料';
  void reason;
  const output = input.action === 'commentary'
    ? `${input.sourceText.trim()}\n\n评论：评价一项安排不能只看结果，也要看它回应了什么需求、带来哪些影响，以及执行中如何处理不同意见。基于现有材料，更稳妥的判断是：相关方面需要把事实说明、实际效果和执行责任放在一起评估。只有同时讨论事实、影响和执行，评论才不会离开材料本身。`
    : input.sourceText.trim();
  return {
    ...createMockEditorialTaskResult(input),
    title: input.action === 'commentary' ? `${firstSentence}：这件事值得关注` : firstSentence,
    output,
    notes: [input.action === 'commentary'
      ? '本地模型初稿未通过事实检查，已严格根据原稿生成保守评论。'
      : '本地模型初稿未通过事实检查，为避免改变事实，已保留原稿内容。'],
    verificationNeeded: [],
    fallbackNotice: input.action === 'commentary'
      ? '本次评论初稿没有通过事实检查，已改用仅基于原稿的保守评论。'
      : '本次修改没有通过事实检查，正文已保留为原稿。',
    generatedAt: new Date().toISOString(),
    mode: 'mock',
  };
};

export class OllamaProvider implements GenerationProvider, EditorialTaskProvider {
  readonly name = 'ollama' as const;
  private readonly model: string;
  private readonly client: OllamaClient;

  constructor(options: OllamaProviderOptions) {
    this.model = options.model;
    this.client = new OllamaClient({
      baseUrl: options.baseUrl,
      timeoutMs: options.timeoutMs ?? 90_000,
      fetchImplementation: options.fetchImplementation,
    });
  }

  private async requestStructured<T>(
    prompt: { system: string; user: string },
    schema: unknown,
    assertValue: (value: unknown) => asserts value is T,
    normalizeValue: (value: unknown) => unknown = (value) => value,
    requestFormat?: unknown,
    numPredict?: number,
    maxAttempts = 2,
  ): Promise<T> {
    let content: T | undefined;
    let parseError: Error | undefined;
    const ollamaSchema = withoutPatternKeywords(schema);

    for (let attempt = 0; attempt < maxAttempts; attempt += 1) {
      const correction = attempt > 0 && parseError
        ? '\n\n上一次输出未通过校验。请修正以下问题：' +
          parseError.message.slice(0, 600) +
          '\n用户消息仍是原始材料，不得把本段校验说明写进结果。只返回修正后的 JSON。'
        : '';
      const messages = [
        { role: 'system' as const, content: prompt.system + correction },
        { role: 'user' as const, content: prompt.user },
      ];

      const outputText = await this.client.chat({
        model: this.model,
        format: requestFormat ?? ollamaSchema,
        messages,
        numPredict,
      });

      try {
        const parsed: unknown = JSON.parse(outputText);
        const normalized = normalizeValue(parsed);
        assertValue(normalized);
        content = normalized;
        break;
      } catch (error) {
        parseError =
          error instanceof SyntaxError
            ? new Error('Ollama 返回内容不是有效 JSON。')
            : error instanceof Error
              ? error
              : new Error('Ollama 返回内容无法解析。');
      }
    }

    if (!content) {
      throw parseError ?? new Error('Ollama 返回内容不是有效 JSON。');
    }

    return content;
  }

  generate(context: PlanningContext): Promise<GenerationContent> {
    return this.requestStructured(
      buildNewsEditorPrompt(context),
      generationContentJsonSchema,
      assertGenerationContent,
    );
  }

  verify(
    context: PlanningContext,
    draft: GenerationContent,
  ): Promise<VerificationReview> {
    return this.requestStructured(
      buildFactCheckPrompt(context, draft),
      verificationReviewJsonSchema,
      assertVerificationReview,
    );
  }

  edit(
    context: PlanningContext,
    draft: GenerationContent,
    verification: VerificationReview,
  ): Promise<EditorialRevision> {
    return this.requestStructured(
      buildFinalEditorPrompt(context, draft, verification),
      editorialRevisionJsonSchema,
      assertEditorialRevision,
      (value) => restoreInvalidEditorialScores(value, draft),
    );
  }

  async runEditorialTask(
    input: EditorialTaskRequest,
  ): Promise<EditorialTaskResult> {
    if (input.taskType === 'interview') {
      const interviewPlan = await this.requestStructured<InterviewPlan>(
        buildEditorialTaskPrompt(input),
        interviewPlanJsonSchema,
        assertInterviewPlan,
        (value) => isRecord(value) ? normalizeInterviewPlan(
          value as unknown as InterviewPlan,
          input.sourceText,
          [input.sourceText, ...(input.research?.sources.flatMap((source) => [source.title, source.snippet]) || [])].join('\n'),
        ) : value,
        undefined,
        4096,
      );
      const base = createMockEditorialTaskResult(input);
      return {
        ...base,
        mode: this.name,
        generatedAt: new Date().toISOString(),
        interviewPlan,
      };
    }
    const assertNewsEditResult: (value: unknown) => asserts value is EditorialTaskResult = (value) => {
      assertEditorialTaskResult(value);
      if (input.action === 'polish') {
        assertPolishPreservesProtectedFacts(input.sourceText, value);
        assertPolishChangesBody(input.sourceText, value);
        assertNoUnsupportedStatusShift(input.sourceText, value);
        assertMeaningTermsPreserved(input.sourceText, value);
      } else if (input.action === 'structure') {
        assertPolishPreservesProtectedFacts(input.sourceText, value);
        assertNoUnsupportedStatusShift(input.sourceText, value);
        assertProtectedFactOrder(input.sourceText, value);
        assertNoInferredOpeningRange(input.sourceText, value);
      } else if (input.action === 'commentary') {
        assertNoInventedProtectedFacts(input.sourceText, value);
        assertNoUnsupportedStatusShift(input.sourceText, value);
        assertCommentaryGrounded(input.sourceText, value);
        assertCommentaryHasOpinion(input.sourceText, value);
      }
    };
    const taskPrompt = buildEditorialTaskPrompt(input);
    const facts = [...protectedFacts(input.sourceText).values()];
    if (facts.length > 0) {
      taskPrompt.system += `本稿必须保留的事实项：${facts.join('、')}。可以统一数字书写形式，但不得遗漏、调换顺序或改变含义。`;
    }
    let result: EditorialTaskResult;
    try {
      result = await this.requestStructured(
        taskPrompt,
        editorialTaskResultJsonSchema,
        assertNewsEditResult,
        (value) => {
          if (!isRecord(value)) return value;
          const fallback = createMockEditorialTaskResult(input);
          const normalized: Record<string, unknown> = {
            taskType: input.taskType,
            title: typeof value.title === 'string' && value.title.trim() ? value.title : fallback.title,
            output: typeof value.output === 'string' && value.output.trim() ? value.output : fallback.output,
            notes: editNotes(input.action),
            verificationNeeded:
              Array.isArray(value.verificationNeeded)
                ? value.verificationNeeded.filter((item) =>
                    typeof item === 'string' && item.trim() && !/^(?:无|暂无|没有|不需要|无需)$/u.test(item.trim()),
                  )
                : [],
            generatedAt: new Date().toISOString(),
            mode: this.name,
          };
          return normalized;
        },
        undefined,
        undefined,
        4,
      );
    } catch (error) {
      result = createSafeEditorialFallback(input, error);
    }
    return { ...result, taskType: input.taskType };
  }
}
