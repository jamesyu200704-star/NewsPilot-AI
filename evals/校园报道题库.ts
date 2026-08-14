import type { ReportingBrief } from '../shared/学生报道模型.js';
import { createStudentReportingPlan } from '../shared/学生报道工作流.js';

export interface CampusReportingEval {
  id: string;
  category:
    | '人物特稿'
    | '校园服务'
    | '教育变化'
    | '学生消费'
    | '校园政策'
    | '社交现象'
    | '体育活动'
    | '就业焦虑'
    | 'AI 使用'
    | '校园安全';
  brief: ReportingBrief;
  expectedChecks: string[];
}

const topics: Array<[CampusReportingEval['category'], string, ReportingBrief['assignmentType']]> = [
  ['人物特稿', '凌晨四点开始工作的校园早餐摊主', '人物特稿'],
  ['人物特稿', '一名学生志愿者如何持续帮助视障同学', '人物特稿'],
  ['校园服务', '新选课系统上线后学生办事时间是否缩短', '消息'],
  ['校园服务', '校园夜间摆渡车能否覆盖晚课学生需求', '校园调查'],
  ['教育变化', '课堂展示从结果评分转向过程评分', '深度报道'],
  ['教育变化', '跨专业课程扩容后学生获得了什么', '校园调查'],
  ['学生消费', '校园二手交易中的验货与纠纷', '校园调查'],
  ['学生消费', '食堂轻食套餐价格变化对学生选择的影响', '消息'],
  ['校园政策', '宿舍门禁调整在不同年级如何执行', '校园调查'],
  ['校园政策', '校园电动车新规落地后的停车变化', '消息'],
  ['社交现象', '大学生搭子社交为何流行又快速结束', '校园调查'],
  ['社交现象', '匿名校园墙如何影响同学求助与表达', '深度报道'],
  ['体育活动', '校队普通替补队员的一整个赛季', '人物特稿'],
  ['体育活动', '校园夜跑活动能否持续吸引初学者', '消息'],
  ['就业焦虑', '秋招提前如何改变低年级学生准备节奏', '校园调查'],
  ['就业焦虑', '实习经历越来越早是否真的提高求职机会', '深度报道'],
  ['AI 使用', '生成式 AI 如何改变教师评价课程作业的方式', '校园调查'],
  ['AI 使用', '学生在小组作业中如何约定 AI 使用边界', '消息'],
  ['校园安全', '实验室夜间使用中的安全提示是否有效', '校园调查'],
  ['校园安全', '校园反诈宣传如何触达新生真实风险', '消息'],
];

export const 校园报道评估题库: CampusReportingEval[] = topics.map(
  ([category, rawTopic, assignmentType], index) => ({
    id: `campus-eval-${String(index + 1).padStart(2, '0')}`,
    category,
    brief: {
      mode: 'course',
      rawTopic,
      assignmentType,
      deadline: '2026-08-20',
      targetLength: 1800,
      minimumInterviewees: 3,
      geographicScope: '本校校园',
      targetAudience: '本校学生',
      availableInterviewees: ['直接经历者', '相关同学', '负责老师'],
      existingMaterials: [],
      reportingResources: ['1 名文字记者', '手机录音'],
      ethicalConstraints: ['保护个人隐私'],
    },
    expectedChecks: [
      '新闻问题是否明确',
      '采访对象是否可达',
      '证据覆盖是否充分',
      '行动计划是否可执行',
    ],
  }),
);

export type EvalDimension =
  | 'topicFraming'
  | 'angleQuality'
  | 'sourceCoverage'
  | 'interviewQuality'
  | 'evidenceSafety'
  | 'actionPlan';

export interface CampusReportingEvalResult {
  id: string;
  category: CampusReportingEval['category'];
  passed: boolean;
  checks: Record<EvalDimension, boolean>;
}

export interface CampusReportingEvalReport {
  total: number;
  passed: number;
  failed: number;
  dimensionPassRates: Record<EvalDimension, number>;
  results: CampusReportingEvalResult[];
}

const dimensions: EvalDimension[] = [
  'topicFraming',
  'angleQuality',
  'sourceCoverage',
  'interviewQuality',
  'evidenceSafety',
  'actionPlan',
];

export function evaluateCampusReportingCases(): CampusReportingEvalReport {
  const results = 校园报道评估题库.map((item): CampusReportingEvalResult => {
    const plan = createStudentReportingPlan(item.brief);
    const checks: Record<EvalDimension, boolean> = {
      topicFraming:
        plan.topicFrame.newsQuestion.length > 12 &&
        plan.topicFrame.newsQuestion !== item.brief.rawTopic &&
        /假设/u.test(plan.topicFrame.workingHypothesis) &&
        plan.topicFrame.unknowns.length >= 3,
      angleQuality:
        plan.candidateAngles.length === 3 &&
        new Set(plan.candidateAngles.map((angle) => angle.strategyId)).size === 3 &&
        plan.recommendedAngleId === plan.candidateAngles[0]?.id &&
        plan.candidateAngles.every(
          (angle) =>
            angle.totalScore >= 0 &&
            angle.totalScore <= 10 &&
            angle.evidenceNeeded.length > 0,
        ),
      sourceCoverage:
        plan.sourceMap.length >= 5 &&
        plan.sourceMap.some((source) => source.id === 'source-experiencer') &&
        plan.sourceMap.some((source) => source.id === 'source-executor') &&
        plan.sourceMap
          .filter((source) => source.accessibility === 'low')
          .every((source) => source.alternativeSources.length > 0),
      interviewQuality:
        plan.interviewPlans.length >= 4 &&
        plan.interviewPlans.every(
          (group) =>
            new Set(group.questions.map((question) => question.stage)).size === 8 &&
            group.questions.every(
              (question) =>
                question.followUps.length > 0 &&
                !question.isLeading &&
                !question.isDoubleBarreled,
            ),
        ),
      evidenceSafety:
        plan.evidenceLedger.every((evidence) => evidence.supports.length === 0) &&
        plan.claimEvidenceMatrix.every((claim) => claim.status === 'unverified') &&
        plan.factCheckChecklist.some((item) => /不生成引语/u.test(item)),
      actionPlan:
        plan.actionPlan.length >= 4 &&
        plan.actionPlan.every(
          (action, index) => action.order === index + 1 && action.output.length > 5,
        ),
    };
    return {
      id: item.id,
      category: item.category,
      passed: dimensions.every((dimension) => checks[dimension]),
      checks,
    };
  });

  const passed = results.filter((result) => result.passed).length;
  const dimensionPassRates = Object.fromEntries(
    dimensions.map((dimension) => [
      dimension,
      Number(
        (
          results.filter((result) => result.checks[dimension]).length /
          Math.max(1, results.length)
        ).toFixed(2),
      ),
    ]),
  ) as Record<EvalDimension, number>;

  return {
    total: results.length,
    passed,
    failed: results.length - passed,
    dimensionPassRates,
    results,
  };
}
