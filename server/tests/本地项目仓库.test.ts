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

test('异常来源导入和保存被拒绝，已有项目逐字保留', async () => {
  const storage = new MemoryStorage();
  const repository = createBrowserProjectRepository(storage, () => '2026-09-08T00:00:00.000Z');
  await repository.create('合成项目甲', brief);
  const project = await repository.create('合成项目乙', brief);
  const before = storage.getItem();
  const backup = JSON.parse(await repository.exportAll());
  for (const invalid of [null, 1, 'source', {}, { sourceType: 'other', role: null }]) {
    const incoming = structuredClone(backup);
    incoming.projects[0].executionWorkspace.sources = [invalid];
    await assert.rejects(() => repository.importAll(JSON.stringify(incoming)), /字段校验|来源/u);
    assert.equal(storage.getItem(), before);
    const modified = structuredClone(project);
    modified.executionWorkspace.sources = [invalid] as unknown as typeof modified.executionWorkspace.sources;
    await assert.rejects(() => repository.save(modified), /字段校验|来源/u);
    assert.equal(storage.getItem(), before);
    assert.equal((await repository.list()).length, 2);
  }
});

test('读取损坏存储不删除也不允许后续操作覆盖原始数据', async () => {
  const storage = new MemoryStorage();
  const repository = createBrowserProjectRepository(storage, () => '2026-09-08T00:00:00.000Z');
  const project = await repository.create('合成项目', brief);
  const exported = await repository.exportAll();
  const malformed = JSON.parse(storage.getItem()!);
  malformed[0].executionWorkspace.sources = [null];
  for (const raw of ['{broken', JSON.stringify(malformed)]) {
    storage.setItem('newspilot.local-projects.v1', raw);
    for (const operation of [
      () => repository.list(),
      () => repository.create('新合成项目', brief),
      () => repository.importAll(exported),
      () => repository.save(project),
      () => repository.rename(project.id, '新名称'),
      () => repository.duplicate(project.id),
      () => repository.delete(project.id),
    ]) {
      await assert.rejects(operation, /保留/u);
      assert.equal(storage.getItem(), raw);
    }
  }
});

test('有效导入仍合并编号、保留其他项目且能读取版本迁移备份', async () => {
  const storage = new MemoryStorage();
  const repository = createBrowserProjectRepository(storage, () => '2026-09-08T00:00:00.000Z');
  const first = await repository.create('合成项目甲', brief);
  const second = await repository.create('合成项目乙', brief);
  const incoming = JSON.parse(await repository.exportAll());
  incoming.projects = [incoming.projects[0]];
  incoming.projects[0].name = '合成更新名称';
  assert.equal(await repository.importAll(JSON.stringify(incoming)), 1);
  const projects = await repository.list();
  assert.equal(projects.length, 2);
  assert.equal(projects.find(item => item.id === first.id)?.name, '合成更新名称');
  assert.equal(projects.find(item => item.id === second.id)?.name, second.name);
  for (const version of [1, 2]) {
    const legacy = structuredClone(incoming);
    legacy.dataVersion = version;
    legacy.projects[0].dataVersion = version;
    delete legacy.projects[0].executionWorkspace;
    await repository.importAll(JSON.stringify(legacy));
    assert.equal((await repository.list()).length, 2);
  }
});

test('保存或迁移写入失败时保留旧快照，不删除项目', async () => {
  const storage = new MemoryStorage();
  let refuseWrites = false;
  let removed = false;
  const adapter: ProjectStorageAdapter = {
    getItem: () => storage.getItem(),
    setItem: (key, value) => {
      if (refuseWrites) throw new Error('合成存储配额错误');
      storage.setItem(key, value);
    },
    removeItem: () => { removed = true; storage.removeItem(); },
  };
  const repository = createBrowserProjectRepository(adapter, () => '2026-09-08T00:00:00.000Z');
  const project = await repository.create('合成项目', brief);
  const before = storage.getItem();
  refuseWrites = true;
  await assert.rejects(() => repository.save({ ...project, name: '更新' }), /配额/u);
  assert.equal(storage.getItem(), before);
  const legacy = JSON.parse(before!);
  legacy[0].dataVersion = 1;
  delete legacy[0].executionWorkspace;
  const raw = JSON.stringify(legacy);
  storage.setItem('newspilot.local-projects.v1', raw);
  await assert.rejects(() => repository.list(), /配额/u);
  assert.equal(storage.getItem(), raw);
  assert.equal(removed, false);
});
