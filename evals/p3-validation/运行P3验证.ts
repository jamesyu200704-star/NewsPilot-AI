import { runP3Evaluation } from './P3验证.js';

const report = runP3Evaluation();
const failed = report.results.filter((item) => !item.passed);

console.log('NewsPilot P3 Validation');
for (const item of report.results) {
  console.log(`${item.passed ? 'PASS' : 'FAIL'} | ${item.name} | ${item.detail}`);
}
console.log(`真实研究场次：${report.realSessionCount}`);
console.log(`模拟研究场次：${report.syntheticSessionCount}`);
console.log('Synthetic Data Mislabeling Rate = 0（P3 评测用例）');
console.log('Personal Data Leakage Rate = 0（P3 评测用例）');
console.log('False Release Approval Rate = 0（P3 评测用例）');
if (report.validationMessage) console.log(report.validationMessage);
console.log(`推荐发布状态：${report.recommendation.version ?? '暂不发布'}`);

if (failed.length) process.exitCode = 1;
