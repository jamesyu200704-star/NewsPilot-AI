import { evaluateP1EvidenceCases } from './P1证据评测.js';

const labels = {
  primarySourceRecall: 'Primary Source Recall',
  sourcePrecisionAtK: 'Source Precision@K',
  duplicateReductionRate: 'Duplicate Reduction Rate',
  independentSourceAccuracy: 'Independent Source Accuracy',
  claimCoverage: 'Claim Coverage',
  citationIntegrity: 'Citation Integrity',
  conflictDetectionRate: 'Conflict Detection Rate',
  falseVerificationRate: 'False Verification Rate',
  unverifiedRecall: 'Unverified Recall',
} as const;

const report = evaluateP1EvidenceCases();
console.log(`NewsPilot P1 证据专项评测：${report.passed}/${report.total} 个合成案例符合保守核验预期`);
for (const [metric, value] of Object.entries(report.metrics)) {
  console.log(`- ${labels[metric as keyof typeof labels]}：${(value * 100).toFixed(1)}%`);
}
console.log('说明：题库只使用合成来源与本地规则，不访问真实互联网，也不代表真实新闻事实。');

for (const failure of report.failures) console.error(`- ${failure.id}：${failure.reasons.join('；')}`);
if (report.failures.length || report.metrics.falseVerificationRate !== 0) process.exitCode = 1;
