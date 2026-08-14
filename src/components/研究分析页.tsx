import { useEffect, useMemo, useState } from 'react';
import {
  NO_REAL_USER_DATA_NOTICE,
  calculateResearchMetrics,
  createReleaseGateCatalog,
  filterResearchData,
  type ResearchDataBundle,
  type ResearchDataFilter,
  type ResearchParticipant,
  type ResearchSession,
  type UsabilityObservation,
} from '../../shared/产品验证';
import {
  localResearchRepository,
  type LocalResearchRepository,
} from '../services/本地研究仓库';

interface ResearchAnalysisPanelProps {
  repository?: LocalResearchRepository;
}

const downloadText = (filename: string, content: string) => {
  const url = URL.createObjectURL(new Blob([content], { type: 'application/json;charset=utf-8' }));
  const anchor = document.createElement('a');
  anchor.href = url;
  anchor.download = filename;
  anchor.click();
  URL.revokeObjectURL(url);
};

const percent = (value: number | null) => value === null ? '样本不足' : `${Math.round(value * 100)}%`;
const duration = (seconds: number | null) => seconds === null ? '样本不足' : `${Math.round(seconds / 60)} 分钟`;

const initialParticipant = (): ResearchParticipant => ({
  id: 'P001',
  academicYear: 'freshman',
  journalismExperience: 'none',
  campusMediaExperience: false,
  priorAiToolExperience: false,
  primaryDevice: 'laptop',
  consentConfirmed: false,
  synthetic: true,
  createdAt: new Date().toISOString(),
});

const emptyBundle = (): ResearchDataBundle => ({
  format: 'newspilot-research-bundle',
  schemaVersion: 2,
  exportedAt: new Date().toISOString(),
  participants: [],
  sessions: [],
  observations: [],
  events: [],
  issues: [],
});

export function ResearchAnalysisPanel({
  repository = localResearchRepository,
}: ResearchAnalysisPanelProps) {
  const [bundle, setBundle] = useState<ResearchDataBundle>(emptyBundle);
  const [filter, setFilter] = useState<ResearchDataFilter>('real');
  const [participant, setParticipant] = useState<ResearchParticipant>(initialParticipant);
  const [taskId, setTaskId] = useState('campus-investigation');
  const [condition, setCondition] = useState<ResearchSession['condition']>('newspilot');
  const [activeSession, setActiveSession] = useState<ResearchSession | null>(null);
  const [observation, setObservation] = useState({
    eventType: 'confusion' as UsabilityObservation['eventType'],
    severity: 'major' as UsabilityObservation['severity'],
    page: 'planning',
    description: '',
  });
  const [message, setMessage] = useState('');

  const refresh = async () => {
    const [nextBundle, nextSession] = await Promise.all([
      repository.load(),
      repository.getActiveSession(),
    ]);
    setBundle(nextBundle);
    setActiveSession(nextSession);
  };

  useEffect(() => {
    void refresh();
  }, []);

  const filtered = useMemo(() => filterResearchData(bundle, filter), [bundle, filter]);
  const metrics = useMemo(() => calculateResearchMetrics(filtered.sessions), [filtered.sessions]);
  const issueCounts = useMemo(() => {
    const values = new Map<string, number>();
    for (const session of filtered.sessions) {
      for (const problem of session.observedProblems) {
        const normalized = problem.trim();
        if (normalized) values.set(normalized, (values.get(normalized) ?? 0) + 1);
      }
    }
    return [...values.entries()].sort((left, right) => right[1] - left[1]);
  }, [filtered.sessions]);
  const helpEvents = filtered.events.filter((event) => event.eventName === 'help_requested');
  const abandoned = filtered.sessions.filter((session) => Boolean(session.abandonedStep));
  const releaseBlockers = filtered.issues.filter((issue) => issue.releaseBlocker && issue.status !== 'resolved');
  const releaseGates = createReleaseGateCatalog();

  const startSession = async () => {
    try {
      const nextParticipant = { ...participant, createdAt: new Date().toISOString() };
      await repository.saveParticipant(nextParticipant);
      const session = await repository.startSession(nextParticipant.id, taskId, condition);
      setActiveSession(session);
      setMessage(`已开始本地研究场次 ${session.id}。不会发送到外部服务器。`);
      await refresh();
    } catch (error) {
      setMessage(error instanceof Error ? error.message : '无法开始研究场次。');
    }
  };

  const finishSession = async () => {
    if (!activeSession) return;
    await repository.finishSession(activeSession.id, {
      taskCompleted: true,
      userKnewNextStep: true,
      completedAt: new Date().toISOString(),
    });
    setMessage('场次已结束。完成状态只记录本次研究员的人工确认。');
    await refresh();
  };

  const addObservation = async () => {
    if (!activeSession) {
      setMessage('请先开始一个研究场次。');
      return;
    }
    try {
      await repository.addObservation({ ...observation, sessionId: activeSession.id });
      setObservation((current) => ({ ...current, description: '' }));
      setMessage('观察已匿名保存在当前浏览器。');
      await refresh();
    } catch (error) {
      setMessage(error instanceof Error ? error.message : '观察保存失败。');
    }
  };

  const importBundle = async (file: File) => {
    try {
      await repository.importAnonymous(await file.text());
      setMessage('匿名研究包已校验并导入；真实与模拟标记保持分离。');
      await refresh();
    } catch (error) {
      setMessage(error instanceof Error ? error.message : '研究包导入失败。');
    }
  };

  return (
    <section className="research-analysis" aria-labelledby="research-analysis-title">
      <header>
        <div>
          <span className="eyebrow">LOCAL RESEARCH MODE</span>
          <h2 id="research-analysis-title">用户研究与发布分析</h2>
          <p>本地优先、明确同意、最小采集、匿名导出。这里不会调用任何外部统计服务。</p>
        </div>
        <span className="research-analysis__local">仅当前浏览器</span>
      </header>

      <div className="research-filter" role="radiogroup" aria-label="研究数据范围">
        {([
          ['real', '真实数据'],
          ['synthetic', '模拟数据'],
          ['all', '全部'],
        ] as const).map(([value, label]) => (
          <label key={value}>
            <input type="radio" name="research-filter" checked={filter === value} onChange={() => setFilter(value)} />
            <span>{label}</span>
          </label>
        ))}
      </div>

      {filter === 'real' && filtered.sessions.length === 0 ? (
        <div className="research-empty" role="status">
          <strong>{NO_REAL_USER_DATA_NOTICE.split('\n')[0]}</strong>
          <p>{NO_REAL_USER_DATA_NOTICE.split('\n')[1]}</p>
          <small>请按 research/ 中的知情同意、主持脚本和导入指南开展真实测试。</small>
        </div>
      ) : (
        <>
          <div className="research-metrics" aria-label="核心产品指标">
            <article><span>样本量</span><b>{metrics.sampleSize}</b></article>
            <article><span>首个可执行方案</span><b>{duration(metrics.medianTimeToFirstUsablePlanSeconds)}</b><small>目标 ≤ 10 分钟</small></article>
            <article><span>任务完成率</span><b>{percent(metrics.taskCompletionRate)}</b><small>目标 ≥ 80%</small></article>
            <article><span>下一步清晰度</span><b>{percent(metrics.nextStepClarityRate)}</b><small>目标 ≥ 70%</small></article>
            <article><span>采访对象采用率</span><b>{percent(metrics.intervieweeAdoptionRate)}</b><small>目标 ≥ 60%</small></article>
            <article><span>采访问题采用率</span><b>{percent(metrics.questionAdoptionRate)}</b><small>目标 ≥ 50%</small></article>
            <article><span>重大重写率</span><b>{percent(metrics.majorRewriteRate)}</b><small>目标 ≤ 30%</small></article>
          </div>

          <div className="research-analysis__grid">
            <article>
              <h3>测试场次</h3>
              {filtered.sessions.length ? filtered.sessions.map((session) => (
                <p key={session.id}><b>{session.participantId}</b> · {session.taskId} · {session.condition} · {session.taskCompleted ? '已完成' : '未完成'}</p>
              )) : <p>当前筛选范围没有场次。</p>}
            </article>
            <article>
              <h3>放弃与求助位置</h3>
              <p>放弃：{abandoned.length} 次；求助：{helpEvents.length} 次。</p>
              {[...new Set(abandoned.map((item) => item.abandonedStep))].filter(Boolean).map((step) => <p key={step}>放弃步骤：{step}</p>)}
              {[...new Set(helpEvents.map((item) => item.page))].map((page) => <p key={page}>求助页面：{page}</p>)}
            </article>
            <article>
              <h3>高频问题</h3>
              {issueCounts.length ? issueCounts.map(([problem, count]) => <p key={problem}>{problem} · {count} 次</p>) : <p>尚无可汇总的问题记录。</p>}
            </article>
            <article>
              <h3>发布阻断</h3>
              <p>未解决 Release Blocker：{releaseBlockers.length}</p>
              <p>发布门槛：{releaseGates.length} 项；状态需由实际自动、人工与研究证据更新，当前页面不会自动判定通过。</p>
            </article>
          </div>
        </>
      )}

      <details className="research-recorder">
        <summary>开始或记录匿名研究场次</summary>
        <div className="research-recorder__form">
          <label>匿名编号<input value={participant.id} pattern="P[0-9]{3,}" onChange={(event) => setParticipant((current) => ({ ...current, id: event.target.value }))} /></label>
          <label>年级<select value={participant.academicYear} onChange={(event) => setParticipant((current) => ({ ...current, academicYear: event.target.value as ResearchParticipant['academicYear'] }))}><option value="freshman">大一</option><option value="sophomore">大二</option><option value="junior">大三</option><option value="senior">大四</option><option value="graduate">研究生</option><option value="other">其他</option></select></label>
          <label>采访经验<select value={participant.journalismExperience} onChange={(event) => setParticipant((current) => ({ ...current, journalismExperience: event.target.value as ResearchParticipant['journalismExperience'] }))}><option value="none">无</option><option value="beginner">初级</option><option value="intermediate">中等</option><option value="experienced">丰富</option></select></label>
          <label>常用设备<select value={participant.primaryDevice} onChange={(event) => setParticipant((current) => ({ ...current, primaryDevice: event.target.value as ResearchParticipant['primaryDevice'] }))}><option value="desktop">台式机</option><option value="laptop">笔记本</option><option value="tablet">平板</option><option value="mobile">手机</option></select></label>
          <label>任务编号<input value={taskId} onChange={(event) => setTaskId(event.target.value)} /></label>
          <label>测试条件<select value={condition} onChange={(event) => setCondition(event.target.value as ResearchSession['condition'])}><option value="newspilot">NewsPilot</option><option value="generic_llm">通用模型</option><option value="self_planning">学生独立策划</option></select></label>
          <label className="research-checkbox"><input type="checkbox" checked={participant.campusMediaExperience} onChange={(event) => setParticipant((current) => ({ ...current, campusMediaExperience: event.target.checked }))} />有校园媒体经历</label>
          <label className="research-checkbox"><input type="checkbox" checked={participant.priorAiToolExperience} onChange={(event) => setParticipant((current) => ({ ...current, priorAiToolExperience: event.target.checked }))} />使用过 AI 工具</label>
          <label className="research-checkbox"><input type="checkbox" checked={participant.synthetic} onChange={(event) => setParticipant((current) => ({ ...current, synthetic: event.target.checked }))} />这是模拟演示数据</label>
          <label className="research-checkbox"><input type="checkbox" checked={participant.consentConfirmed} onChange={(event) => setParticipant((current) => ({ ...current, consentConfirmed: event.target.checked }))} />已确认研究与隐私同意</label>
          <div className="research-recorder__actions">
            <button type="button" disabled={Boolean(activeSession)} onClick={() => void startSession()}>开始本地场次</button>
            <button type="button" disabled={!activeSession} onClick={() => void finishSession()}>结束场次</button>
          </div>
        </div>

        <div className="research-observation">
          <h3>观察记录</h3>
          <label>事件<select value={observation.eventType} onChange={(event) => setObservation((current) => ({ ...current, eventType: event.target.value as UsabilityObservation['eventType'] }))}><option value="hesitation">犹豫</option><option value="misclick">误点</option><option value="confusion">困惑</option><option value="backtrack">返回</option><option value="error">错误</option><option value="request_help">求助</option><option value="abandonment">放弃</option><option value="positive_reaction">正向反应</option><option value="other">其他</option></select></label>
          <label>严重程度<select value={observation.severity} onChange={(event) => setObservation((current) => ({ ...current, severity: event.target.value as UsabilityObservation['severity'] }))}><option value="blocking">阻塞</option><option value="major">重大</option><option value="minor">轻微</option><option value="cosmetic">视觉</option></select></label>
          <label>页面<input value={observation.page} onChange={(event) => setObservation((current) => ({ ...current, page: event.target.value }))} /></label>
          <label>行为描述<textarea value={observation.description} onChange={(event) => setObservation((current) => ({ ...current, description: event.target.value }))} /></label>
          <button type="button" disabled={!activeSession || !observation.description.trim()} onClick={() => void addObservation()}>保存本地观察</button>
        </div>
      </details>

      <div className="research-data-actions">
        <button type="button" onClick={() => void repository.exportAnonymous().then((content) => downloadText(`NewsPilot-匿名研究包-${new Date().toISOString().slice(0, 10)}.json`, content))}>导出匿名研究包</button>
        <label>导入匿名研究包<input type="file" accept="application/json,.json" onChange={(event) => { const file = event.target.files?.[0]; if (file) void importBundle(file); event.target.value = ''; }} /></label>
      </div>
      {message ? <p className="research-analysis__message" role="status">{message}</p> : null}
    </section>
  );
}
