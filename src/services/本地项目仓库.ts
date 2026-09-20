import {
  createLocalReportingProject,
  parseLocalProjectImport,
  serializeLocalProjects,
  type LocalReportingProject,
} from '../../shared/本地项目模型.js';
import type { ReportingBrief } from '../../shared/学生报道模型.js';
import { inferInterviewSourceType } from '../../shared/报道执行工作区.js';

const STORAGE_KEY = 'newspilot.local-projects.v1';

export interface ProjectStorageAdapter {
  getItem(key: string): string | null;
  setItem(key: string, value: string): void;
  removeItem(key: string): void;
}

export interface LocalProjectRepository {
  list(): Promise<LocalReportingProject[]>;
  create(name: string, brief: ReportingBrief): Promise<LocalReportingProject>;
  save(project: LocalReportingProject): Promise<LocalReportingProject>;
  rename(id: string, name: string): Promise<LocalReportingProject>;
  duplicate(id: string): Promise<LocalReportingProject>;
  delete(id: string): Promise<void>;
  deleteAll(): Promise<void>;
  exportAll(): Promise<string>;
  importAll(serialized: string): Promise<number>;
}

const clone = <Value>(value: Value): Value => structuredClone(value);

export const selectProjectAfterImport = (
  projects: LocalReportingProject[],
  existingIds: ReadonlySet<string>,
) => projects.find((project) => !existingIds.has(project.id)) ?? projects[0] ?? null;

const randomId = () => {
  if (globalThis.crypto?.randomUUID) return globalThis.crypto.randomUUID();
  return `project-${Date.now()}-${Math.random().toString(36).slice(2, 10)}`;
};

export function createBrowserProjectRepository(
  storage: ProjectStorageAdapter,
  now: () => string = () => new Date().toISOString(),
): LocalProjectRepository {
  const read = (): LocalReportingProject[] => {
    const stored = storage.getItem(STORAGE_KEY);
    if (!stored) return [];
    let normalizedProjects: LocalReportingProject[];
    let needsWrite = false;
    try {
      const value: unknown = JSON.parse(stored);
      if (!Array.isArray(value)) throw new Error('项目列表格式错误。');
      const first = value[0];
      const storedVersion = first && typeof first === 'object' && 'dataVersion' in first
        ? Number(first.dataVersion)
        : 1;
      const validated = parseLocalProjectImport(JSON.stringify({
        format: 'newspilot-local-projects',
        dataVersion: storedVersion,
      // 读取本地项目不应消耗仓库的业务时钟。复用已持久化的合法时间戳，
      // 既避免只读操作产生副作用，也让注入的测试时钟保持可预测。
      exportedAt: first && typeof first === 'object' && 'updatedAt' in first
        && typeof first.updatedAt === 'string'
        ? first.updatedAt
        : new Date(0).toISOString(),
        projects: value,
      }));
      let sourceTypesUpdated = false;
      normalizedProjects = validated.projects.map((project) => ({
        ...project,
        executionWorkspace: {
          ...project.executionWorkspace,
          sources: project.executionWorkspace.sources.map((source) => {
            if (source.sourceType !== 'other') return source;
            const inferred = inferInterviewSourceType(source.role);
            if (inferred === 'other') return source;
            sourceTypesUpdated = true;
            return { ...source, sourceType: inferred };
          }),
        },
      }));
      needsWrite = storedVersion !== validated.dataVersion || sourceTypesUpdated;
    } catch {
      // Never treat unreadable data as an empty repository: callers would overwrite it.
      throw new Error('本地项目数据无法读取，原始数据已保留。请先备份并检查数据格式。');
    }
    // Storage failures must not be interpreted as corrupt project data.
    if (needsWrite) write(normalizedProjects);
    return normalizedProjects;
  };

  const write = (projects: LocalReportingProject[]) => {
    // Validate the whole next snapshot before the only persistent write.
    parseLocalProjectImport(serializeLocalProjects(projects, new Date(0).toISOString()));
    storage.setItem(STORAGE_KEY, JSON.stringify(projects));
  };

  const required = (projects: LocalReportingProject[], id: string) => {
    const project = projects.find((item) => item.id === id);
    if (!project) throw new Error('没有找到该本地报道项目。');
    return project;
  };

  return {
    async list() {
      return clone(
        read().sort((left, right) => right.updatedAt.localeCompare(left.updatedAt)),
      );
    },
    async create(name, brief) {
      const projects = read();
      const project = createLocalReportingProject({
        id: randomId(),
        name,
        brief,
        now: now(),
      });
      write([...projects, project]);
      return clone(project);
    },
    async save(project) {
      const projects = read();
      required(projects, project.id);
      const updated = clone({ ...project, updatedAt: now() });
      write(projects.map((item) => (item.id === updated.id ? updated : item)));
      return clone(updated);
    },
    async rename(id, name) {
      if (!name.trim()) throw new Error('项目名称不能为空。');
      const projects = read();
      const project = required(projects, id);
      const updated = { ...project, name: name.trim(), updatedAt: now() };
      write(projects.map((item) => (item.id === id ? updated : item)));
      return clone(updated);
    },
    async duplicate(id) {
      const projects = read();
      const project = required(projects, id);
      const timestamp = now();
      const duplicated = {
        ...clone(project),
        id: randomId(),
        name: `${project.name}（副本）`,
        createdAt: timestamp,
        updatedAt: timestamp,
      };
      write([...projects, duplicated]);
      return clone(duplicated);
    },
    async delete(id) {
      const projects = read();
      required(projects, id);
      write(projects.filter((item) => item.id !== id));
    },
    async deleteAll() {
      storage.removeItem(STORAGE_KEY);
    },
    async exportAll() {
      return serializeLocalProjects(read(), now());
    },
    async importAll(serialized) {
      const imported = parseLocalProjectImport(serialized);
      const projects = read();
      const byId = new Map(projects.map((project) => [project.id, project]));
      for (const project of imported.projects) byId.set(project.id, clone(project));
      write([...byId.values()]);
      return imported.projects.length;
    },
  };
}

export const localProjectRepository = createBrowserProjectRepository(
  globalThis.localStorage,
);
