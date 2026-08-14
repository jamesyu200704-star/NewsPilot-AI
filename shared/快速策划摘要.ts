import type {
  StudentReportingPlan,
  VerdictStatus,
} from './学生报道模型.js';

export interface QuickReportingSummary {
  verdict: VerdictStatus;
  newsQuestion: string;
  recommendedAngle: {
    title: string;
    strategy: string;
    rationale: string;
  };
  firstSources: Array<{
    role: string;
    why: string;
  }>;
  firstMaterials: string[];
  biggestRisk: string;
  immediateActions: string[];
}

const unique = (items: string[]) => [...new Set(items.filter(Boolean))];

export function buildQuickReportingSummary(
  plan: StudentReportingPlan,
): QuickReportingSummary {
  const recommended =
    plan.candidateAngles.find((angle) => angle.id === plan.recommendedAngleId) ??
    plan.candidateAngles[0];
  const materials = unique([
    ...(recommended?.evidenceNeeded || []),
    ...plan.sourceMap
      .filter((source) => source.id === 'source-documents')
      .flatMap((source) => source.verificationTargets),
    '相关规则或通知原文',
    '可核对的时间线记录',
    '不同角色的一手采访记录',
  ]).slice(0, 3);

  return {
    verdict: plan.verdict.status,
    newsQuestion: plan.topicFrame.newsQuestion,
    recommendedAngle: {
      title: recommended?.title || '尚无推荐角度',
      strategy: recommended?.strategyName || '待补充',
      rationale: recommended?.rationale || '需要先补充任务信息。',
    },
    firstSources: plan.sourceMap.slice(0, 3).map((source) => ({
      role: source.role,
      why: source.informationValue,
    })),
    firstMaterials: materials,
    biggestRisk: plan.verdict.greatestRisk,
    immediateActions: plan.actionPlan.slice(0, 3).map((item) => item.action),
  };
}
