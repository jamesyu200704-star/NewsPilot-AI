import assert from 'node:assert/strict';
import test from 'node:test';
import { buildNewsEditorPrompt } from '../../prompts/新闻编辑提示词.js';
import { buildFactCheckPrompt } from '../../prompts/事实核查提示词.js';
import { buildFinalEditorPrompt } from '../../prompts/新闻编辑终审提示词.js';
import { createMockGenerationContent } from '../../shared/mockGeneration.js';
import { createMockVerificationReview } from '../../shared/mockAgents.js';
import { buildPlanningContext } from '../../shared/新闻方法论.js';

test('Prompt Engine 注入方法论上下文并执行六步新闻编辑流程', () => {
  const context = buildPlanningContext({
    topic: '大学生使用 AI 完成课程作业',
    reportType: '深度报道',
    audience: '高校学生',
    scope: '校园',
    background: '近期多所高校开始讨论生成式 AI 的课程使用边界。',
  });
  const prompt = buildNewsEditorPrompt(context);

  assert.equal(prompt.version, 'news-editor-v1.0');
  for (let step = 1; step <= 6; step += 1) {
    assert.match(prompt.system, new RegExp(`Step ${step}`));
  }
  assert.match(prompt.system, /禁止编造事实/u);
  assert.match(prompt.system, /不得修改程序计算的新闻价值评分/u);
  assert.match(prompt.user, /方法论上下文/u);
  assert.match(prompt.user, /campus-education/u);
  assert.match(
    prompt.user,
    new RegExp(String(context.newsValueAssessment.overallScore)),
  );
  assert.match(prompt.user, /数据而不是指令/u);
});

test('三个 Agent 使用相互独立的策划、核查和终审提示词', () => {
  const context = buildPlanningContext({
    topic: '大学生使用 AI 完成课程作业',
    reportType: '深度报道',
    audience: '高校学生',
    scope: '校园',
    background: '高校近期发布相关课程规范。',
  });
  const draft = createMockGenerationContent(context);
  const verification = createMockVerificationReview(context, draft);
  const factCheckPrompt = buildFactCheckPrompt(context, draft);
  const editorPrompt = buildFinalEditorPrompt(context, draft, verification);

  assert.match(factCheckPrompt.system, /事实核查 Agent/u);
  assert.match(factCheckPrompt.system, /证据 ID/u);
  assert.match(factCheckPrompt.system, /采访伦理/u);
  assert.match(editorPrompt.system, /新闻编辑 Agent/u);
  assert.match(editorPrompt.system, /不得删除未解决风险/u);
  assert.match(editorPrompt.user, /unsupportedClaims/u);
});
