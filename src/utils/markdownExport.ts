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

export function storyAngleToMarkdown(angle: StoryAngle, index: number): string {
  return [
    '## 角度' + ['一', '二', '三'][index] + '：' + escapeMarkdownText(angle.title),
    '',
    '### 核心切口',
    '',
    escapeMarkdownText(angle.perspective),
    '',
    '### 新闻价值评分',
    '',
    '★★★★☆（' + angle.newsValueScore.toFixed(1) + ' / 5）',
    '',
    '### 为什么值得报道',
    '',
    escapeMarkdownText(angle.whyWorthReporting),
    '',
    '### 新闻价值',
    '',
    list(angle.newsValue),
    '',
    '### 推荐采访对象',
    '',
    list(angle.interviewees),
    '',
    '### 采访问题',
    '',
    numberedList(angle.interviewQuestions),
    '',
    '### 事实核查清单',
    '',
    list(angle.verificationChecklist),
    '',
    '### 报道风险提醒',
    '',
    list(angle.risks),
    '',
    '### 下一步行动',
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
      : result.mode === 'ollama'
        ? 'Ollama'
        : 'Mock';

  return [
    '# ' + escapeMarkdownText(input.topic) + '｜新闻选题方案',
    '',
    '> 由 NewsPilot AI V0.1 ' +
      generationMode +
      ' 模式生成，仅作为前期策划辅助，事实需由记者独立核验。',
    '',
    '## 策划简报',
    '',
    '- 报道类型：' + escapeMarkdownText(input.reportType),
    '- 目标受众：' + (escapeMarkdownText(input.audience) || '未填写'),
    '- 报道范围：' + (escapeMarkdownText(input.scope) || '未填写'),
    '- 生成时间：' + generatedTime,
    '- 生成模式：' + generationMode,
    '',
    '### 主题概述',
    '',
    escapeMarkdownText(result.topicSummary),
    '',
    ...backgroundSection,
    result.angles.map(storyAngleToMarkdown).join('\n\n---\n\n'),
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
  anchor.download = safeFileName(input.topic) + '-新闻选题方案.md';
  document.body.appendChild(anchor);
  anchor.click();
  document.body.removeChild(anchor);
  URL.revokeObjectURL(url);
}
