import assert from 'node:assert/strict';
import test from 'node:test';
import { p2EvaluationFixtures, runP2ExecutionEvaluation } from '../../evals/p2-execution/P2执行评测.js';

test('P2 执行评测覆盖至少 20 个离线合成项目且四项硬错误为 0', async () => {
  assert.ok(p2EvaluationFixtures.length >= 20);
  const result = await runP2ExecutionEvaluation();
  assert.equal(result.caseResults.length, p2EvaluationFixtures.length);
  assert.equal(result.hardFailureRates.fabricatedInterviewContentRate, 0);
  assert.equal(result.hardFailureRates.falseDirectQuoteRate, 0);
  assert.equal(result.hardFailureRates.offRecordExportRate, 0);
  assert.equal(result.hardFailureRates.privateInformationLeakageRate, 0);
  assert.equal(result.passed, true);
  assert.ok(result.metrics.taskPlanCompleteness >= 0.95);
  assert.ok(result.metrics.deadlineFeasibility >= 0.95);
  assert.ok(result.metrics.exportIntegrity >= 0.95);
});
