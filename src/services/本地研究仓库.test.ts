// @vitest-environment jsdom
import { describe, expect, it } from 'vitest';
import { createBrowserResearchRepository } from './本地研究仓库';
import { isResearchModeEnabled } from './研究模式';

class MemoryStorage implements Storage {
  private readonly values = new Map<string, string>();
  get length() { return this.values.size; }
  clear() { this.values.clear(); }
  getItem(key: string) { return this.values.get(key) ?? null; }
  key(index: number) { return [...this.values.keys()][index] ?? null; }
  removeItem(key: string) { this.values.delete(key); }
  setItem(key: string, value: string) { this.values.set(key, value); }
}

describe('本地研究仓库', () => {
  it('研究模式只在显式 true 时启用，公开构建默认关闭', () => {
    expect(isResearchModeEnabled(undefined)).toBe(false);
    expect(isResearchModeEnabled('false')).toBe(false);
    expect(isResearchModeEnabled('true')).toBe(true);
  });

  it('只在本地保存匿名场次，事件写入前自动脱敏并可匿名导出', async () => {
    const storage = new MemoryStorage();
    let id = 0;
    const repository = createBrowserResearchRepository(
      storage,
      () => '2026-08-13T10:00:00.000Z',
      () => `id-${++id}`,
    );

    await repository.saveParticipant({
      id: 'P001', academicYear: 'freshman', journalismExperience: 'none',
      campusMediaExperience: false, priorAiToolExperience: true, primaryDevice: 'mobile',
      consentConfirmed: true, synthetic: false, createdAt: '2026-08-13T10:00:00.000Z',
    });
    const session = await repository.startSession('P001', 'profile-feature', 'newspilot');
    await repository.recordEvent('question_edited', 'interview-guide', {
      count: 1,
      transcript: '不得保存的逐字稿',
      email: 'person@example.com',
    });
    await repository.addObservation({
      sessionId: session.id,
      eventType: 'confusion',
      page: 'interview-guide',
      description: '没有找到问题编辑入口',
      severity: 'major',
    });

    const bundle = await repository.load();
    expect(bundle.participants).toHaveLength(1);
    expect(bundle.sessions).toHaveLength(1);
    expect(bundle.events[0].metadata).toEqual({ count: 1 });
    expect(bundle.events[0].eventName).toBe('question_edited');
    expect(bundle.events[0]).not.toHaveProperty('name');
    expect(JSON.stringify(bundle.events)).not.toContain('逐字稿');
    expect(JSON.stringify(bundle.events)).not.toContain('person@example.com');
    expect((await repository.exportAnonymous())).toContain('newspilot-research-bundle');
  });

  it('没有已同意的匿名参与者时拒绝开始记录', async () => {
    const repository = createBrowserResearchRepository(new MemoryStorage());
    await expect(repository.startSession('P404', 'task', 'newspilot')).rejects.toThrow(/同意|参与者/u);
  });

  it('读取旧事件后无损迁移并只持久化 eventName', async () => {
    const storage = new MemoryStorage();
    storage.setItem('newspilot.research.bundle.v1', JSON.stringify({
      format: 'newspilot-research-bundle',
      dataVersion: 1,
      exportedAt: '2026-08-13T10:00:00.000Z',
      participants: [], sessions: [], observations: [], issues: [],
      events: [{
        id: 'event-legacy-001', sessionId: 'session-legacy-001',
        name: 'project_created', page: 'project-bar',
        timestamp: '2026-08-13T09:00:00.000Z', synthetic: true,
      }],
    }));

    const repository = createBrowserResearchRepository(storage);
    const bundle = await repository.load();
    expect(bundle.schemaVersion).toBe(2);
    expect(bundle.events[0].eventName).toBe('project_created');
    expect(bundle.events[0]).not.toHaveProperty('name');

    const persisted = storage.getItem('newspilot.research.bundle.v1');
    expect(persisted).not.toBeNull();
    expect(JSON.parse(persisted ?? '{}')).toMatchObject({
      schemaVersion: 2,
      events: [{ eventName: 'project_created' }],
    });
    expect(persisted).not.toContain('"name"');
  });
});
