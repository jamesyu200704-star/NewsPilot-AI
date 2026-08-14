import { useMemo, useState } from 'react';
import { ArrowRight, Check, FileText, MicrophoneSlash, Quotes, ShieldWarning, Trash, WarningCircle } from '@phosphor-icons/react';
import type { InterviewNoteKind, InterviewSession, TranscriptSegment } from '../../../shared/报道执行模型.js';
import { ManualTranscriptProvider } from '../../../shared/采访转写.js';
import { canCompleteInterview, canUseAsDirectQuote } from '../../../shared/报道执行工作区.js';
import { processInterviewEvidence, promoteInterviewCandidateToEvidence } from '../../../shared/采访证据处理.js';
import { transcribeWithLocalWhisper } from '../../services/本地转写服务';
import { WorkbenchPage, StatusChip, newId } from './共享';
import type { ExecutionPageProps } from './类型';

const noteKinds: Array<{ value: InterviewNoteKind; label: string }> = [
  { value: 'fact', label: '事实陈述' }, { value: 'direct_quote', label: '直接引语' }, { value: 'paraphrase', label: '转述' }, { value: 'contradiction', label: '矛盾' }, { value: 'follow_up', label: '需追问' }, { value: 'new_lead', label: '新线索' }, { value: 'not_answered', label: '未回答' },
];

export function InterviewRecordsPage({ evidenceWorkspace, value, onChange, onEvidenceChange }: ExecutionPageProps) {
  const [sessionId, setSessionId] = useState(value.sessions[0]?.id || '');
  const [noteText, setNoteText] = useState('');
  const [noteKind, setNoteKind] = useState<InterviewNoteKind>('fact');
  const [notePrivate, setNotePrivate] = useState(false);
  const [noteOffRecord, setNoteOffRecord] = useState(false);
  const [manualText, setManualText] = useState('');
  const [claimId, setClaimId] = useState(evidenceWorkspace.claims[0]?.id || '');
  const [notice, setNotice] = useState('');
  const [processingAudio, setProcessingAudio] = useState(false);
  const session = value.sessions.find((item) => item.id === sessionId) || value.sessions[0];
  const source = value.sources.find((item) => item.id === session?.sourceId);
  const questions = useMemo(() => value.questions.filter((question) => question.sourceId === source?.id).sort((a, b) => a.order - b.order), [source?.id, value.questions]);
  const notes = value.notes.filter((note) => note.sessionId === session?.id);
  const transcript = value.transcripts.find((item) => item.sessionId === session?.id);
  const currentQuestion = questions.find((question) => question.id === session?.currentQuestionId) || questions[0];
  const updateSession = (id: string, patch: Partial<InterviewSession>) => onChange((current) => ({ ...current, sessions: current.sessions.map((item) => item.id === id ? { ...item, ...patch, updatedAt: new Date().toISOString() } : item), updatedAt: new Date().toISOString() }));
  const startInterview = () => {
    if (!session || !source) return;
    if (!session.consent?.materialUseAllowed || !session.consent.attributionConfirmed) {
      setNotice('开始前必须确认材料使用和归因边界。录音许可可以为“不允许”，但不能留空。');
      return;
    }
    updateSession(session.id, { status: 'in_progress', startedAt: new Date().toISOString(), currentQuestionId: questions[0]?.id });
    onChange((current) => ({ ...current, sources: current.sources.map((item) => item.id === source.id ? { ...item, status: item.status === 'scheduled' ? 'interviewed' : item.status } : item) }));
    setNotice('采访模式已开始。NewsPilot 不会录音；请使用你已获同意的外部录音方式。');
  };
  const addNote = () => {
    if (!session || !source || !noteText.trim()) return;
    const timestamp = new Date().toISOString();
    onChange((current) => ({ ...current, notes: [...current.notes, { id: newId('note'), sessionId: session.id, sourceId: source.id, questionId: currentQuestion?.id, kind: noteKind, text: noteText.trim(), capturedAt: timestamp, reviewStatus: 'unreviewed', isPrivate: notePrivate, isOffRecord: noteOffRecord }], updatedAt: timestamp }));
    setNoteText('');
  };
  const moveQuestion = (direction: 1 | -1) => {
    if (!session || !currentQuestion) return;
    const index = questions.findIndex((question) => question.id === currentQuestion.id);
    updateSession(session.id, { currentQuestionId: questions[Math.max(0, Math.min(questions.length - 1, index + direction))]?.id });
  };
  const endInterview = () => {
    if (!session) return;
    updateSession(session.id, { status: 'review_required', endedAt: new Date().toISOString(), debrief: undefined });
    setNotice('已进入采访后复盘。先确认要点、未回答项、冲突、引语和后续，再完成采访。');
  };
  const prepareDebrief = () => {
    if (!session) return;
    const answeredIds = new Set(notes.filter((note) => note.questionId && note.kind !== 'not_answered').map((note) => note.questionId));
    const unansweredIds = questions.filter((question) => !answeredIds.has(question.id)).map((question) => question.id);
    updateSession(session.id, { debrief: {
      confirmedPointIds: notes.filter((note) => note.reviewStatus === 'confirmed').map((note) => note.id), newLeadIds: value.leads.filter((lead) => lead.sessionId === session.id).map((lead) => lead.id), unansweredQuestionIds: unansweredIds,
      conflictIds: notes.filter((note) => note.kind === 'contradiction').map((note) => note.id), quoteCandidateIds: value.quotes.filter((quote) => quote.sessionId === session.id).map((quote) => quote.id), nextSourceIds: [], followUpTaskIds: value.tasks.filter((task) => task.sourceIds.includes(session.sourceId) && task.type === 'close_evidence_gap').map((task) => task.id), completedAt: new Date().toISOString(),
    } });
    setNotice('复盘已根据真实记录建立，请核对后再确认完成。');
  };
  const completeInterview = () => {
    if (!session || !source) return;
    const gate = canCompleteInterview(session, value.notes, value.questions);
    if (!gate.ok) { setNotice(gate.reasons.join('；')); return; }
    updateSession(session.id, { status: 'completed' });
    onChange((current) => ({ ...current, sources: current.sources.map((item) => item.id === source.id ? { ...item, status: 'completed', nextAction: '将采访陈述与独立来源交叉核验' } : item) }));
    setNotice('采访已完成，但受访者陈述仍未自动成为事实。');
  };
  const importManualTranscript = async (file?: File) => {
    if (!session || !source) return;
    try {
      const text = file ? await file.text() : manualText;
      const next = await new ManualTranscriptProvider().transcribe({ id: newId('transcript'), sessionId: session.id, sourceId: source.id, text, fileName: file?.name, now: new Date().toISOString() });
      onChange((current) => ({ ...current, transcripts: [...current.transcripts.filter((item) => item.sessionId !== session.id), next], sessions: current.sessions.map((item) => item.id === session.id ? { ...item, transcriptId: next.id } : item), updatedAt: new Date().toISOString() }));
      setManualText(''); setNotice('转写已导入并标记为“待复核”。');
    } catch (error) { setNotice(error instanceof Error ? error.message : '转写导入失败。'); }
  };
  const importAudio = async (file?: File) => {
    if (!file || !session || !source) return;
    if (!session.consent?.recordingAllowed) { setNotice('未记录录音同意，不能处理音频。请使用人工笔记或先确认许可。'); return; }
    setProcessingAudio(true);
    try {
      const next = await transcribeWithLocalWhisper({ file, transcriptId: newId('transcript'), sessionId: session.id, sourceId: source.id });
      onChange((current) => ({ ...current, transcripts: [...current.transcripts.filter((item) => item.sessionId !== session.id), next], sessions: current.sessions.map((item) => item.id === session.id ? { ...item, transcriptId: next.id } : item), updatedAt: new Date().toISOString() }));
      setNotice('本地自动转写已完成，音频未保存；所有片段仍须人工复核。');
    } catch (error) { setNotice(error instanceof Error ? error.message : '本地转写失败，请改用人工粘贴。'); }
    finally { setProcessingAudio(false); }
  };
  const updateSegment = (id: string, patch: Partial<TranscriptSegment>) => onChange((current) => ({ ...current, transcripts: current.transcripts.map((item) => item.id === transcript?.id ? { ...item, segments: item.segments.map((segment) => segment.id === id ? { ...segment, ...patch } : segment), status: 'review_required', updatedAt: new Date().toISOString() } : item), updatedAt: new Date().toISOString() }));
  const processEvidence = () => {
    if (!session || !source) return;
    const result = processInterviewEvidence({ sessionId: session.id, sourceId: source.id, notes, transcriptSegments: transcript?.segments || [] });
    onChange((current) => ({ ...current, quotes: [...current.quotes, ...result.quoteCandidates.filter((candidate) => !current.quotes.some((quote) => quote.sourceNoteId === candidate.sourceNoteId && quote.sourceTranscriptSegmentId === candidate.sourceTranscriptSegmentId))], leads: [...current.leads, ...result.leads.filter((lead) => !current.leads.some((item) => item.text === lead.text && item.sessionId === lead.sessionId))], updatedAt: new Date().toISOString() }));
    setNotice(result.reviewWarnings.length ? result.reviewWarnings.join('；') : `已生成 ${result.quoteCandidates.length} 条候选引语和 ${result.leads.length} 条线索，需继续人工确认。`);
  };
  const promoteNote = (noteId: string) => {
    const note = value.notes.find((item) => item.id === noteId);
    if (!note || !source || !claimId || note.reviewStatus !== 'confirmed') return;
    const promoted = promoteInterviewCandidateToEvidence({ candidate: { id: `candidate-${note.id}`, sourceId: source.id, sessionId: note.sessionId, text: note.text, sourceNoteId: note.id, status: 'attributed_unverified' }, source, claimId, relation: note.kind === 'contradiction' ? 'contradicts' : note.kind === 'fact' ? 'supports' : 'context', userConfirmed: true });
    onEvidenceChange((current) => ({ ...current, sources: current.sources.some((item) => item.id === promoted.sourceRecord.id) ? current.sources : [...current.sources, promoted.sourceRecord], evidence: current.evidence.some((item) => item.id === promoted.evidenceItem.id) ? current.evidence : [...current.evidence, promoted.evidenceItem], updatedAt: new Date().toISOString() }));
    setNotice('采访陈述已作为“归因且未核实”的材料纳入证据工作区，不会自动升级为事实。');
  };
  const deleteTranscript = () => {
    if (!transcript || !globalThis.confirm('删除这份转写及全部片段？音频本来就没有保存。')) return;
    onChange((current) => ({ ...current, transcripts: current.transcripts.filter((item) => item.id !== transcript.id), sessions: current.sessions.map((item) => item.transcriptId === transcript.id ? { ...item, transcriptId: undefined } : item), updatedAt: new Date().toISOString() }));
  };
  const deleteSession = () => {
    if (!session || !globalThis.confirm('删除这次采访场次及其笔记、转写、引语和线索？此操作会立即从当前浏览器项目移除。')) return;
    onChange((current) => ({
      ...current,
      sessions: current.sessions.filter((item) => item.id !== session.id),
      notes: current.notes.filter((item) => item.sessionId !== session.id),
      transcripts: current.transcripts.filter((item) => item.sessionId !== session.id),
      quotes: current.quotes.filter((item) => item.sessionId !== session.id),
      leads: current.leads.filter((item) => item.sessionId !== session.id),
      updatedAt: new Date().toISOString(),
    }));
    setSessionId('');
    setNotice('采访场次及关联本地材料已删除。');
  };
  return (
    <WorkbenchPage eyebrow="采访记录" title="在采访现场记录事实、引语、矛盾与追问" description="专注模式不录音、不生成受访者回答。音频只在明确同意且本地 Whisper 可用时处理；失败自动保留人工输入路径。">
      <div className="record-session-tabs">{value.sessions.map((item) => { const itemSource = value.sources.find((candidate) => candidate.id === item.sourceId); return <button type="button" key={item.id} data-active={item.id === session?.id} onClick={() => setSessionId(item.id)}><span>{itemSource?.publicLabel || itemSource?.role}</span><small>{item.status}</small></button>; })}</div>
      {notice ? <div className="record-notice" role="status"><WarningCircle />{notice}</div> : null}
      {session && source ? <div className="record-layout">
        <section className="interview-console">
          <header><div><span>INTERVIEW MODE</span><h3>{source.publicLabel || source.role}</h3><p>{session.purpose}</p></div><div className="interview-console__status"><StatusChip tone={session.status === 'completed' ? 'good' : session.status === 'review_required' ? 'warn' : 'neutral'}>{session.status}</StatusChip><button type="button" onClick={deleteSession} aria-label="删除采访场次"><Trash /></button></div></header>
          <div className="consent-panel"><ShieldWarning /><div><b>同意与归因</b><label><input type="checkbox" checked={session.consent?.materialUseAllowed || false} onChange={(event) => updateSession(session.id, { consent: { recordingAllowed: session.consent?.recordingAllowed || false, materialUseAllowed: event.target.checked, attributionConfirmed: session.consent?.attributionConfirmed || false, attributionMode: source.attribution.mode, checkedAt: new Date().toISOString() } })} />允许使用采访材料</label><label><input type="checkbox" checked={session.consent?.attributionConfirmed || false} onChange={(event) => updateSession(session.id, { consent: { recordingAllowed: session.consent?.recordingAllowed || false, materialUseAllowed: session.consent?.materialUseAllowed || false, attributionConfirmed: event.target.checked, attributionMode: source.attribution.mode, checkedAt: new Date().toISOString() } })} />已确认 {source.attribution.mode} 归因</label><label><input type="checkbox" checked={session.consent?.recordingAllowed || false} onChange={(event) => updateSession(session.id, { consent: { recordingAllowed: event.target.checked, materialUseAllowed: session.consent?.materialUseAllowed || false, attributionConfirmed: session.consent?.attributionConfirmed || false, attributionMode: source.attribution.mode, checkedAt: new Date().toISOString() } })} />明确允许录音</label></div></div>
          {session.status === 'planned' || session.status === 'scheduled' ? <button className="primary-action interview-start" type="button" onClick={startInterview}>开始采访 <ArrowRight /></button> : null}
          {session.status === 'in_progress' && currentQuestion ? <div className="focus-question"><span>当前问题 · {currentQuestion.category}</span><h4>{currentQuestion.text}</h4><p><b>为什么问：</b>{currentQuestion.purpose}</p><p><b>预期证据：</b>{currentQuestion.expectedEvidence}</p><div><button type="button" onClick={() => moveQuestion(-1)}>上一题</button><button type="button" onClick={() => moveQuestion(1)}>下一题</button></div></div> : null}
          <div className="quick-note"><div className="quick-note__kinds">{noteKinds.map((kind) => <button type="button" key={kind.value} data-active={kind.value === noteKind} onClick={() => setNoteKind(kind.value)}>{kind.label}</button>)}</div><textarea value={noteText} onChange={(event) => setNoteText(event.target.value)} placeholder="只记录实际听到或观察到的内容；不要补写受访者没有说的话。" /><div className="quick-note__footer"><label><input type="checkbox" checked={notePrivate} onChange={(event) => setNotePrivate(event.target.checked)} />私密</label><label><input type="checkbox" checked={noteOffRecord} onChange={(event) => setNoteOffRecord(event.target.checked)} />off-record</label><button type="button" onClick={addNote} disabled={!noteText.trim()}>保存现场笔记</button></div></div>
          {session.status === 'in_progress' ? <button className="secondary-action" type="button" onClick={endInterview}>结束并进入复盘</button> : null}
          {session.status === 'review_required' ? <div className="debrief-actions"><button type="button" onClick={prepareDebrief}>根据真实记录建立复盘</button><button className="primary-action" type="button" onClick={completeInterview}>核对后确认完成采访</button></div> : null}
        </section>
        <aside className="record-materials">
          <section><header><FileText /><div><h3>采访笔记</h3><p>每条笔记须复核后才能形成候选材料。</p></div></header><div className="note-list">{notes.map((note) => <article key={note.id} data-private={note.isPrivate || note.isOffRecord}><div><StatusChip tone={note.reviewStatus === 'confirmed' ? 'good' : 'warn'}>{note.kind}</StatusChip>{note.isPrivate ? <span>私密</span> : null}{note.isOffRecord ? <span>off-record</span> : null}</div><p>{note.text}</p><footer><select value={note.reviewStatus} onChange={(event) => onChange((current) => ({ ...current, notes: current.notes.map((item) => item.id === note.id ? { ...item, reviewStatus: event.target.value as typeof note.reviewStatus } : item) }))}><option value="unreviewed">待复核</option><option value="confirmed">已确认</option><option value="rejected">不采用</option></select><button type="button" onClick={() => promoteNote(note.id)} disabled={note.reviewStatus !== 'confirmed' || note.isPrivate || note.isOffRecord || !claimId}>纳入证据候选</button></footer></article>)}</div><label>纳入时绑定主张<select value={claimId} onChange={(event) => setClaimId(event.target.value)}><option value="">请选择</option>{evidenceWorkspace.claims.map((claim) => <option key={claim.id} value={claim.id}>{claim.id} · {claim.text.slice(0, 28)}</option>)}</select></label></section>
          <section><header><MicrophoneSlash /><div><h3>转写与音频</h3><p>默认人工；音频不保存在 NewsPilot。</p></div></header><textarea value={manualText} onChange={(event) => setManualText(event.target.value)} placeholder="粘贴采访记录，可用“记者：…”分段" /><div className="transcript-actions"><button type="button" onClick={() => void importManualTranscript()} disabled={!manualText.trim()}>导入人工转写</button><label>导入 TXT / MD<input type="file" accept=".txt,.md,text/plain,text/markdown" onChange={(event) => void importManualTranscript(event.target.files?.[0])} /></label><label data-disabled={!session.consent?.recordingAllowed}>{processingAudio ? '本地转写中…' : '本地 Whisper 音频'}<input type="file" accept=".mp3,.wav,.m4a,.webm,audio/mpeg,audio/wav,audio/mp4,audio/webm" disabled={processingAudio || !session.consent?.recordingAllowed} onChange={(event) => void importAudio(event.target.files?.[0])} /></label></div>{transcript ? <div className="transcript-review"><header><b>{transcript.provider} · {transcript.status}</b><button type="button" onClick={deleteTranscript}><Trash />删除转写</button></header>{transcript.warnings.map((warning) => <p key={warning}><WarningCircle />{warning}</p>)}{transcript.segments.map((segment) => <article key={segment.id}><input value={segment.speaker} onChange={(event) => updateSegment(segment.id, { speaker: event.target.value })} aria-label={`${segment.id} 说话人`} /><textarea value={segment.text} onChange={(event) => updateSegment(segment.id, { text: event.target.value, reviewStatus: 'corrected' })} /><div><span>{segment.confidence === undefined ? '无置信度' : `置信度 ${Math.round(segment.confidence * 100)}%`}</span><span>{segment.sensitiveTermFlags.join('、') || '无敏感词标记'}</span><select value={segment.reviewStatus} onChange={(event) => updateSegment(segment.id, { reviewStatus: event.target.value as TranscriptSegment['reviewStatus'] })}><option value="unreviewed">待复核</option><option value="confirmed">已确认</option><option value="corrected">已校正</option><option value="rejected">拒绝</option></select></div></article>)}</div> : null}<button className="secondary-action" type="button" onClick={processEvidence}>提取候选引语与线索</button></section>
          <section><header><Quotes /><div><h3>候选引语</h3><p>必须可追溯、人工确认并允许归因。</p></div></header>{value.quotes.filter((quote) => quote.sessionId === session.id).map((quote) => { const gate = canUseAsDirectQuote(quote); return <article className="quote-candidate" key={quote.id}><blockquote>{quote.text}</blockquote><p>{gate.ok ? <><Check />可作为直接引语候选</> : gate.reasons.join('；')}</p><button type="button" disabled={quote.reviewStatus === 'confirmed'} onClick={() => onChange((current) => ({ ...current, quotes: current.quotes.map((item) => item.id === quote.id ? { ...item, reviewStatus: 'confirmed', attributionMode: source.attribution.mode } : item) }))}>人工确认文本与归因</button></article>; })}</section>
        </aside>
      </div> : <div className="execution-empty">请先建立采访对象和采访场次。</div>}
    </WorkbenchPage>
  );
}
