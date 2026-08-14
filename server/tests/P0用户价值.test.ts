import assert from 'node:assert/strict';
import test from 'node:test';
import { 报道策略库 } from '../../strategy-library/报道策略.js';
import {
  applyConfirmedAssignmentRequirements,
  parseAssignmentRequirements,
} from '../../shared/作业要求解析.js';
import {
  blindReviewDimensions,
  createBlindComparison,
  serializeAnonymousReviewCsv,
  serializeAnonymousReviewJson,
  type BlindReviewScore,
} from '../../shared/人工盲评.js';
import {
  createLocalReportingProject,
  parseLocalProjectImport,
  serializeLocalProjects,
} from '../../shared/本地项目模型.js';
import { buildQuickReportingSummary } from '../../shared/快速策划摘要.js';
import { createStudentReportingPlan } from '../../shared/学生报道工作流.js';
import type { ReportingBrief } from '../../shared/学生报道模型.js';

const brief: ReportingBrief = {
  mode: 'course',
  rawTopic: '校园门禁新规对晚归学生的影响',
  assignmentType: '校园调查',
  courseName: '新闻采访与写作',
  deadline: '2026-08-30',
  targetLength: 1800,
  minimumInterviewees: 3,
  geographicScope: '本校校园',
  targetAudience: '本校学生与教师',
  availableInterviewees: ['晚归学生', '宿管老师', '保卫处老师'],
  existingMaterials: ['学校门禁通知'],
  reportingResources: ['1 名学生记者'],
  ethicalConstraints: ['不公开学生个人晚归记录'],
  requiresDifferentSourceTypes: true,
};

test('十类策略都包含 P0 要求的执行、伦理与来源状态元数据', () => {
  assert.equal(报道策略库.length, 10);
  for (const strategy of 报道策略库) {
    assert.ok(strategy.suitableFor.length > 0);
    assert.ok(strategy.unsuitableFor.length > 0);
    assert.ok(strategy.minimumInterviewRequirements.length > 0);
    assert.ok(strategy.minimumEvidenceRequirements.length > 0);
    assert.ok(strategy.recommendedInterviewees.length > 0);
    assert.ok(strategy.recommendedStructure.length > 0);
    assert.ok(strategy.failureModes.length > 0);
    assert.ok(strategy.ethicalRisks.length > 0);
    assert.ok(['low', 'medium', 'high'].includes(strategy.studentDifficulty));
    assert.ok(Number.isInteger(strategy.minimumWorkDays));
    assert.ok(strategy.minimumWorkDays >= 1);
    assert.ok(strategy.basis.summary.length > 0);
    assert.ok(['已人工审核', '待人工审核'].includes(strategy.basis.sourceStatus));
    if (strategy.basis.sourceReferences.length === 0) {
      assert.equal(strategy.basis.sourceStatus, '待人工审核');
    }
  }
});

test('作业要求解析保留原文依据、置信度与人工确认门槛', () => {
  const text = [
    '完成一篇 2500 字左右的人物特稿，截止时间为 2026-08-25 23:00。',
    '至少采访 4 人，覆盖不同类型信源，并提交采访提纲和采访总结。',
    '以 Markdown 格式提交。建议加入人物故事，但由选题情况决定。',
  ].join('\n');
  const result = parseAssignmentRequirements(text);

  assert.equal(result.rawText, text);
  assert.equal(result.fields.length, 10);
  assert.ok(
    result.fields.every(
      (field) =>
        typeof field.evidence === 'string' &&
        ['high', 'medium', 'low'].includes(field.confidence) &&
        typeof field.needsConfirmation === 'boolean' &&
        field.confirmed === false,
    ),
  );
  assert.equal(result.byKey.assignmentType.value, '人物特稿');
  assert.equal(result.byKey.targetLength.value, 2500);
  assert.equal(result.byKey.minimumInterviewees.value, 4);
  assert.equal(result.byKey.requiresInterviewOutline.value, true);
  assert.equal(result.byKey.requiresInterviewSummary.value, true);
  assert.equal(result.byKey.formatRequirements.value, 'Markdown');
  assert.equal(result.byKey.requiresHumanStory.needsConfirmation, true);

  const unchanged = applyConfirmedAssignmentRequirements(brief, result.fields);
  assert.equal(unchanged.targetLength, brief.targetLength);
  assert.equal(unchanged.minimumInterviewees, brief.minimumInterviewees);

  const confirmed = result.fields.map((field) =>
    ['targetLength', 'minimumInterviewees', 'requiresInterviewOutline'].includes(
      field.key,
    )
      ? { ...field, confirmed: true }
      : field,
  );
  const applied = applyConfirmedAssignmentRequirements(brief, confirmed);
  assert.equal(applied.targetLength, 2500);
  assert.equal(applied.minimumInterviewees, 4);
  assert.equal(applied.requiresInterviewOutline, true);
  assert.equal(applied.requiresHumanStory, brief.requiresHumanStory);

  const plan = createStudentReportingPlan({
    ...applied,
    formatRequirements: 'Markdown',
    otherHardConstraints: ['不得使用匿名网络帖作为唯一信源'],
  });
  assert.match(plan.assignmentSummary, /Markdown/u);
  assert.ok(plan.submissionChecklist.some((item) => /采访提纲/u.test(item)));
  assert.ok(plan.submissionChecklist.some((item) => /不得使用匿名网络帖/u.test(item)));

  const negative = parseAssignmentRequirements(
    '本次不要求人物故事，无需提交采访总结，但必须提交采访提纲。',
  );
  assert.equal(negative.byKey.requiresHumanStory.value, false);
  assert.equal(negative.byKey.requiresInterviewSummary.value, false);
  assert.equal(negative.byKey.requiresInterviewOutline.value, true);
});

test('快速策划摘要只返回七类立即决策信息', () => {
  const plan = createStudentReportingPlan(brief);
  const summary = buildQuickReportingSummary(plan);

  assert.deepEqual(Object.keys(summary).sort(), [
    'biggestRisk',
    'firstMaterials',
    'firstSources',
    'immediateActions',
    'newsQuestion',
    'recommendedAngle',
    'verdict',
  ]);
  assert.equal(summary.firstSources.length, 3);
  assert.equal(summary.firstMaterials.length, 3);
  assert.equal(summary.immediateActions.length, 3);
  assert.equal(summary.newsQuestion, plan.topicFrame.newsQuestion);
  assert.equal(summary.verdict, plan.verdict.status);
  assert.ok(!JSON.stringify(summary).includes('newsValueAssessment'));
  assert.ok(!JSON.stringify(summary).includes('interviewPlans'));
});

test('人工盲评包隐藏三个输出来源并只导出匿名 JSON/CSV', () => {
  const comparison = createBlindComparison(
    {
      caseId: 'case-policy-01',
      outputs: [
        { source: 'newspilot', content: 'NewsPilot 策划内容' },
        { source: 'general_model', content: 'ChatGPT 通用模型人工粘贴内容' },
        { source: 'student', content: '学生自行策划内容' },
      ],
    },
    7,
  );

  assert.deepEqual(comparison.packet.variants.map((item) => item.anonymousId).sort(), [
    '方案 A',
    '方案 B',
    '方案 C',
  ]);
  assert.doesNotMatch(
    JSON.stringify(comparison.packet),
    /"(?:newspilot|general_model|student)"|通用模型|学生自行策划/u,
  );
  assert.equal(Object.keys(comparison.revealKey).length, 3);

  const scores: BlindReviewScore[] = comparison.packet.variants.map((variant) => ({
    anonymousId: variant.anonymousId,
    scores: Object.fromEntries(
      blindReviewDimensions.map(({ key }) => [key, key === 'rewriteEffort' ? 2 : 4]),
    ) as BlindReviewScore['scores'],
    comment: '',
  }));
  const json = serializeAnonymousReviewJson(comparison.packet, scores);
  const csv = serializeAnonymousReviewCsv(comparison.packet, scores);

  assert.doesNotMatch(
    json,
    /"(?:newspilot|general_model|student)"|通用模型|学生自行策划/u,
  );
  assert.doesNotMatch(
    csv,
    /"(?:newspilot|general_model|student)"|通用模型|学生自行策划/u,
  );
  assert.match(csv, /新闻问题明确度/u);
  assert.match(csv, /人工修改成本/u);
});

test('本地项目支持版本化导出导入并拒绝损坏或未知版本文件', () => {
  const project = createLocalReportingProject({
    id: 'project-001',
    name: '门禁政策观察',
    brief,
    now: '2026-08-12T10:00:00.000Z',
  });
  const serialized = serializeLocalProjects([project], '2026-08-12T11:00:00.000Z');
  const imported = parseLocalProjectImport(serialized);

  assert.equal(imported.dataVersion, 3);
  assert.equal(imported.projects[0].name, '门禁政策观察');
  assert.equal(imported.projects[0].brief.rawTopic, brief.rawTopic);
  assert.throws(
    () => parseLocalProjectImport('{"format":"newspilot-local-projects"}'),
    /损坏|无效/u,
  );
  assert.throws(
    () =>
      parseLocalProjectImport(
        JSON.stringify({ ...imported, dataVersion: 999 }),
      ),
    /版本/u,
  );
  assert.throws(
    () =>
      parseLocalProjectImport(
        JSON.stringify({
          ...imported,
          projects: [{ ...project, plan: { malformed: true } }],
        }),
      ),
    /损坏|校验/u,
  );
});
