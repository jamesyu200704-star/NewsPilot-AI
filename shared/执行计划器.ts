import type { ReportingBrief } from './学生报道模型.js';
import type { ReportingTask, ReportingTaskType } from './报道执行模型.js';

export interface ExecutionPlanInput {
  brief: ReportingBrief;
  sourceIds: string[];
  now?: string;
}

interface TaskTemplate {
  key: string;
  title: string;
  description: string;
  type: ReportingTaskType;
  priority: ReportingTask['priority'];
  estimatedMinutes: number;
  dependsOn: string[];
  completionCriteria: string;
}

const template: TaskTemplate[] = [
  { key: 'angle', title: '确认报道角度与核心问题', description: '锁定一个可核验、可采访的报道问题。', type: 'define_angle', priority: 'critical', estimatedMinutes: 30, dependsOn: [], completionCriteria: '角度、范围与核心问题已由记者确认。' },
  { key: 'desk', title: '完成基础案头研究', description: '收集公开通知、原始文件和已有材料。', type: 'research', priority: 'high', estimatedMinutes: 60, dependsOn: ['angle'], completionCriteria: '至少保存一份原始来源并建立待核验主张。' },
  { key: 'contact', title: '联系关键采访对象', description: '使用联系模板，人工发送并记录结果。', type: 'contact_source', priority: 'critical', estimatedMinutes: 45, dependsOn: ['angle'], completionCriteria: '关键对象均有联系记录、回应状态或替代来源。' },
  { key: 'guide', title: '按信源准备采访提纲', description: '将问题绑定主张、证据缺口和预期证据。', type: 'prepare_interview', priority: 'high', estimatedMinutes: 45, dependsOn: ['desk'], completionCriteria: '每个关键采访对象都有经人工确认的问题提纲。' },
  { key: 'interview', title: '完成关键采访', description: '核对同意与归因后进行采访并记录未回答项。', type: 'interview', priority: 'critical', estimatedMinutes: 90, dependsOn: ['contact', 'guide'], completionCriteria: '采访笔记、同意与归因、未回答项和采访后复盘完整。' },
  { key: 'process', title: '整理采访证据', description: '复核笔记与转写，确认候选引语、线索与矛盾。', type: 'process_interview', priority: 'high', estimatedMinutes: 60, dependsOn: ['interview'], completionCriteria: '采访材料已人工复核且未把受访者说法自动当作事实。' },
  { key: 'verify', title: '关闭关键证据缺口', description: '补原始文件、对方回应、数据或独立佐证。', type: 'close_evidence_gap', priority: 'critical', estimatedMinutes: 90, dependsOn: ['desk', 'process'], completionCriteria: '关键缺口已解决、接受风险或明确放弃，不能静默忽略。' },
  { key: 'outline', title: '建立证据支撑的报道提纲', description: '每一节绑定主张、证据、引语和剩余缺口。', type: 'build_outline', priority: 'high', estimatedMinutes: 60, dependsOn: ['verify'], completionCriteria: '提纲无未标记的无证据结论，冲突和假设保持可见。' },
  { key: 'check', title: '完成作业与提交检查', description: '逐条检查采访数、来源多样性、隐私与文件要求。', type: 'assignment_check', priority: 'critical', estimatedMinutes: 30, dependsOn: ['outline'], completionCriteria: '所有 blocking 项已处理。' },
  { key: 'export', title: '导出课程提交包', description: '确认隐私清单后导出规定格式。', type: 'export_submission', priority: 'high', estimatedMinutes: 20, dependsOn: ['check'], completionCriteria: '导出文件可打开且不含私密、off-record 或未确认引语。' },
];

const deadlineFor = (brief: ReportingBrief) => {
  const raw = brief.deadline || brief.publishAt;
  const parsed = raw ? new Date(raw) : new Date(Date.now() + 7 * 86_400_000);
  return Number.isNaN(parsed.getTime()) ? new Date(Date.now() + 7 * 86_400_000) : parsed;
};

const safeNow = (raw?: string) => {
  const parsed = raw ? new Date(raw) : new Date();
  return Number.isNaN(parsed.getTime()) ? new Date() : parsed;
};

export class ExecutionPlanner {
  build(input: ExecutionPlanInput): ReportingTask[] {
    const now = safeNow(input.now);
    const deadline = deadlineFor(input.brief);
    const availableMinutes = Math.max(60, (deadline.getTime() - now.getTime()) / 60_000);
    const urgent = availableMinutes <= 48 * 60;
    const totalMinutes = template.reduce((sum, item) => sum + item.estimatedMinutes, 0);
    let cursor = deadline.getTime();

    const tasks = [...template].reverse().map((item, reverseIndex) => {
      const scaled = urgent ? Math.max(15, Math.round(item.estimatedMinutes * 0.55)) : item.estimatedMinutes;
      cursor -= Math.max(scaled, Math.round((availableMinutes - totalMinutes) / template.length)) * 60_000;
      const dueAt = new Date(Math.max(now.getTime(), cursor)).toISOString();
      const order = template.length - reverseIndex;
      return {
        id: `task-${item.key}`,
        title: item.title,
        description: item.description,
        type: item.type,
        status: 'todo',
        priority: item.priority,
        dueAt,
        estimatedMinutes: scaled,
        dependencyIds: item.dependsOn.map((key) => `task-${key}`),
        sourceIds: ['contact_source', 'prepare_interview', 'interview', 'process_interview'].includes(item.type)
          ? [...input.sourceIds]
          : [],
        claimIds: [],
        evidenceGapIds: [],
        completionCriteria: item.completionCriteria,
        isTodayFocus: false,
        order,
        createdAt: now.toISOString(),
        updatedAt: now.toISOString(),
      } satisfies ReportingTask;
    }).reverse();

    const topIds = (urgent
      ? ['task-contact', 'task-angle', 'task-verify']
      : tasks
          .filter((task) => Date.parse(task.dueAt) <= now.getTime() + 24 * 60 * 60 * 1000)
          .slice(0, 3)
          .map((task) => task.id));
    const fallbackIds = topIds.length === 3 ? topIds : tasks.slice(0, 3).map((task) => task.id);
    return tasks.map((task) => ({ ...task, isTodayFocus: fallbackIds.includes(task.id) }));
  }
}

export const computeTaskBlockers = (task: ReportingTask, allTasks: ReportingTask[]) => {
  const blockers = task.dependencyIds
    .map((id) => allTasks.find((candidate) => candidate.id === id))
    .filter((dependency): dependency is ReportingTask => dependency !== undefined)
    .filter((dependency) => dependency.status !== 'done')
    .map((dependency) => `等待：${dependency.title}`);
  if (task.manualBlocker?.trim()) blockers.push(task.manualBlocker.trim());
  return blockers;
};
