import type {
  CandidateAngle,
  InterviewPlan,
  StudentReportingPlan,
} from '../../shared/学生报道模型.js';

const cleanMarkdown = (value: string | number) => {
  const normalized = String(value).replace(/\r\n?|\n/gu, ' ').replace(/\s+/gu, ' ').trim();
  const htmlSafe = normalized
    .replace(/&/gu, '&amp;')
    .replace(/</gu, '&lt;')
    .replace(/>/gu, '&gt;');
  const markdownSafe = htmlSafe.replace(/[\\`*_\[\]()#!|~]/gu, '\\$&');
  return /^[=+\-@]/u.test(markdownSafe) ? `\\${markdownSafe}` : markdownSafe;
};

const list = (items: string[], empty = '暂无') =>
  items.length ? items.map((item) => `- ${cleanMarkdown(item)}`).join('\n') : `- ${empty}`;

const numbered = (items: string[], empty = '暂无') =>
  items.length
    ? items.map((item, index) => `${index + 1}. ${cleanMarkdown(item)}`).join('\n')
    : `1. ${empty}`;

const accessibilityLabel = {
  high: '较高',
  medium: '一般',
  low: '较低',
} as const;

const evidenceStatusLabel = {
  verified: 'verified（已核实）',
  partially_verified: 'partially_verified（部分核实）',
  unverified: 'unverified（未核实）',
  conflicted: 'conflicted（证据冲突）',
} as const;

const angleMarkdown = (angle: CandidateAngle, recommended: boolean) => [
  `### ${recommended ? '推荐 · ' : ''}${cleanMarkdown(angle.title)}`,
  '',
  `- 报道策略：${cleanMarkdown(angle.strategyName)}`,
  `- 新闻问题：${cleanMarkdown(angle.question)}`,
  `- 核心矛盾：${cleanMarkdown(angle.coreConflict)}`,
  `- 综合可行性：${angle.totalScore.toFixed(1)} / 10`,
  `- 适用理由：${cleanMarkdown(angle.rationale)}`,
  `- 学生执行提示：${cleanMarkdown(angle.feasibilityNote)}`,
  '',
  '#### 所需证据',
  '',
  list(angle.evidenceNeeded),
  '',
  '#### 必要信源角色',
  '',
  list(angle.sourceRoles),
  '',
  '#### 主要风险',
  '',
  list(angle.risks),
].join('\n');

const interviewPlanMarkdown = (plan: InterviewPlan) => [
  `### ${cleanMarkdown(plan.sourceRole)}`,
  '',
  '| 阶段 | 问题 | 目的 | 预期证据 |',
  '| --- | --- | --- | --- |',
  ...plan.questions.map((question) =>
    `| ${cleanMarkdown(question.stage)} | ${cleanMarkdown(question.question)} | ${cleanMarkdown(question.purpose)} | ${cleanMarkdown(question.expectedEvidence)} |`,
  ),
].join('\n');

export function buildStudentPlanMarkdown(plan: StudentReportingPlan): string {
  const recommendedAngle = plan.candidateAngles.find(
    (angle) => angle.id === plan.recommendedAngleId,
  );
  const newsValueRows = plan.newsValueAssessment.dimensions.map(
    (dimension) =>
      `| ${cleanMarkdown(dimension.label)} | ${dimension.score.toFixed(1)} / 10 | ${cleanMarkdown(dimension.rationale)} |`,
  );
  const sourceRows = plan.sourceMap.map(
    (source) =>
      `| ${cleanMarkdown(source.role)} | ${cleanMarkdown(source.informationValue)} | ${accessibilityLabel[source.accessibility]} | ${cleanMarkdown(source.possibleBias)} | ${cleanMarkdown(source.alternativeSources.join('；'))} |`,
  );
  const evidenceBlocks = plan.evidenceLedger.length
    ? plan.evidenceLedger.map((evidence) => [
        `### ${cleanMarkdown(evidence.id)} · ${cleanMarkdown(evidence.title)}`,
        '',
        `- 发布者：${cleanMarkdown(evidence.publisher)}`,
        `- 来源类型：${cleanMarkdown(evidence.sourceType)}`,
        `- 可信度分级：${cleanMarkdown(evidence.credibilityTier)}`,
        `- 获取时间：${cleanMarkdown(evidence.retrievedAt)}`,
        `- 摘要：${cleanMarkdown(evidence.summary)}`,
        `- 支持的说法：${evidence.supports.length ? evidence.supports.map(cleanMarkdown).join('；') : '暂无，不得据此确认事实'}`,
        `- 反驳的说法：${evidence.contradicts.length ? evidence.contradicts.map(cleanMarkdown).join('；') : '暂无'}`,
      ].join('\n')).join('\n\n')
    : '- 暂无证据记录。当前信息只能作为采访与检索线索。';
  const claimRows = plan.claimEvidenceMatrix.map(
    (claim) =>
      `| ${cleanMarkdown(claim.claim)} | ${claim.requiredEvidence.map(cleanMarkdown).join('；')} | ${claim.linkedEvidenceIds.map(cleanMarkdown).join('、') || '无'} | ${evidenceStatusLabel[claim.status]} | ${claim.remainingWork.map(cleanMarkdown).join('；')} |`,
  );

  return [
    '# NewsPilot 课程采访策划案',
    '',
    `> 工作模式：${plan.brief.mode === 'course' ? '课程作业模式' : '校园媒体模式'}  `,
    `> 生成方式：${cleanMarkdown(plan.mode)}  `,
    `> 生成时间：${cleanMarkdown(plan.generatedAt)}`,
    '',
    '> **编辑边界：本策划案只帮助组织报道工作。没有真实采访时不生成引语；没有证据支持时不把工作假设写成事实。**',
    '',
    '## 一、任务要求摘要',
    '',
    cleanMarkdown(plan.assignmentSummary),
    '',
    `- 作业/稿件类型：${cleanMarkdown(plan.brief.assignmentType)}`,
    `- 截止或发布时间：${cleanMarkdown(plan.brief.deadline || plan.brief.publishAt || '未填写')}`,
    `- 目标字数：${cleanMarkdown(plan.brief.targetLength || '未限定')}`,
    `- 最低采访人数：${cleanMarkdown(plan.brief.minimumInterviewees || 1)}`,
    `- 教师或编辑要求：${cleanMarkdown(plan.brief.teacherRequirements || '未填写')}`,
    `- 提交格式：${cleanMarkdown(plan.brief.formatRequirements || '未限定')}`,
    `- 其他硬性要求：${cleanMarkdown(plan.brief.otherHardConstraints?.join('；') || '无')}`,
    '',
    '## 二、主题与新闻问题',
    '',
    `- 原始主题：${cleanMarkdown(plan.topicFrame.rawTopic)}`,
    `- 可报道的新闻问题：${cleanMarkdown(plan.topicFrame.newsQuestion)}`,
    `- 工作假设（不得作为事实）：${cleanMarkdown(plan.topicFrame.workingHypothesis)}`,
    '',
    '### 已知、假设与未知',
    '',
    '**当前已知（仍需核对）**',
    '',
    list(plan.topicFrame.knownFacts),
    '',
    '**当前假设**',
    '',
    list(plan.topicFrame.assumptions),
    '',
    '**关键未知**',
    '',
    list(plan.topicFrame.unknowns),
    '',
    '## 三、GO / REVISE / HOLD / DROP 判断',
    '',
    `**${plan.verdict.status}**`,
    '',
    list(plan.verdict.reasons),
    '',
    `- 最大优势：${cleanMarkdown(plan.verdict.greatestStrength)}`,
    `- 最大风险：${cleanMarkdown(plan.verdict.greatestRisk)}`,
    `- 收窄建议：${cleanMarkdown(plan.verdict.narrowingAdvice)}`,
    `- 最小可行版本：${cleanMarkdown(plan.verdict.minimumViableVersion)}`,
    '',
    '## 四、新闻价值与执行可行性',
    '',
    '| 新闻价值维度 | 得分 | 判断依据 |',
    '| --- | ---: | --- |',
    ...newsValueRows,
    '',
    `- 新闻价值综合分：${plan.newsValueAssessment.overallScore.toFixed(1)} / 10`,
    `- 执行可行性：${plan.feasibilityScore.toFixed(1)} / 10`,
    `- 评分说明：${cleanMarkdown(plan.newsValueAssessment.summary)}`,
    '',
    '## 五、可执行报道策略',
    '',
    list(plan.candidateAngles.map((angle) => `${angle.strategyName}：${angle.feasibilityNote}`)),
    '',
    '## 六、候选角度比较',
    '',
    plan.candidateAngles
      .map((angle) => angleMarkdown(angle, angle.id === plan.recommendedAngleId))
      .join('\n\n---\n\n'),
    '',
    '## 七、推荐角度',
    '',
    recommendedAngle
      ? angleMarkdown(recommendedAngle, true)
      : '暂无推荐角度，需要先补充主题与任务信息。',
    '',
    '## 八、信源地图',
    '',
    '| 信源角色 | 信息价值 | 可达性 | 可能偏差 | 替代信源 |',
    '| --- | --- | --- | --- | --- |',
    ...sourceRows,
    '',
    '## 九、采访提纲',
    '',
    plan.interviewPlans.map(interviewPlanMarkdown).join('\n\n'),
    '',
    '## 十、证据账本',
    '',
    evidenceBlocks,
    '',
    '## 十一、关键说法交叉验证矩阵',
    '',
    '| 待验证说法 | 所需证据 | 已关联 evidenceId | 状态 | 剩余工作 |',
    '| --- | --- | --- | --- | --- |',
    ...claimRows,
    '',
    '## 十二、事实核查清单',
    '',
    list(plan.factCheckChecklist),
    '',
    '## 十三、伦理与报道风险',
    '',
    list(plan.ethicalRisks),
    '',
    '## 十四、当前缺失信息',
    '',
    list(plan.missingInformation),
    '',
    '## 十五、48 小时行动计划',
    '',
    numbered(plan.actionPlan.map((item) => `${item.when}｜${item.action}｜产出：${item.output}`)),
    '',
    '## 十六、提交前自查',
    '',
    list(plan.submissionChecklist),
    '',
    '---',
    '',
    '本文件是采访与验证计划，不是已经完成的新闻报道。所有事实、数字和引语均需由学生记者自行核实。',
  ].join('\n');
}

const safeFileName = (value: string) =>
  value
    .trim()
    .replace(/[\\/:*?"<>|]/gu, '-')
    .replace(/\s+/gu, '-')
    .replace(/-+/gu, '-')
    .slice(0, 48) || '未命名主题';

export function exportStudentPlanMarkdown(plan: StudentReportingPlan): void {
  const blob = new Blob([buildStudentPlanMarkdown(plan)], {
    type: 'text/markdown;charset=utf-8',
  });
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement('a');
  anchor.href = url;
  anchor.download = `${safeFileName(plan.brief.rawTopic)}-课程采访策划案.md`;
  document.body.appendChild(anchor);
  anchor.click();
  document.body.removeChild(anchor);
  URL.revokeObjectURL(url);
}
