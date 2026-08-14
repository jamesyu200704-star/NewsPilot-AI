export type ComparisonSource = 'newspilot' | 'general_model' | 'student';
export type AnonymousVariantId = '方案 A' | '方案 B' | '方案 C';

export interface BlindEvaluationItem {
  id: string;
  taskId: string;
  sourceType: ComparisonSource;
  anonymizedLabel: string;
  content: string;
  synthetic: boolean;
}

export interface BlindEvaluationScore {
  id: string;
  evaluatorCode: string;
  itemId: string;
  newsQuestionClarity: number;
  angleSpecificity: number;
  newsworthiness: number;
  studentFeasibility: number;
  intervieweeAccessibility: number;
  sourceMapCompleteness: number;
  interviewQuestionQuality: number;
  verificationQuality: number;
  ethicsAwareness: number;
  deadlineFeasibility: number;
  assignmentCompliance: number;
  rewriteEffort: number;
  overallPreference: number;
  comments: string[];
  submittedAt: string;
}

type Rubric = Readonly<Record<1 | 2 | 3 | 4 | 5, string>>;

const rubric = (
  one: string,
  two: string,
  three: string,
  four: string,
  five: string,
): Rubric => ({ 1: one, 2: two, 3: three, 4: four, 5: five });

export const blindReviewDimensions = [
  {
    key: 'newsQuestionClarity', label: '新闻问题明确度',
    rubric: rubric('没有明确新闻问题', '问题宽泛或含混', '基本明确但仍需收窄', '明确且可用于推进采访', '高度明确，能直接指导核查与采访'),
  },
  {
    key: 'angleSpecificity', label: '选题具体程度',
    rubric: rubric('只有主题，没有切口', '切口模糊且范围过大', '已有切口但边界不稳', '切口具体、范围可控', '切口具体且与任务高度匹配'),
  },
  {
    key: 'newsworthiness', label: '新闻价值',
    rubric: rubric('未说明为什么值得报道', '价值依据很弱', '有基本价值但论证不足', '价值清楚且有现实意义', '价值突出并有充分、克制的理由'),
  },
  {
    key: 'studentFeasibility', label: '学生可执行性',
    rubric: rubric('明显超出学生资源，无法完成', '需要大量修改和额外资源', '基本可行，但存在明显执行障碍', '大部分建议可直接执行', '在当前时间和资源条件下高度可执行'),
  },
  {
    key: 'intervieweeAccessibility', label: '采访对象可达性',
    rubric: rubric('对象不可达且无替代', '多数对象难以接触', '部分可达，需要替代方案', '多数对象可达且有备选', '对象、路径和替代方案都现实可行'),
  },
  {
    key: 'sourceMapCompleteness', label: '信源完整性',
    rubric: rubric('只有单一立场或单一信源', '关键一方明显缺失', '基本覆盖但旁证不足', '多方角色完整且相互制衡', '信源结构完整，并区分原始来源与旁证'),
  },
  {
    key: 'interviewQuestionQuality', label: '采访问题质量',
    rubric: rubric('无法用于真实采访', '多数问题空泛或诱导', '部分可直接使用', '多数具体、开放且有追问路径', '问题层次清楚，可直接执行并支持核查'),
  },
  {
    key: 'verificationQuality', label: '证据和核查意识',
    rubric: rubric('把假设当事实', '核查要求很少', '提到核查但路径不完整', '关键主张均有核查路径', '明确区分已知、假设、未知及冲突证据'),
  },
  {
    key: 'ethicsAwareness', label: '伦理风险识别',
    rubric: rubric('忽视明显伦理风险', '只给笼统提醒', '识别部分风险', '风险与具体处置相匹配', '同时覆盖同意、匿名、引语和弱势对象边界'),
  },
  {
    key: 'deadlineFeasibility', label: '截止时间可行性',
    rubric: rubric('不可能在期限内完成', '时间安排严重失真', '需要明显压缩或调整', '大体符合期限并有优先级', '顺序、依赖与缓冲均现实可行'),
  },
  {
    key: 'assignmentCompliance', label: '作业要求符合度',
    rubric: rubric('忽略关键作业要求', '多项硬性要求缺失', '主要要求基本覆盖', '硬性要求完整且可检查', '完整覆盖并能追溯到原要求'),
  },
  {
    key: 'rewriteEffort', label: '人工修改成本',
    rubric: rubric('几乎需要完全重写', '需要大幅重写', '需要中等修改', '只需少量修改', '基本可直接采用'),
  },
  {
    key: 'overallPreference', label: '总体采用意愿',
    rubric: rubric('不会采用', '很可能不采用', '视情况采用', '愿意采用大部分内容', '愿意作为当前任务的主要工作方案'),
  },
] as const;

export type BlindReviewDimension = (typeof blindReviewDimensions)[number]['key'];

export interface BlindComparisonInput {
  caseId: string;
  outputs: Array<{ source: ComparisonSource; content: string }>;
  synthetic?: boolean;
}

export interface BlindReviewPacket {
  format: 'anonymous-reporting-review';
  dataVersion: 2;
  caseId: string;
  synthetic: boolean;
  variants: Array<{ id: string; anonymousId: AnonymousVariantId; content: string }>;
  dimensions: Array<{
    key: BlindReviewDimension;
    label: string;
    scale: '1-5';
    rubric: Rubric;
  }>;
}

export interface BlindReviewScore {
  anonymousId: AnonymousVariantId;
  scores: Record<BlindReviewDimension, number>;
  comment: string;
}

export interface BlindComparison {
  packet: BlindReviewPacket;
  revealKey: Record<AnonymousVariantId, ComparisonSource>;
}

const anonymizeSelfIdentification = (content: string) =>
  content
    .replace(/NewsPilot(?:\s*AI)?/giu, '[来源标识已隐藏]')
    .replace(/通用(?:聊天)?模型/gu, '[来源标识已隐藏]')
    .replace(/学生自行策划/gu, '[来源标识已隐藏]')
    .replace(/ChatGPT|OpenAI|Claude|Gemini|DeepSeek|Qwen|通义千问|文心一言|豆包/giu, '[来源标识已隐藏]')
    .replace(/作为(?:通用)?(?:聊天)?模型/gu, '作为策划工具')
    .trim();

const seededOrder = (seed: number) => {
  const values = [0, 1, 2];
  let state = Math.abs(Math.trunc(seed)) || 1;
  for (let index = values.length - 1; index > 0; index -= 1) {
    state = (state * 9301 + 49297) % 233280;
    const target = Math.floor((state / 233280) * (index + 1));
    [values[index], values[target]] = [values[target], values[index]];
  }
  return values;
};

export function createBlindComparison(
  input: BlindComparisonInput,
  seed = Date.now(),
): BlindComparison {
  const sourceSet = new Set(input.outputs.map((output) => output.source));
  if (input.outputs.length !== 3 || sourceSet.size !== 3 ||
      !(['newspilot', 'general_model', 'student'] as const).every((source) => sourceSet.has(source))) {
    throw new Error('盲评必须包含 NewsPilot、通用模型和学生自行策划三种来源。');
  }
  if (input.outputs.some((output) => !output.content.trim())) {
    throw new Error('盲评方案内容不能为空。');
  }
  const ids: AnonymousVariantId[] = ['方案 A', '方案 B', '方案 C'];
  const ordered = seededOrder(seed).map((index) => input.outputs[index]);
  const revealKey = Object.fromEntries(
    ordered.map((output, index) => [ids[index], output.source]),
  ) as Record<AnonymousVariantId, ComparisonSource>;
  return {
    packet: {
      format: 'anonymous-reporting-review',
      dataVersion: 2,
      caseId: input.caseId.trim() || '未命名案例',
      synthetic: input.synthetic ?? false,
      variants: ordered.map((output, index) => ({
        id: `${input.caseId.trim() || 'case'}-${index + 1}`,
        anonymousId: ids[index],
        content: anonymizeSelfIdentification(output.content),
      })),
      dimensions: blindReviewDimensions.map(({ key, label, rubric: scoreRubric }) => ({
        key,
        label,
        scale: '1-5',
        rubric: scoreRubric,
      })),
    },
    revealKey,
  };
}

const validateScores = (packet: BlindReviewPacket, scores: BlindReviewScore[]) => {
  if (scores.length !== packet.variants.length ||
      new Set(scores.map((item) => item.anonymousId)).size !== packet.variants.length) {
    throw new Error('评分数量与匿名方案数量不一致或存在重复方案。');
  }
  for (const review of scores) {
    if (!packet.variants.some((item) => item.anonymousId === review.anonymousId)) {
      throw new Error('评分包含未知匿名方案。');
    }
    for (const { key } of blindReviewDimensions) {
      const score = review.scores[key];
      if (!Number.isInteger(score) || score < 1 || score > 5) {
        throw new Error('盲评分数必须是 1—5 的整数。');
      }
    }
  }
};

export function canRevealBlindComparison(
  packet: BlindReviewPacket,
  scores: BlindReviewScore[],
) {
  try {
    validateScores(packet, scores);
    return true;
  } catch {
    return false;
  }
}

export function finalizeBlindComparison(
  comparison: BlindComparison,
  scores: BlindReviewScore[],
) {
  validateScores(comparison.packet, scores);
  return {
    packet: structuredClone(comparison.packet),
    scores: structuredClone(scores),
    revealKey: structuredClone(comparison.revealKey),
  };
}

export function serializeAnonymousReviewJson(
  packet: BlindReviewPacket,
  scores: BlindReviewScore[],
) {
  validateScores(packet, scores);
  return JSON.stringify({
    format: 'newspilot-anonymous-review-result',
    dataVersion: 2,
    caseId: packet.caseId,
    synthetic: packet.synthetic,
    sampleSize: scores.length,
    scores,
  }, null, 2);
}

const csvCell = (value: string | number | boolean) =>
  `"${String(value).replace(/"/gu, '""')}"`;

export function serializeAnonymousReviewCsv(
  packet: BlindReviewPacket,
  scores: BlindReviewScore[],
) {
  validateScores(packet, scores);
  const headers = [
    '案例编号', '匿名方案', '是否模拟数据',
    ...blindReviewDimensions.map(({ label }) => label), '评语',
  ];
  const rows = scores.map((review) => [
    packet.caseId,
    review.anonymousId,
    packet.synthetic,
    ...blindReviewDimensions.map(({ key }) => review.scores[key]),
    review.comment,
  ]);
  return [headers, ...rows].map((row) => row.map(csvCell).join(',')).join('\r\n');
}
