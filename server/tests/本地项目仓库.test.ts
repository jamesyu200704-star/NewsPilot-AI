import assert from 'node:assert/strict';
import test from 'node:test';
import type { LocalReportingProject } from '../../shared/本地项目模型.js';
import type { ReportingBrief } from '../../shared/学生报道模型.js';
import { createStudentReportingPlan } from '../../shared/学生报道工作流.js';
import { createExecutionWorkspaceFromPlan } from '../../shared/报道执行工作区.js';
import {
  createBrowserProjectRepository,
  selectProjectAfterImport,
  type ProjectStorageAdapter,
} from '../../src/services/本地项目仓库.js';

const brief: ReportingBrief = {
  mode: 'course',
  rawTopic: '校园食堂价格变化',
  assignmentType: '校园调查',
  availableInterviewees: ['学生', '食堂负责人'],
  existingMaterials: [],
  reportingResources: ['手机录音'],
  ethicalConstraints: ['匿名处理消费记录'],
};

class MemoryStorage implements ProjectStorageAdapter {
  private value: string | null = null;

  getItem() {
    return this.value;
  }

  setItem(_key: string, value: string) {
    this.value = value;
  }

  removeItem() {
    this.value = null;
  }
}

test('本地项目仓库支持新建、自动保存、重命名、复制、删除和最近修改排序', async () => {
  const storage = new MemoryStorage();
  let tick = 0;
  const repository = createBrowserProjectRepository(storage, () =>
    `2026-08-12T10:0${tick++}:00.000Z`,
  );

  const first = await repository.create('食堂价格调查', brief);
  const second = await repository.create('校园服务观察', {
    ...brief,
    rawTopic: '校园摆渡车',
  });
  const renamed = await repository.rename(first.id, '食堂价格变化调查');
  const saved = await repository.save({
    ...renamed,
    brief: { ...renamed.brief, targetLength: 2200 },
  });
  const copied = await repository.duplicate(saved.id);
  const projects = await repository.list();

  assert.equal(projects.length, 3);
  assert.equal(projects[0].id, copied.id);
  assert.match(copied.name, /副本/u);
  assert.equal(copied.brief.targetLength, 2200);
  assert.notEqual(copied.id, saved.id);
  assert.notEqual(second.id, first.id);

  await repository.delete(second.id);
  assert.equal((await repository.list()).length, 2);
  await repository.deleteAll();
  assert.deepEqual(await repository.list(), []);
});

test('本地项目仓库导入时校验损坏文件并合并同名编号项目', async () => {
  const sourceStorage = new MemoryStorage();
  const source = createBrowserProjectRepository(
    sourceStorage,
    () => '2026-08-12T10:00:00.000Z',
  );
  await source.create('原项目', brief);
  const exported = await source.exportAll();

  const targetStorage = new MemoryStorage();
  const target = createBrowserProjectRepository(
    targetStorage,
    () => '2026-08-12T12:00:00.000Z',
  );
  const imported = await target.importAll(exported);

  assert.equal(imported, 1);
  assert.equal((await target.list())[0].name, '原项目');
  await assert.rejects(() => target.importAll('{broken'), /损坏/u);
});

test('导入完成后优先打开本次新增项目，而不是更新时间更近的旧项目', () => {
  const existingIds = new Set(['existing']);
  const projects = [
    { id: 'existing', updatedAt: '2026-08-13T12:00:00.000Z' },
    { id: 'imported', updatedAt: '2026-08-12T12:00:00.000Z' },
  ] as LocalReportingProject[];

  assert.equal(selectProjectAfterImport(projects, existingIds)?.id, 'imported');
  assert.equal(selectProjectAfterImport(projects, new Set(projects.map(({ id }) => id)))?.id, 'existing');
});

test('读取旧项目时修复通用角色被存成 other 的信源类型', async () => {
  const storage = new MemoryStorage();
  const repository = createBrowserProjectRepository(storage, () => '2026-08-13T10:00:00.000Z');
  const project = await repository.create('旧项目', brief);
  const plan = createStudentReportingPlan(brief);
  const workspace = createExecutionWorkspaceFromPlan(plan, '2026-08-13T09:00:00.000Z');
  await repository.save({
    ...project,
    plan,
    executionWorkspace: {
      ...workspace,
      sources: workspace.sources.map((source) => ({ ...source, sourceType: 'other' })),
    },
  });

  const [restored] = await repository.list();
  const types = new Map(restored!.executionWorkspace.sources.map((source) => [source.role, source.sourceType]));
  assert.equal(types.get('直接经历者'), 'affected_group');
  assert.equal(types.get('决策者或规则执行者'), 'school_administrator');
});
