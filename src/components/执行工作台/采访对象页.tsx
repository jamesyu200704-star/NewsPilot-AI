import { useMemo, useState } from 'react';
import { CalendarBlank, EnvelopeSimple, Plus, ShieldCheck, Trash, UserFocus } from '@phosphor-icons/react';
import type { InterviewSource, InterviewSourceStatus, InterviewSourceType, OutreachTemplateType, SourceAttribution } from '../../../shared/报道执行模型.js';
import { buildOutreachTemplate, createOutreachAttempt, transitionSourceStatus } from '../../../shared/采访执行规则.js';
import { WorkbenchPage, StatusChip, formatDateTime, newId } from './共享';
import type { ExecutionPageProps } from './类型';

const sourceStatuses: InterviewSourceStatus[] = ['identified', 'contact_drafted', 'contacted', 'responded', 'scheduled', 'interviewed', 'follow_up_needed', 'completed', 'declined', 'unreachable', 'dropped'];
const sourceTypes: InterviewSourceType[] = ['student', 'teacher', 'expert', 'school_administrator', 'policy_maker', 'affected_group', 'business', 'witness', 'other'];
const templateMap: Record<InterviewSourceType, OutreachTemplateType> = {
  student: 'student', teacher: 'teacher', expert: 'expert', school_administrator: 'school_administrator', policy_maker: 'school_administrator', affected_group: 'sensitive', business: 'commercial', witness: 'sensitive', other: 'sensitive',
};

export function SourcesPage({ brief, value, onChange }: ExecutionPageProps) {
  const [statusFilter, setStatusFilter] = useState('all');
  const [typeFilter, setTypeFilter] = useState('all');
  const [accessFilter, setAccessFilter] = useState('all');
  const [selectedId, setSelectedId] = useState(value.sources[0]?.id || '');
  const [outreachMessage, setOutreachMessage] = useState('');
  const [outreachChannel, setOutreachChannel] = useState<'email' | 'phone' | 'wechat' | 'in_person' | 'other'>('email');
  const filtered = useMemo(() => value.sources.filter((source) =>
    (statusFilter === 'all' || source.status === statusFilter) &&
    (typeFilter === 'all' || source.sourceType === typeFilter) &&
    (accessFilter === 'all' || source.accessibility === accessFilter),
  ), [accessFilter, statusFilter, typeFilter, value.sources]);
  const selected = value.sources.find((source) => source.id === selectedId) || value.sources[0];
  const updateSource = (id: string, patch: Partial<InterviewSource>) => onChange((current) => ({
    ...current,
    sources: current.sources.map((source) => source.id === id ? { ...source, ...patch, updatedAt: new Date().toISOString() } : source),
    updatedAt: new Date().toISOString(),
  }));
  const changeStatus = (source: InterviewSource, next: InterviewSourceStatus) => {
    try {
      updateSource(source.id, { status: transitionSourceStatus(source.status, next) });
    } catch (error) {
      globalThis.alert(error instanceof Error ? error.message : '状态转换不符合采访流程。');
    }
  };
  const addSource = () => {
    const timestamp = new Date().toISOString();
    const id = newId('source');
    onChange((current) => ({ ...current, sources: [...current.sources, {
      id, identity: '', publicLabel: '新采访对象', role: '待定义角色', sourceType: 'other', status: 'identified', accessibility: 'unknown', informationValue: '', relationshipToTopic: '', possibleBias: '', contactMethods: [],
      attribution: { mode: 'unconfirmed', publicLabel: '新采访对象', identityPrivate: true }, consent: null, alternativeSourceIds: [], nextAction: '确认角色与联系渠道', privateNotes: '', createdAt: timestamp, updatedAt: timestamp,
    }], sessions: [...current.sessions, { id: `session-${id}`, sourceId: id, status: 'planned', purpose: '', consent: null, questionIds: [], createdAt: timestamp, updatedAt: timestamp }], updatedAt: timestamp }));
    setSelectedId(id);
  };
  const removeSource = (source: InterviewSource) => {
    if (!globalThis.confirm(`删除“${source.publicLabel || source.role}”及其采访记录、转写、笔记和引语？此操作会立即从当前浏览器项目删除。`)) return;
    onChange((current) => {
      const sessionIds = new Set(current.sessions.filter((session) => session.sourceId === source.id).map((session) => session.id));
      return {
        ...current,
        sources: current.sources.filter((item) => item.id !== source.id),
        sessions: current.sessions.filter((session) => session.sourceId !== source.id),
        questions: current.questions.filter((question) => question.sourceId !== source.id),
        notes: current.notes.filter((note) => !sessionIds.has(note.sessionId)),
        transcripts: current.transcripts.filter((transcript) => !sessionIds.has(transcript.sessionId)),
        quotes: current.quotes.filter((quote) => quote.sourceId !== source.id),
        outreachAttempts: current.outreachAttempts.filter((attempt) => attempt.sourceId !== source.id),
        updatedAt: new Date().toISOString(),
      };
    });
    setSelectedId('');
  };
  const draftOutreach = () => {
    if (!selected) return;
    setOutreachMessage(buildOutreachTemplate({
      reporterIdentity: '新闻采访与写作课程学生记者', contactReason: brief.mode === 'course' ? '课程报道作业' : '校园媒体报道', topic: brief.rawTopic,
      purpose: selected.informationValue || selected.relationshipToTopic || '了解与主题直接相关的经历和事实', durationMinutes: 20, method: outreachChannel === 'in_person' ? '线下面谈' : outreachChannel,
      recordingPlan: '如需录音，会在开始前另行征得同意', usePlan: '材料仅用于本次报道策划与课程提交', anonymityOption: '可在采访前协商实名、匿名、background 或 off-record 边界', returnContact: '请在当前渠道回复',
    }));
    if (selected.status === 'identified') updateSource(selected.id, { status: 'contact_drafted' });
  };
  const saveOutreach = () => {
    if (!selected || !outreachMessage.trim()) return;
    const attempt = createOutreachAttempt({ id: newId('outreach'), sourceId: selected.id, channel: outreachChannel, templateType: templateMap[selected.sourceType], message: outreachMessage.trim(), attemptedAt: new Date().toISOString() });
    onChange((current) => ({ ...current, outreachAttempts: [...current.outreachAttempts, attempt], sources: current.sources.map((source) => source.id === selected.id ? { ...source, status: source.status === 'contact_drafted' || source.status === 'identified' ? 'contacted' : source.status, nextAction: '等待回应并在约定时间后人工跟进', updatedAt: new Date().toISOString() } : source), updatedAt: new Date().toISOString() }));
    setOutreachMessage('');
  };
  return (
    <WorkbenchPage eyebrow="采访对象" title="管理谁值得采访、怎么联系、能否归因" description="联系方式和真实身份默认为私密；系统只生成可编辑联系草稿并记录人工动作，不自动发送、不冒充记者、不施压。" actions={<button className="primary-action" type="button" onClick={addSource}><Plus />添加对象</button>}>
      <div className="source-toolbar"><label>状态<select value={statusFilter} onChange={(e) => setStatusFilter(e.target.value)}><option value="all">全部</option>{sourceStatuses.map((status) => <option key={status}>{status}</option>)}</select></label><label>类型<select value={typeFilter} onChange={(e) => setTypeFilter(e.target.value)}><option value="all">全部</option>{sourceTypes.map((type) => <option key={type}>{type}</option>)}</select></label><label>可接触性<select value={accessFilter} onChange={(e) => setAccessFilter(e.target.value)}><option value="all">全部</option><option value="high">高</option><option value="medium">中</option><option value="low">低</option><option value="unknown">未知</option></select></label></div>
      <div className="source-layout">
        <div className="source-list">{filtered.map((source) => <button type="button" key={source.id} className="source-list__item" data-active={source.id === selected?.id} onClick={() => setSelectedId(source.id)}><UserFocus /><span><b>{source.publicLabel || source.role}</b><small>{source.role} · {source.sourceType}</small></span><StatusChip tone={source.status === 'completed' ? 'good' : ['declined', 'unreachable'].includes(source.status) ? 'danger' : 'neutral'}>{source.status}</StatusChip></button>)}</div>
        {selected ? <article className="source-editor">
          <header><div><span>PRIVATE SOURCE RECORD</span><h3>{selected.publicLabel || selected.role}</h3></div><button className="icon-danger" type="button" onClick={() => removeSource(selected)} aria-label="删除采访对象"><Trash /></button></header>
          <div className="source-editor__grid">
            <label>公开称呼<input value={selected.publicLabel} onChange={(event) => updateSource(selected.id, { publicLabel: event.target.value, attribution: { ...selected.attribution, publicLabel: event.target.value } })} /></label>
            <label>真实身份（私密）<input value={selected.identity} onChange={(event) => updateSource(selected.id, { identity: event.target.value })} autoComplete="off" /></label>
            <label>角色<input value={selected.role} onChange={(event) => updateSource(selected.id, { role: event.target.value })} /></label>
            <label>信源类型<select value={selected.sourceType} onChange={(event) => updateSource(selected.id, { sourceType: event.target.value as InterviewSourceType })}>{sourceTypes.map((type) => <option key={type}>{type}</option>)}</select></label>
            <label>状态<select value={selected.status} onChange={(event) => changeStatus(selected, event.target.value as InterviewSourceStatus)}>{sourceStatuses.map((status) => <option key={status}>{status}</option>)}</select></label>
            <label>可接触性<select value={selected.accessibility} onChange={(event) => updateSource(selected.id, { accessibility: event.target.value as InterviewSource['accessibility'] })}><option value="high">高</option><option value="medium">中</option><option value="low">低</option><option value="unknown">未知</option></select></label>
            <label>预约时间<input type="datetime-local" value={selected.scheduledAt?.slice(0, 16) || ''} onChange={(event) => updateSource(selected.id, { scheduledAt: event.target.value ? new Date(event.target.value).toISOString() : undefined })} /></label>
            <label>私密联系方式<input value={selected.contactMethods[0]?.value || ''} onChange={(event) => updateSource(selected.id, { contactMethods: event.target.value ? [{ type: outreachChannel, value: event.target.value, isPrivate: true }] : [] })} autoComplete="off" placeholder="不进入公开导出" /></label>
            <label className="source-wide">信息价值<textarea value={selected.informationValue} onChange={(event) => updateSource(selected.id, { informationValue: event.target.value })} /></label>
            <label className="source-wide">下一步行动<input value={selected.nextAction} onChange={(event) => updateSource(selected.id, { nextAction: event.target.value })} /></label>
            <label className="source-wide">替代信源编号<input value={selected.alternativeSourceIds.join('、')} onChange={(event) => updateSource(selected.id, { alternativeSourceIds: event.target.value.split(/[、,，]/u).map((item) => item.trim()).filter(Boolean) })} placeholder="主信源不可达时可切换的 source ID" /></label>
            <label>归因方式<select value={selected.attribution.mode} onChange={(event) => updateSource(selected.id, { attribution: { ...selected.attribution, mode: event.target.value as SourceAttribution['mode'] } })}><option value="unconfirmed">未确认</option><option value="named">实名</option><option value="anonymous">匿名</option><option value="background">背景使用</option><option value="off_record">不公开</option></select></label>
            <label className="consent-check"><input type="checkbox" checked={selected.consent?.attributionConfirmed || false} onChange={(event) => updateSource(selected.id, { consent: { recordingAllowed: selected.consent?.recordingAllowed || false, materialUseAllowed: selected.consent?.materialUseAllowed || false, attributionConfirmed: event.target.checked, attributionMode: selected.attribution.mode, checkedAt: new Date().toISOString() } })} /><ShieldCheck />归因已确认</label>
          </div>
          <section className="outreach-box"><header><EnvelopeSimple /><div><h4>联系草稿与人工记录</h4><p>请自行核对、复制和发送；NewsPilot 不会代发。</p></div></header><div className="outreach-controls"><select aria-label="联系渠道" value={outreachChannel} onChange={(e) => setOutreachChannel(e.target.value as typeof outreachChannel)}><option value="email">邮件</option><option value="phone">电话</option><option value="wechat">微信</option><option value="in_person">线下</option><option value="other">其他</option></select><button type="button" onClick={draftOutreach}>生成可编辑草稿</button></div><textarea value={outreachMessage} onChange={(event) => setOutreachMessage(event.target.value)} placeholder="生成或自行填写联系消息" /><button className="primary-action" type="button" onClick={saveOutreach} disabled={!outreachMessage.trim()}>记录为已人工联系</button></section>
          <div className="outreach-history"><h4>联系历史</h4>{value.outreachAttempts.filter((attempt) => attempt.sourceId === selected.id).map((attempt) => <div key={attempt.id}><CalendarBlank /><span><b>{attempt.channel} · {attempt.delivery}</b><small>{formatDateTime(attempt.attemptedAt)} · {attempt.responseStatus}</small></span></div>)}</div>
        </article> : <div className="execution-empty">请选择或添加采访对象。</div>}
      </div>
    </WorkbenchPage>
  );
}
