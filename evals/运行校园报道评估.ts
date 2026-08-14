import { evaluateCampusReportingCases } from './校园报道题库.js';

const dimensionLabels = {
  topicFraming: '选题拆解',
  angleQuality: '角度结构',
  sourceCoverage: '信源覆盖',
  interviewQuality: '采访问题结构',
  evidenceSafety: '证据安全',
  actionPlan: '行动计划',
} as const;

const report = evaluateCampusReportingCases();

console.log(`NewsPilot 校园报道规则回归：${report.passed}/${report.total} 个案例满足结构约束`);
for (const [dimension, rate] of Object.entries(report.dimensionPassRates)) {
  console.log(
    `- ${dimensionLabels[dimension as keyof typeof dimensionLabels]}：${Math.round(rate * 100)}%`,
  );
}

console.log('说明：本结果不是用户测试、人工盲评或新闻质量结论。');

if (report.failed > 0) {
  for (const result of report.results.filter((item) => !item.passed)) {
    const failures = Object.entries(result.checks)
      .filter(([, passed]) => !passed)
      .map(([dimension]) => dimensionLabels[dimension as keyof typeof dimensionLabels]);
    console.error(`- ${result.id} / ${result.category}：${failures.join('、')}`);
  }
  process.exitCode = 1;
}
