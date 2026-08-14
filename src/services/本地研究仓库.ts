import {
  createProductEvent,
  createResearchParticipant,
  parseResearchDataBundle,
  serializeResearchDataBundle,
  type ProductEvent,
  type ProductEventName,
  type ProductIssue,
  type ResearchDataBundle,
  type ResearchParticipant,
  type ResearchSession,
  type UsabilityObservation,
} from '../../shared/产品验证';

const STORAGE_KEY = 'newspilot.research.bundle.v1';
const ACTIVE_SESSION_KEY = 'newspilot.research.active-session.v1';

export interface ResearchStorageAdapter {
  getItem(key: string): string | null;
  setItem(key: string, value: string): void;
  removeItem(key: string): void;
}

export interface LocalResearchRepository {
  load(): Promise<ResearchDataBundle>;
  saveParticipant(participant: ResearchParticipant): Promise<ResearchParticipant>;
  startSession(
    participantId: string,
    taskId: string,
    condition: ResearchSession['condition'],
  ): Promise<ResearchSession>;
  finishSession(
    sessionId: string,
    result: Partial<Omit<ResearchSession, 'id' | 'participantId' | 'taskId' | 'condition' | 'synthetic' | 'createdAt'>>,
  ): Promise<ResearchSession>;
  getActiveSession(): Promise<ResearchSession | null>;
  recordEvent(
    eventName: ProductEventName,
    page: string,
    metadata?: Record<string, unknown>,
  ): Promise<ProductEvent | null>;
  addObservation(
    observation: Omit<UsabilityObservation, 'id' | 'createdAt'>,
  ): Promise<UsabilityObservation>;
  saveIssue(issue: ProductIssue): Promise<ProductIssue>;
  importAnonymous(serialized: string): Promise<ResearchDataBundle>;
  exportAnonymous(): Promise<string>;
  clear(): Promise<void>;
}

const emptyBundle = (now: string): ResearchDataBundle => ({
  format: 'newspilot-research-bundle',
  schemaVersion: 2,
  exportedAt: now,
  participants: [],
  sessions: [],
  observations: [],
  events: [],
  issues: [],
});

const byId = <Value extends { id: string }>(values: Value[]) =>
  new Map(values.map((value) => [value.id, value]));

export function createBrowserResearchRepository(
  storage: ResearchStorageAdapter,
  now: () => string = () => new Date().toISOString(),
  createId: () => string = () => globalThis.crypto?.randomUUID?.() ??
    `research-${Date.now()}-${Math.random().toString(36).slice(2, 10)}`,
): LocalResearchRepository {
  const read = () => {
    const serialized = storage.getItem(STORAGE_KEY);
    if (!serialized) return emptyBundle(now());
    try {
      const normalized = parseResearchDataBundle(serialized);
      const normalizedSerialized = serializeResearchDataBundle(normalized);
      if (normalizedSerialized !== serialized) {
        storage.setItem(STORAGE_KEY, normalizedSerialized);
      }
      return normalized;
    } catch (error) {
      console.warn('[NewsPilot] 本地研究数据无效，已隔离。', error);
      storage.removeItem(STORAGE_KEY);
      storage.removeItem(ACTIVE_SESSION_KEY);
      return emptyBundle(now());
    }
  };

  const write = (bundle: ResearchDataBundle) => {
    const next = { ...bundle, exportedAt: now() };
    storage.setItem(STORAGE_KEY, serializeResearchDataBundle(next));
    return next;
  };

  const requireSession = (bundle: ResearchDataBundle, sessionId: string) => {
    const session = bundle.sessions.find((item) => item.id === sessionId);
    if (!session) throw new Error('没有找到对应的研究场次。');
    return session;
  };

  return {
    async load() {
      return structuredClone(read());
    },
    async saveParticipant(participant) {
      const normalized = createResearchParticipant(participant);
      const bundle = read();
      const participants = byId(bundle.participants);
      participants.set(normalized.id, normalized);
      write({ ...bundle, participants: [...participants.values()] });
      return structuredClone(normalized);
    },
    async startSession(participantId, taskId, condition) {
      const bundle = read();
      const participant = bundle.participants.find((item) => item.id === participantId);
      if (!participant || !participant.consentConfirmed) {
        throw new Error('必须先创建已确认同意的匿名参与者。');
      }
      if (!taskId.trim()) throw new Error('研究任务编号不能为空。');
      const timestamp = now();
      const session: ResearchSession = {
        id: createId(),
        participantId: participant.id,
        taskId: taskId.trim(),
        condition,
        startedAt: timestamp,
        taskCompleted: false,
        majorAssistanceRequired: false,
        observedProblems: [],
        comments: [],
        synthetic: participant.synthetic,
        createdAt: timestamp,
      };
      write({ ...bundle, sessions: [...bundle.sessions, session] });
      storage.setItem(ACTIVE_SESSION_KEY, session.id);
      return structuredClone(session);
    },
    async finishSession(sessionId, result) {
      const bundle = read();
      const session = requireSession(bundle, sessionId);
      const updated: ResearchSession = {
        ...session,
        ...structuredClone(result),
        completedAt: result.completedAt ?? now(),
      };
      write({
        ...bundle,
        sessions: bundle.sessions.map((item) => item.id === sessionId ? updated : item),
      });
      if (storage.getItem(ACTIVE_SESSION_KEY) === sessionId) {
        storage.removeItem(ACTIVE_SESSION_KEY);
      }
      return structuredClone(updated);
    },
    async getActiveSession() {
      const sessionId = storage.getItem(ACTIVE_SESSION_KEY);
      if (!sessionId) return null;
      const session = read().sessions.find((item) => item.id === sessionId) ?? null;
      if (!session) storage.removeItem(ACTIVE_SESSION_KEY);
      return structuredClone(session);
    },
    async recordEvent(eventName, page, metadata) {
      const bundle = read();
      const sessionId = storage.getItem(ACTIVE_SESSION_KEY);
      if (!sessionId) return null;
      const session = requireSession(bundle, sessionId);
      const event = createProductEvent({
        id: createId(),
        sessionId,
        eventName,
        page,
        timestamp: now(),
        metadata,
        synthetic: session.synthetic,
      });
      write({ ...bundle, events: [...bundle.events, event] });
      return structuredClone(event);
    },
    async addObservation(observation) {
      const bundle = read();
      requireSession(bundle, observation.sessionId);
      if (!observation.description.trim()) throw new Error('观察说明不能为空。');
      const item: UsabilityObservation = {
        ...structuredClone(observation),
        id: createId(),
        description: observation.description.trim(),
        createdAt: now(),
      };
      write({ ...bundle, observations: [...bundle.observations, item] });
      return structuredClone(item);
    },
    async saveIssue(issue) {
      const bundle = read();
      const issues = byId(bundle.issues);
      issues.set(issue.id, structuredClone(issue));
      write({ ...bundle, issues: [...issues.values()] });
      return structuredClone(issue);
    },
    async importAnonymous(serialized) {
      const incoming = parseResearchDataBundle(serialized);
      const current = read();
      const participants = byId(current.participants);
      const sessions = byId(current.sessions);
      const observations = byId(current.observations);
      const events = byId(current.events);
      const issues = byId(current.issues);
      incoming.participants.forEach((item) => participants.set(item.id, item));
      incoming.sessions.forEach((item) => sessions.set(item.id, item));
      incoming.observations.forEach((item) => observations.set(item.id, item));
      incoming.events.forEach((item) => events.set(item.id, item));
      incoming.issues.forEach((item) => issues.set(item.id, item));
      return structuredClone(write({
        ...current,
        participants: [...participants.values()],
        sessions: [...sessions.values()],
        observations: [...observations.values()],
        events: [...events.values()],
        issues: [...issues.values()],
      }));
    },
    async exportAnonymous() {
      return serializeResearchDataBundle(read());
    },
    async clear() {
      storage.removeItem(STORAGE_KEY);
      storage.removeItem(ACTIVE_SESSION_KEY);
    },
  };
}

const fallbackStorage: ResearchStorageAdapter = {
  getItem: () => null,
  setItem: () => undefined,
  removeItem: () => undefined,
};

export const localResearchRepository = createBrowserResearchRepository(
  typeof globalThis.localStorage === 'undefined' ? fallbackStorage : globalThis.localStorage,
);

export const recordLocalProductEvent = (
  eventName: ProductEventName,
  page: string,
  metadata?: Record<string, unknown>,
) => localResearchRepository.recordEvent(eventName, page, metadata);
