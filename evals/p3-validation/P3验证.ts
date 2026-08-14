import { existsSync, readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import {
  blindReviewDimensions,
  canRevealBlindComparison,
  createBlindComparison,
  type BlindReviewScore,
} from '../../shared/人工盲评.js';
import {
  RESEARCH_VALIDATION_NOTICE,
  createProductEvent,
  createReleaseGateCatalog,
  evaluateReleaseReadiness,
  filterResearchData,
  isFeatureFreezeCompliant,
  parseResearchDataBundle,
  prioritizeProductIssue,
  type ProductIssue,
  type ResearchDataBundle,
} from '../../shared/产品验证.js';

export interface P3EvaluationResult {
  name: string;
  passed: boolean;
  detail: string;
}

const emptyResearchBundle = (): ResearchDataBundle => ({
  format: 'newspilot-research-bundle', schemaVersion: 2,
  exportedAt: new Date(0).toISOString(), participants: [], sessions: [],
  observations: [], events: [], issues: [],
});

const unresolvedPrivacyIssue: ProductIssue = {
  id: 'privacy-case', title: '私人信息泄露', description: '评测用例',
  category: 'privacy', severity: 'low', frequency: 'rare',
  userImpact: 'minor_friction', evidence: { sessionIds: [], screenshots: [], notes: [] },
  status: 'confirmed', releaseBlocker: false,
  createdAt: new Date(0).toISOString(), updatedAt: new Date(0).toISOString(),
};

export function runP3Evaluation(root = process.cwd()) {
  const researchPath = resolve(root, 'research', 'results', '真实研究包.json');
  const bundle = existsSync(researchPath)
    ? parseResearchDataBundle(readFileSync(researchPath, 'utf8'))
    : emptyResearchBundle();
  const real = filterResearchData(bundle, 'real');
  const synthetic = filterResearchData(bundle, 'synthetic');

  const comparison = createBlindComparison({
    caseId: 'p3-eval', synthetic: true,
    outputs: [
      { source: 'newspilot', content: 'NewsPilot 评测用方案' },
      { source: 'general_model', content: 'ChatGPT 评测用方案' },
      { source: 'student', content: '学生自行策划评测用方案' },
    ],
  }, 17);
  const scores: BlindReviewScore[] = comparison.packet.variants.map(({ anonymousId }) => ({
    anonymousId,
    scores: Object.fromEntries(blindReviewDimensions.map(({ key }) => [key, 3])) as BlindReviewScore['scores'],
    comment: '',
  }));
  const event = createProductEvent({
    id: 'event', sessionId: 'session', eventName: 'question_edited', page: 'interview',
    timestamp: new Date(0).toISOString(), synthetic: true,
    metadata: { count: 1, transcript: '不应保留', privateNote: '不应保留' },
  });
  const gates = createReleaseGateCatalog().map((gate) => ({ ...gate, status: gate.type === 'research' ? 'blocked' as const : 'passed' as const }));
  const betaDecision = evaluateReleaseReadiness({ gates, issues: [], realSessionCount: real.sessions.length });
  const blockedDecision = evaluateReleaseReadiness({ gates, issues: [prioritizeProductIssue(unresolvedPrivacyIssue)], realSessionCount: 0 });

  const examples = ['profile-feature', 'campus-investigation', 'policy-observation'];
  const exampleSafety = examples.every((directory) => {
    const path = resolve(root, 'examples', directory, 'README.md');
    if (!existsSync(path)) return false;
    const content = readFileSync(path, 'utf8');
    return /虚构教学数据/u.test(content) && !/[A-Z]:\\Users\\|\bsk-/u.test(content);
  });

  const results: P3EvaluationResult[] = [
    { name: 'Research Data Separation', passed: real.sessions.every((item) => !item.synthetic) && synthetic.sessions.every((item) => item.synthetic), detail: `真实 ${real.sessions.length}，模拟 ${synthetic.sessions.length}` },
    { name: 'Participant Anonymity', passed: bundle.participants.every((item) => /^P\d{3,}$/u.test(item.id)), detail: '只允许 P001 形式匿名编号' },
    { name: 'Blind Evaluation Integrity', passed: !canRevealBlindComparison(comparison.packet, []) && canRevealBlindComparison(comparison.packet, scores), detail: '评分提交前不可揭盲' },
    { name: 'Event Privacy', passed: JSON.stringify(event.metadata) === '{"count":1}', detail: '敏感元数据已剔除' },
    { name: 'Issue Prioritization', passed: prioritizeProductIssue(unresolvedPrivacyIssue).severity === 'critical', detail: '隐私问题自动升级为 Critical' },
    { name: 'Release Gate Accuracy', passed: betaDecision.recommendation === 'beta' && blockedDecision.recommendation === 'hold', detail: '无真实验证不批准 V1，Critical 不批准 Release' },
    { name: 'Example Data Safety', passed: exampleSafety, detail: '三个示例均声明虚构教学数据' },
    { name: 'Public Export Safety', passed: !JSON.stringify(event).includes('不应保留'), detail: '公开事件导出不含敏感正文' },
    { name: 'Feature Freeze Compliance', passed: isFeatureFreezeCompliant(['test', 'documentation', 'privacy']) && !isFeatureFreezeCompliant(['new_provider']), detail: '冻结期拒绝新增 Provider' },
  ];

  return {
    results,
    realSessionCount: real.sessions.length,
    syntheticSessionCount: synthetic.sessions.length,
    recommendation: betaDecision,
    validationMessage: real.sessions.length ? '' : RESEARCH_VALIDATION_NOTICE,
  };
}
