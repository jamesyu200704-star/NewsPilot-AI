import type {
  ReportingBrief,
  StudentReportingPlan,
} from './学生报道模型.js';
import type { EvidenceWorkspaceState } from './证据领域模型.js';
import { createEmptyEvidenceWorkspace, isEvidenceWorkspace } from './证据工作区.js';
import type { ExecutionWorkspaceState } from './报道执行模型.js';
import {
  createEmptyExecutionWorkspace,
  createExecutionWorkspaceFromPlan,
  isExecutionWorkspace,
} from './报道执行工作区.js';

export const LOCAL_PROJECT_DATA_VERSION = 3 as const;

export interface LocalReportingProject {
  dataVersion: typeof LOCAL_PROJECT_DATA_VERSION;
  id: string;
  name: string;
  brief: ReportingBrief;
  plan: StudentReportingPlan | null;
  selectedAngleId: string;
  evidenceWorkspace: EvidenceWorkspaceState;
  executionWorkspace: ExecutionWorkspaceState;
  createdAt: string;
  updatedAt: string;
}

export interface LocalProjectExport {
  format: 'newspilot-local-projects';
  dataVersion: typeof LOCAL_PROJECT_DATA_VERSION;
  exportedAt: string;
  projects: LocalReportingProject[];
}

export function createLocalReportingProject(input: {
  id: string;
  name: string;
  brief: ReportingBrief;
  plan?: StudentReportingPlan | null;
  selectedAngleId?: string;
  evidenceWorkspace?: EvidenceWorkspaceState;
  executionWorkspace?: ExecutionWorkspaceState;
  now?: string;
}): LocalReportingProject {
  const now = input.now || new Date().toISOString();
  if (!input.id.trim() || !input.name.trim()) {
    throw new Error('本地项目必须包含编号和名称。');
  }
  return {
    dataVersion: LOCAL_PROJECT_DATA_VERSION,
    id: input.id.trim(),
    name: input.name.trim(),
    brief: structuredClone(input.brief),
    plan: input.plan ? structuredClone(input.plan) : null,
    selectedAngleId: input.selectedAngleId || '',
    evidenceWorkspace: input.evidenceWorkspace
      ? structuredClone(input.evidenceWorkspace)
      : createEmptyEvidenceWorkspace(now),
    executionWorkspace: input.executionWorkspace
      ? structuredClone(input.executionWorkspace)
      : input.plan
        ? createExecutionWorkspaceFromPlan(input.plan, now)
        : createEmptyExecutionWorkspace(now),
    createdAt: now,
    updatedAt: now,
  };
}

const isRecord = (value: unknown): value is Record<string, unknown> =>
  Boolean(value) && typeof value === 'object' && !Array.isArray(value);

const isBrief = (value: unknown): value is ReportingBrief => {
  if (!isRecord(value)) return false;
  return (
    ['course', 'campus_media'].includes(String(value.mode)) &&
    typeof value.rawTopic === 'string' &&
    typeof value.assignmentType === 'string' &&
    Array.isArray(value.availableInterviewees) &&
    Array.isArray(value.existingMaterials) &&
    Array.isArray(value.reportingResources) &&
    Array.isArray(value.ethicalConstraints)
  );
};

const isPlan = (value: unknown): value is StudentReportingPlan => {
  if (!isRecord(value) || !isBrief(value.brief)) return false;
  return (
    typeof value.assignmentSummary === 'string' &&
    isRecord(value.topicFrame) &&
    typeof value.topicFrame.newsQuestion === 'string' &&
    isRecord(value.verdict) &&
    ['GO', 'REVISE', 'HOLD', 'DROP'].includes(String(value.verdict.status)) &&
    Array.isArray(value.candidateAngles) &&
    typeof value.recommendedAngleId === 'string' &&
    Array.isArray(value.sourceMap) &&
    Array.isArray(value.interviewPlans) &&
    Array.isArray(value.evidenceLedger) &&
    Array.isArray(value.claimEvidenceMatrix) &&
    Array.isArray(value.actionPlan) &&
    typeof value.generatedAt === 'string' &&
    !Number.isNaN(Date.parse(value.generatedAt))
  );
};

const isProject = (value: unknown): value is LocalReportingProject => {
  if (!isRecord(value)) return false;
  return (
    value.dataVersion === LOCAL_PROJECT_DATA_VERSION &&
    typeof value.id === 'string' &&
    Boolean(value.id.trim()) &&
    typeof value.name === 'string' &&
    Boolean(value.name.trim()) &&
    typeof value.createdAt === 'string' &&
    !Number.isNaN(Date.parse(value.createdAt)) &&
    typeof value.updatedAt === 'string' &&
    !Number.isNaN(Date.parse(value.updatedAt)) &&
    isBrief(value.brief) &&
    (value.plan === null || isPlan(value.plan)) &&
    typeof value.selectedAngleId === 'string' &&
    isEvidenceWorkspace(value.evidenceWorkspace) &&
    isExecutionWorkspace(value.executionWorkspace)
  );
};

export function serializeLocalProjects(
  projects: LocalReportingProject[],
  exportedAt = new Date().toISOString(),
) {
  return JSON.stringify(
    {
      format: 'newspilot-local-projects',
      dataVersion: LOCAL_PROJECT_DATA_VERSION,
      exportedAt,
      projects,
    } satisfies LocalProjectExport,
    null,
    2,
  );
}

export function parseLocalProjectImport(serialized: string): LocalProjectExport {
  let value: unknown;
  try {
    value = JSON.parse(serialized);
  } catch {
    throw new Error('项目文件已损坏：不是有效 JSON。');
  }
  if (!isRecord(value)) throw new Error('项目文件无效或已损坏。');
  if (value.format !== 'newspilot-local-projects') {
    throw new Error('项目文件无效或已损坏：格式标识缺失。');
  }
  if (!Object.hasOwn(value, 'dataVersion')) {
    throw new Error('项目文件无效或已损坏：数据结构版本缺失。');
  }
  if ((value.dataVersion === 1 || value.dataVersion === 2) && Array.isArray(value.projects)) {
    const legacyVersion = value.dataVersion;
    const migratedProjects = value.projects.map((project) => {
      if (!isRecord(project)) throw new Error('项目文件无效或已损坏：字段校验失败。');
      const updatedAt =
        typeof project.updatedAt === 'string' && !Number.isNaN(Date.parse(project.updatedAt))
          ? project.updatedAt
          : new Date().toISOString();
      const plan = isPlan(project.plan) ? project.plan : null;
      return {
        ...project,
        dataVersion: LOCAL_PROJECT_DATA_VERSION,
        evidenceWorkspace:
          legacyVersion === 2 && isEvidenceWorkspace(project.evidenceWorkspace)
            ? project.evidenceWorkspace
            : createEmptyEvidenceWorkspace(updatedAt),
        executionWorkspace: plan
          ? createExecutionWorkspaceFromPlan(plan, updatedAt)
          : createEmptyExecutionWorkspace(updatedAt),
      };
    });
    value = { ...value, dataVersion: LOCAL_PROJECT_DATA_VERSION, projects: migratedProjects };
  }
  if (!isRecord(value)) throw new Error('项目文件无效或已损坏。');
  if (value.dataVersion !== LOCAL_PROJECT_DATA_VERSION) {
    throw new Error(`不支持的数据结构版本：${String(value.dataVersion)}。`);
  }
  if (
    typeof value.exportedAt !== 'string' ||
    Number.isNaN(Date.parse(value.exportedAt)) ||
    !Array.isArray(value.projects) ||
    !value.projects.every(isProject)
  ) {
    throw new Error('项目文件无效或已损坏：字段校验失败。');
  }
  return value as unknown as LocalProjectExport;
}
