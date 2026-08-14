import assert from 'node:assert/strict';
import test from 'node:test';
import { createMockGenerationResult } from '../../shared/mockGeneration.js';
import { buildMarkdown } from '../../src/utils/markdownExport.js';
import { buildStudentPlanMarkdown } from '../../src/utils/学生策划案导出.js';
import { createStudentReportingPlan } from '../../shared/学生报道工作流.js';
import type { ReportingBrief } from '../../shared/学生报道模型.js';
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

test('V0.2 课程策划案导出包含任务约束、判断、信源和证据状态', () => {
  const brief: ReportingBrief = {
    mode: 'course',
    rawTopic: '大学生使用生成式 AI 完成课程作业',
    assignmentType: '校园调查',
    courseName: '新闻采访与写作',
    deadline: '2026-08-20',
    targetLength: 2500,
    minimumInterviewees: 4,
    targetAudience: '新闻专业学生',
    geographicScope: '本校课程',
    availableInterviewees: ['学生', '教师', '教务老师'],
    existingMaterials: ['学校生成式 AI 使用规范'],
    reportingResources: ['1 名文字记者'],
    ethicalConstraints: ['匿名保护学生身份'],
    teacherRequirements: '至少采访四人并提交采访总结。',
    requiresPlanningDocument: true,
    requiresInterviewSummary: true,
  };
  const markdown = buildStudentPlanMarkdown(createStudentReportingPlan(brief));

  assert.match(markdown, /^# NewsPilot 课程采访策划案/mu);
  assert.match(markdown, /## 一、任务要求摘要/u);
  assert.match(markdown, /## 二、主题与新闻问题/u);
  assert.match(markdown, /工作假设（不得作为事实）/u);
  assert.match(markdown, /## 三、GO \/ REVISE \/ HOLD \/ DROP 判断/u);
  assert.match(markdown, /## 八、信源地图/u);
  assert.match(markdown, /## 十一、关键说法交叉验证矩阵/u);
  assert.match(markdown, /unverified/u);
  assert.match(markdown, /没有真实采访时不生成引语/u);
  assert.match(markdown, /## 十六、提交前自查/u);
  assert.doesNotMatch(markdown, /已经采访|受访者表示：“/u);
});
