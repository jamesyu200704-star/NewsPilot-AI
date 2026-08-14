import { runP2ExecutionEvaluation } from './P2执行评测.js';

const result = await runP2ExecutionEvaluation();
console.log(JSON.stringify(result, null, 2));
if (!result.passed) process.exitCode = 1;
