import assert from 'node:assert/strict';
import test from 'node:test';
import {
  evaluateCampusReportingCases,
  校园报道评估题库,
} from '../../evals/校园报道题库.js';
import { 报道策略库 } from '../../strategy-library/报道策略.js';
import { createMockGenerationResult } from '../../shared/mockGeneration.js';
import type {
  EvidenceRecord,
  ReportingBrief,
} from '../../shared/学生报道模型.js';
import {
  createStudentReportingPlan,
  createStudentReportingPlanWithGeneration,
  reportingBriefToLegacyInput,
} from '../../shared/学生报道工作流.js';
import { buildClaimEvidenceMatrix } from '../../rules/交叉验证规则.js';

const courseBrief: ReportingBrief = {
  mode: 'course',
  rawTopic: '大学生使用生成式 AI 完成课程作业',
  assignmentType: '校园调查',
  courseName: '新闻采访与写作',
  deadline: '2026-08-20',
  targetLength: 2500,
  minimumInterviewees: 4,
  geographicScope: '本校本科生课程',
  targetAudience: '授课教师与新闻专业学生',
  availableInterviewees: ['使用过生成式 AI 的学生', '任课教师', '教务处老师'],
  existingMaterials: ['课程作业说明', '学校生成式 AI 使用规范'],
  reportingResources: ['1 名文字记者', '手机录音'],
  ethicalConstraints: ['匿名保护学生身份', '不上传未公开作业'],
  teacherRequirements: '至少采访四人，覆盖学生、教师和管理者，提交采访总结。',
  requiresDifferentSourceTypes: true,
  requiresHumanStory: true,
  requiresPlanningDocument: true,
  requiresInterviewSummary: true,
};

test('课程任务被转换为可验证的新闻问题并保留假设边界', () => {
  const plan = createStudentReportingPlan(courseBrief);

  assert.equal(plan.brief.mode, 'course');
  assert.match(plan.assignmentSummary, /新闻采访与写作/u);
  assert.match(plan.topicFrame.newsQuestion, /评价|作业/u);
  assert.match(plan.topicFrame.workingHypothesis, /假设/u);
  assert.ok(
    !plan.topicFrame.knownFacts.includes(plan.topicFrame.workingHypothesis),
  );
  assert.ok(plan.topicFrame.verificationNeeds.length >= 3);
  assert.ok(['GO', 'REVISE', 'HOLD', 'DROP'].includes(plan.verdict.status));
  assert.match(plan.verdict.minimumViableVersion, /采访|核对/u);
});

test('候选角度来自十类策略匹配并按学生可执行性排序', () => {
  const plan = createStudentReportingPlan(courseBrief);

  assert.ok(报道策略库.length >= 10);
  assert.equal(plan.candidateAngles.length, 3);
  assert.equal(new Set(plan.candidateAngles.map((angle) => angle.strategyId)).size, 3);
  assert.ok(
    plan.candidateAngles.every(
      (angle, index, angles) =>
        index === 0 || angles[index - 1].totalScore >= angle.totalScore,
    ),
  );
  assert.equal(plan.recommendedAngleId, plan.candidateAngles[0].id);
  assert.ok(new Set(plan.candidateAngles.map((angle) => angle.totalScore)).size > 1);
  assert.ok(
    plan.candidateAngles.some((angle) => angle.strategyId === 'campus-phenomenon'),
  );
  assert.ok(
    !plan.candidateAngles.every((angle) =>
      ['people', 'system', 'trend'].includes(angle.strategyId),
    ),
  );
});

test('每类信源都生成问题阶梯且问题通过诱导与一题多问检查', () => {
  const plan = createStudentReportingPlan(courseBrief);

  assert.ok(plan.sourceMap.length >= 5);
  assert.ok(
    plan.sourceMap
      .filter((source) => source.accessibility === 'low')
      .every((source) => source.alternativeSources.length > 0),
  );
  assert.ok(plan.interviewPlans.length >= 4);
  assert.ok(
    plan.interviewPlans.every((group) => {
      const stages = new Set(group.questions.map((question) => question.stage));
      return (
        stages.size === 8 &&
        group.questions.every(
          (question) => !question.isLeading && !question.isDoubleBarreled,
        )
      );
    }),
  );
  assert.equal(
    new Set(
      plan.interviewPlans.map((group) =>
        group.questions.map((question) => question.question).join('|'),
      ),
    ).size,
    plan.interviewPlans.length,
  );
  assert.ok(
    plan.interviewPlans.every((group) =>
      group.questions.some((question) =>
        question.question.includes(courseBrief.rawTopic),
      ),
    ),
  );
});

test('交叉验证规则区分原始来源、独立来源、社交线索与来源冲突', () => {
  const evidence: EvidenceRecord[] = [
    {
      id: 'e-primary',
      title: '学校正式通知',
      publisher: '学校教务处',
      retrievedAt: '2026-08-12T00:00:00.000Z',
      sourceType: 'primary_document',
      credibilityTier: 'A',
      summary: '学校发布了生成式 AI 课程作业使用规范。',
      supports: [
        '学校已发布相关规范',
        '学校允许在部分课程中披露后使用 AI',
      ],
      contradicts: ['所有课程都禁止 AI'],
    },
    {
      id: 'e-news-1',
      title: '教师评价方式访谈',
      publisher: '校园媒体甲',
      retrievedAt: '2026-08-12T00:00:00.000Z',
      sourceType: 'news_report',
      credibilityTier: 'B',
      summary: '部分教师要求学生提交修改过程。',
      supports: ['部分教师调整了评价方式'],
      contradicts: [],
    },
    {
      id: 'e-news-2',
      title: '课程负责人访谈',
      publisher: '校园媒体乙',
      retrievedAt: '2026-08-12T00:00:00.000Z',
      sourceType: 'news_report',
      credibilityTier: 'B',
      summary: '另一门课程也增加了过程记录要求。',
      supports: ['部分教师调整了评价方式'],
      contradicts: [],
    },
    {
      id: 'e-social',
      title: '匿名校园帖',
      publisher: '校园论坛',
      retrievedAt: '2026-08-12T00:00:00.000Z',
      sourceType: 'social_post',
      credibilityTier: 'lead_only',
      summary: '匿名用户声称所有课程都禁止 AI。',
      supports: ['所有课程都禁止 AI'],
      contradicts: ['学校允许在部分课程中披露后使用 AI'],
    },
  ];

  const matrix = buildClaimEvidenceMatrix(
    [
      '学校已发布相关规范',
      '部分教师调整了评价方式',
      '所有课程都禁止 AI',
      '学校允许在部分课程中披露后使用 AI',
    ],
    evidence,
  );

  assert.equal(matrix[0].status, 'verified');
  assert.equal(matrix[1].status, 'verified');
  assert.equal(matrix[2].status, 'conflicted');
  assert.equal(matrix[3].status, 'conflicted');
});

test('二十个评估题目覆盖规定的十类校园报道场景', () => {
  assert.ok(校园报道评估题库.length >= 20);
  assert.deepEqual(
    new Set(校园报道评估题库.map((item) => item.category)),
    new Set([
      '人物特稿',
      '校园服务',
      '教育变化',
      '学生消费',
      '校园政策',
      '社交现象',
      '体育活动',
      '就业焦虑',
      'AI 使用',
      '校园安全',
    ]),
  );
  assert.ok(
    校园报道评估题库.every(
      (item) => item.expectedChecks.length >= 4 && item.brief.rawTopic.length > 4,
    ),
  );
});

test('AI Provider 结果只补充评分与证据线索，不把检索摘要自动认定为事实', () => {
  const generation = createMockGenerationResult(
    reportingBriefToLegacyInput(courseBrief),
  );
  const plan = createStudentReportingPlanWithGeneration(courseBrief, generation);

  assert.equal(plan.mode, generation.mode);
  assert.equal(
    plan.newsValueAssessment.overallScore,
    generation.newsValueAssessment.overallScore,
  );
  assert.equal(
    plan.evidenceLedger.length,
    generation.retrievalContext.evidence.length + courseBrief.existingMaterials.length,
  );
  assert.ok(plan.evidenceLedger.some((evidence) => evidence.sourceType === 'user_material'));
  assert.ok(plan.evidenceLedger.every((evidence) => evidence.supports.length === 0));
  assert.ok(
    plan.claimEvidenceMatrix.every((claim) => claim.status === 'unverified'),
  );
});

test('二十题半自动评估覆盖选题、信源、问题、证据与行动计划', () => {
  const report = evaluateCampusReportingCases();

  assert.equal(report.total, 20);
  assert.equal(report.failed, 0);
  assert.equal(report.passed, report.total);
  assert.deepEqual(Object.keys(report.dimensionPassRates).sort(), [
    'actionPlan',
    'angleQuality',
    'evidenceSafety',
    'interviewQuality',
    'sourceCoverage',
    'topicFraming',
  ]);
  assert.ok(
    Object.values(report.dimensionPassRates).every((rate) => rate >= 0.9),
  );
});
