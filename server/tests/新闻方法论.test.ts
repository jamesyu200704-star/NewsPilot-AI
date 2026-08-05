import assert from 'node:assert/strict';
import test from 'node:test';
import { buildPlanningContext } from '../../shared/新闻方法论.js';

test('校园 AI 政策线索生成六维新闻价值评估与强制采访规则', () => {
  const context = buildPlanningContext({
    topic: '高校发布大学生使用生成式 AI 完成课程作业的新规定',
    reportType: '深度报道',
    audience: '高校学生',
    scope: '校园',
    background: '学校近期发布课程作业规范，学生和教师对允许使用 AI 的边界存在不同理解。',
  });

  assert.deepEqual(
    context.newsValueAssessment.dimensions.map((dimension) => dimension.id),
    [
      'timeliness',
      'significance',
      'proximity',
      'conflict',
      'humanInterest',
      'interest',
    ],
  );
  assert.equal(context.newsValueAssessment.dimensions.length, 6);
  assert.ok(context.newsValueAssessment.overallScore >= 0);
  assert.ok(context.newsValueAssessment.overallScore <= 10);

  assert.deepEqual(
    context.ruleDecision.matches.map((match) => match.id),
    ['campus-education', 'policy-governance', 'technology-accountability'],
  );
  assert.ok(
    context.ruleDecision.requiredInterviewees.includes('直接受影响的学生'),
  );
  assert.ok(context.ruleDecision.requiredInterviewees.includes('一线教师'));
  assert.ok(
    context.ruleDecision.requiredInterviewees.includes('学校管理者或教务负责人'),
  );
  assert.ok(
    context.ruleDecision.requiredSources.includes(
      '学校正式通知、课程规范或管理制度原文',
    ),
  );
  assert.match(context.topicAnalysis.coreConflict, /效率|规范|公平/u);
});
