import assert from 'node:assert/strict';
import test from 'node:test';
import { createMockGenerationResult } from '../../shared/mockGeneration.js';
import { buildMarkdown } from '../../src/utils/markdownExport.js';
import { sampleInput } from './fixtures.js';

test('Markdown 导出包含完整新闻策划报告与方法论依据', () => {
  const result = createMockGenerationResult(sampleInput);
  const markdown = buildMarkdown(sampleInput, result);

  assert.match(markdown, /^# 新闻选题策划/mu);
  assert.match(markdown, /## 主题分析/u);
  assert.match(markdown, /## 新闻价值评分/u);
  assert.match(markdown, /时效性/u);
  assert.match(markdown, /重要性/u);
  assert.match(markdown, /接近性/u);
  assert.match(markdown, /## 核心矛盾/u);
  assert.match(markdown, /## 检索与知识库证据/u);
  assert.match(markdown, /检索查询/u);
  assert.match(markdown, /## 数据和资料需求/u);
  assert.match(markdown, /## 事实核查清单/u);
  assert.match(markdown, /## Agent 审核/u);
  assert.match(markdown, /事实核查 Agent/u);
  assert.match(markdown, /风险审核/u);
  assert.match(markdown, /新闻编辑 Agent/u);
  assert.match(markdown, /needs-reporting/u);
  assert.match(markdown, /## 报道风险/u);
  assert.match(markdown, /## 下一步行动计划/u);
  assert.match(markdown, /规则命中/u);
});

test('Markdown 导出将外部文本保持为不可执行的纯文本', async () => {
  const input = {
    ...sampleInput,
    topic: '<img src=x onerror=alert(1)>\n# injected',
    background: '![track](https://attacker.invalid/pixel)\n<script>alert(1)</script>',
  };
  const result = createMockGenerationResult(input);

  result.topicSummary = '[open](javascript:alert(1))';
  result.angles[0].title = '![remote](https://attacker.invalid/image)';

  const markdown = buildMarkdown(input, result);

  assert.doesNotMatch(markdown, /<img|<script/i);
  assert.doesNotMatch(markdown, /!\[(?:track|remote)\]\(/);
  assert.doesNotMatch(markdown, /\]\(javascript:/i);
  assert.doesNotMatch(markdown, /\n# injected/);
  assert.match(markdown, /&lt;img src=x onerror=alert/);
  assert.match(markdown, /\\!\\\[track\\\]\\\(https:\/\/attacker\.invalid\/pixel\\\)/);
  assert.match(markdown, /\\\[open\\\]\\\(javascript:alert\\\(1\\\)\\\)/i);
});
