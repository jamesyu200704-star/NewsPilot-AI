import assert from 'node:assert/strict';
import test from 'node:test';
import { evaluateP1EvidenceCases, P1证据评测题库 } from '../../evals/p1-evidence/P1证据评测.js';

test('P1 证据评测覆盖 30 个案例且关键事实错误核实率为 0', () => {
  const report = evaluateP1EvidenceCases();
  assert.equal(P1证据评测题库.length, 30);
  assert.equal(new Set(P1证据评测题库.map((item) => item.category)).size, 10);
  assert.equal(report.metrics.falseVerificationRate, 0);
  assert.equal(report.metrics.citationIntegrity, 1);
  assert.equal(report.metrics.conflictDetectionRate, 1);
  assert.equal(report.metrics.duplicateReductionRate, 1);
  assert.equal(report.passed, report.total, JSON.stringify(report.failures));
});
