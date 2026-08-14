import type { BriefInput, GenerationResult, StoryAngle } from '../types/index.js';

const escapeMarkdownText = (value: string) => {
  const normalized = value.replace(/\r\n?|\n/g, ' ').replace(/\s+/g, ' ').trim();
  const htmlSafe = normalized
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;');
  const markdownSafe = htmlSafe.replace(/[\\`*_\[\]()#!|~]/g, '\\$&');

  return /^[=+\-@]/.test(markdownSafe) ? '\\' + markdownSafe : markdownSafe;
};

const list = (items: string[]) =>
  items.map((item) => '- ' + escapeMarkdownText(item)).join('\n');

const numberedList = (items: string[]) =>
  items
    .map((item, index) => String(index + 1) + '. ' + escapeMarkdownText(item))
    .join('\n');

const stars = (score: number) => {
  const filled = Math.max(0, Math.min(5, Math.round(score)));
  return '★'.repeat(filled) + '☆'.repeat(5 - filled);
};

const confidenceLabel = {
  low: '低',
  medium: '中',
  high: '高',
} as const;

const searchStatusLabel = {
  mock: '本地知识库（未实时联网）',
  live: '实时搜索 + 本地知识库',
  failed: '实时搜索失败，已降级到本地知识库',
} as const;

const evidenceToMarkdown = (result: GenerationResult) =>
  result.retrievalContext.evidence
    .map((item, index) => {
      const sourceLines = [
        '- 证据 ID：' + escapeMarkdownText(item.id),
        '- 来源类型：' + escapeMarkdownText(item.sourceType),
        '- 摘要：' + escapeMarkdownText(item.summary),
      ];
      if (item.sourceName) {
        sourceLines.push('- 来源名称：' + escapeMarkdownText(item.sourceName));
      }
      if (item.sourceUrl) {
        sourceLines.push('- 来源地址：' + escapeMarkdownText(item.sourceUrl));
      }
      if (item.publishedAt) {
        sourceLines.push('- 发布时间：' + escapeMarkdownText(item.publishedAt));
      }
      return [
        `### 证据 ${index + 1}：${escapeMarkdownText(item.title)}`,
        '',
        ...sourceLines,
      ].join('\n');
    })
    .join('\n\n');

const agentReviewToMarkdown = (result: GenerationResult) => {
  const { verification, editorial, trace } = result.agentReview;
  const findings = verification.factCheck.findings
    .map((finding, index) =>
      [
        `### 核查 ${index + 1}：${escapeMarkdownText(finding.claim)}`,
        '',
        '- 严重程度：' + finding.severity,
        '- 判断状态：' + finding.status,
        '- 核查说明：' + escapeMarkdownText(finding.assessment),
        '- 必须行动：' + escapeMarkdownText(finding.requiredAction),
        '- 证据 ID：' +
          (finding.evidenceIds.length
            ? finding.evidenceIds.map(escapeMarkdownText).join('、')
            : '暂无'),
      ].join('\n'),
    )
    .join('\n\n');
  const risks = verification.riskReview.items.map(
    (item) =>
      `${item.severity} / ${item.category}：${item.description}；缓解措施：${item.mitigation}`,
  );
  const traceItems = trace.map(
    (step) => `${step.agent} / ${step.mode} / ${step.status}：${step.summary}`,
  );

  return [
    '## Agent 审核',
    '',
    '### 工作流轨迹',
    '',
    list(traceItems),
    '',
    '### 事实核查 Agent',
    '',
    escapeMarkdownText(verification.factCheck.summary),
    '',
    findings,
    '',
    '### 未获支持的主张',
    '',
    verification.factCheck.unsupportedClaims.length
      ? list(verification.factCheck.unsupportedClaims)
      : '- 暂无',
    '',
    '### 采访伦理提醒',
    '',
    list(verification.factCheck.ethicsNotes),
    '',
    '### 风险审核',
    '',
    '- 总体风险：' + verification.riskReview.overallRisk,
    '- 发布闸门：' + verification.riskReview.releaseGate,
    '',
    list(risks),
    '',
    '### 新闻编辑 Agent',
    '',
    '- 编辑决定：' + editorial.disposition,
    '- 优先角度：' + editorial.priorityAngleId,
    '- 编辑说明：' + escapeMarkdownText(editorial.rationale),
    '',
    '#### 终审修改',
    '',
    list(editorial.changes),
    '',
    '#### 进入采访前最终清单',
    '',
    list(editorial.finalChecklist),
  ].join('\n');
};

export function storyAngleToMarkdown(angle: StoryAngle, index: number): string {
  return [
    '### 角度' + ['一', '二', '三'][index] + '：' + escapeMarkdownText(angle.title),
    '',
    '#### 核心切口',
    '',
    escapeMarkdownText(angle.perspective),
    '',
    '#### 角度潜力评分',
    '',
    stars(angle.newsValueScore) + '（' + angle.newsValueScore.toFixed(1) + ' / 5）',
    '',
    '#### 为什么值得报道',
    '',
    escapeMarkdownText(angle.whyWorthReporting),
    '',
    '#### 新闻价值',
    '',
    list(angle.newsValue),
    '',
    '#### 推荐采访对象',
    '',
    list(angle.interviewees),
    '',
    '#### 采访问题',
    '',
    numberedList(angle.interviewQuestions),
    '',
    '#### 事实核查清单',
    '',
    list(angle.verificationChecklist),
    '',
    '#### 报道风险提醒',
    '',
    list(angle.risks),
    '',
    '#### 下一步行动',
    '',
    numberedList(angle.nextActions),
  ].join('\n');
}

export function buildMarkdown(input: BriefInput, result: GenerationResult): string {
  const generatedTime = new Intl.DateTimeFormat('zh-CN', {
    dateStyle: 'medium',
    timeStyle: 'short',
  }).format(new Date(result.generatedAt));

  const backgroundSection = input.background
    ? ['### 补充背景', '', escapeMarkdownText(input.background), '']
    : [];
  const generationMode =
    result.mode === 'openai'
      ? 'OpenAI'
      : result.mode === 'qwen'
        ? 'Qwen'
      : result.mode === 'ollama'
        ? 'Ollama'
        : 'Mock';
  const scoreRows = result.newsValueAssessment.dimensions.map(
    (dimension) =>
      '| ' +
      escapeMarkdownText(dimension.label) +
      ' | ' +
      stars(dimension.score) +
      ' | ' +
      dimension.score.toFixed(1) +
      ' / 5 | ' +
      Math.round(dimension.weight * 100) +
      '% | ' +
      escapeMarkdownText(dimension.rationale) +
      ' |',
  );
  const ruleMatches = result.ruleDecision.matches.map(
    (match) => match.title + '：' + match.reason,
  );

  return [
    '# 新闻选题策划',
    '',
    '> 主题：' + escapeMarkdownText(input.topic),
    '',
    '> 由 NewsPilot AI Beta ' +
      generationMode +
      ' 模式生成。系统输出是采访与核查计划，不是已经完成的事实结论。',
    '',
    '## 策划信息',
    '',
    '- 报道类型：' + escapeMarkdownText(input.reportType),
    '- 目标受众：' + (escapeMarkdownText(input.audience) || '未填写'),
    '- 报道范围：' + (escapeMarkdownText(input.scope) || '未填写'),
    '- 生成时间：' + generatedTime,
    '- 生成模式：' + generationMode,
    '',
    '## 主题分析',
    '',
    escapeMarkdownText(result.topicSummary),
    '',
    escapeMarkdownText(result.topicAnalysis.summary),
    '',
    '### 关键利益相关者',
    '',
    list(result.topicAnalysis.stakeholders),
    '',
    ...backgroundSection,
    '## 新闻价值评分',
    '',
    '| 维度 | 星级 | 得分 | 权重 | 判断依据 |',
    '| --- | --- | ---: | ---: | --- |',
    ...scoreRows,
    '',
    '**综合评分：' + result.newsValueAssessment.overallScore.toFixed(1) + ' / 10**',
    '',
    '- 评分置信度：' + confidenceLabel[result.newsValueAssessment.confidence],
    '- 说明：' + escapeMarkdownText(result.newsValueAssessment.summary),
    '',
    '## 核心矛盾',
    '',
    escapeMarkdownText(result.topicAnalysis.coreConflict),
    '',
    '## 规则命中',
    '',
    list(ruleMatches),
    '',
    '### 规则要求覆盖的采访对象',
    '',
    list(result.ruleDecision.requiredInterviewees),
    '',
    '## 检索与知识库证据',
    '',
    '- 检索方式：' + searchStatusLabel[result.retrievalContext.searchStatus],
    '- Search Provider：' + result.retrievalContext.searchProvider,
    '- 检索时间：' + escapeMarkdownText(result.retrievalContext.retrievedAt),
    ...(result.retrievalContext.notice
      ? ['- 说明：' + escapeMarkdownText(result.retrievalContext.notice)]
      : []),
    '',
    '### 检索查询',
    '',
    numberedList(result.retrievalContext.queries),
    '',
    evidenceToMarkdown(result),
    '',
    '## 推荐报道角度',
    '',
    result.angles.map(storyAngleToMarkdown).join('\n\n---\n\n'),
    '',
    agentReviewToMarkdown(result),
    '',
    '## 数据和资料需求',
    '',
    list(result.dataNeeds),
    '',
    '## 事实核查清单',
    '',
    list(result.verificationChecklist),
    '',
    '## 报道风险',
    '',
    list(result.risks),
    '',
    '## 下一步行动计划',
    '',
    numberedList(result.nextActions),
    '',
    '---',
    '',
    '请在正式报道前完成信源核验、回应权确认和隐私风险评估。',
  ].join('\n');
}

const safeFileName = (topic: string) => {
  const normalized = topic
    .trim()
    .replace(/[\\/:*?"<>|]/g, '-')
    .replace(/\s+/g, '-')
    .replace(/-+/g, '-')
    .slice(0, 48);

  return normalized || '未命名主题';
};

export function exportMarkdown(input: BriefInput, result: GenerationResult): void {
  const markdown = buildMarkdown(input, result);
  const blob = new Blob([markdown], { type: 'text/markdown;charset=utf-8' });
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement('a');

  anchor.href = url;
  anchor.download = safeFileName(input.topic) + '-新闻策划报告.md';
  document.body.appendChild(anchor);
  anchor.click();
  document.body.removeChild(anchor);
  URL.revokeObjectURL(url);
}
