import { useMemo, useState } from 'react';
import { CheckCircle, LinkSimple, Plus, Sparkle, Warning } from '@phosphor-icons/react';
import type { InterviewQuestion, InterviewQuestionCategory } from '../../../shared/报道执行模型.js';
import { assessInterviewQuestion } from '../../../shared/采访执行规则.js';
import { WorkbenchPage, StatusChip, newId } from './共享';
import type { ExecutionPageProps } from './类型';

const categories: InterviewQuestionCategory[] = ['opening', 'fact', 'experience', 'cause', 'conflict', 'verification', 'follow_up', 'closing'];

export function InterviewGuidePage({ evidenceWorkspace, value, onChange }: ExecutionPageProps) {
  const [sourceId, setSourceId] = useState(value.sources[0]?.id || '');
  const source = value.sources.find((item) => item.id === sourceId) || value.sources[0];
  const questions = useMemo(() => value.questions.filter((question) => question.sourceId === source?.id).sort((a, b) => a.order - b.order), [source?.id, value.questions]);
  const updateQuestion = (id: string, patch: Partial<InterviewQuestion>) => onChange((current) => ({
    ...current,
    questions: current.questions.map((question) => {
      if (question.id !== id) return question;
      const assessed = assessInterviewQuestion({ ...question, ...patch, userConfirmed: patch.userConfirmed ?? false });
      const duplicate = current.questions.some((candidate) => candidate.id !== id && candidate.sourceId === question.sourceId && candidate.text.trim() === assessed.text.trim());
      return { ...assessed, riskFlags: duplicate ? [...new Set([...assessed.riskFlags, 'duplicate' as const])] : assessed.riskFlags };
    }),
    updatedAt: new Date().toISOString(),
  }));
  const addQuestion = () => {
    if (!source) return;
    onChange((current) => ({ ...current, questions: [...current.questions, {
      id: newId('question'), sourceId: source.id, category: 'fact', text: '请填写一个能获得具体事实或经历的问题。', purpose: '说明为什么要问', expectedEvidence: '写明需要得到的事实、文件、时间、人物或可核验对象', claimIds: [], evidenceGapIds: [], followUps: [], riskFlags: ['unbound'], order: questions.length + 1, userConfirmed: false,
    }], updatedAt: new Date().toISOString() }));
  };
  const confirm = (question: InterviewQuestion) => {
    const assessed = assessInterviewQuestion(question);
    if (!assessed.isReady || assessed.riskFlags.some((flag) => ['leading', 'double_barreled', 'privacy', 'unbound', 'irrelevant'].includes(flag))) {
      globalThis.alert('请先修正问题绑定或高风险表达，再由记者确认。');
      return;
    }
    updateQuestion(question.id, { userConfirmed: true });
  };
  return (
    <WorkbenchPage eyebrow="采访提纲" title="让每个问题都服务于一个主张或证据缺口" description="问题由规则和策划结果提供建议，但必须由记者确认。系统标记诱导、一题多问、猜测、宽泛、态度化、隐私、重复与无绑定风险。" actions={<button className="primary-action" type="button" onClick={addQuestion} disabled={!source}><Plus />添加问题</button>}>
      <div className="guide-source-tabs" role="tablist" aria-label="按采访对象切换提纲">{value.sources.map((item) => <button type="button" role="tab" aria-selected={item.id === source?.id} key={item.id} onClick={() => setSourceId(item.id)}><span>{item.publicLabel || item.role}</span><small>{value.questions.filter((question) => question.sourceId === item.id && question.userConfirmed).length}/{value.questions.filter((question) => question.sourceId === item.id).length} 已确认</small></button>)}</div>
      {source ? <div className="guide-layout">
        <aside className="guide-purpose"><Sparkle /><span>INTERVIEW PURPOSE</span><h3>{source.publicLabel || source.role}</h3><p>{source.informationValue || source.relationshipToTopic}</p><dl><div><dt>可能偏差</dt><dd>{source.possibleBias || '待判断'}</dd></div><div><dt>归因边界</dt><dd>{source.attribution.mode}</dd></div></dl></aside>
        <div className="question-list">{questions.map((question, index) => <article className="question-card" key={question.id} data-confirmed={question.userConfirmed}>
          <div className="question-card__number">{String(index + 1).padStart(2, '0')}</div>
          <div className="question-card__content">
            <div className="question-card__top"><select aria-label={`问题 ${index + 1} 分类`} value={question.category} onChange={(event) => updateQuestion(question.id, { category: event.target.value as InterviewQuestionCategory })}>{categories.map((category) => <option key={category}>{category}</option>)}</select>{question.userConfirmed ? <StatusChip tone="good"><CheckCircle />记者已确认</StatusChip> : <StatusChip tone="warn">待确认</StatusChip>}</div>
            <textarea className="question-text" aria-label={`问题 ${index + 1}`} value={question.text} onChange={(event) => updateQuestion(question.id, { text: event.target.value })} />
            <div className="question-card__grid"><label>为什么问<textarea value={question.purpose} onChange={(event) => updateQuestion(question.id, { purpose: event.target.value })} /></label><label>预期拿到什么证据<textarea value={question.expectedEvidence} onChange={(event) => updateQuestion(question.id, { expectedEvidence: event.target.value })} /></label></div>
            <div className="question-bindings"><LinkSimple /><label>绑定主张<select value={question.claimIds[0] || ''} onChange={(event) => updateQuestion(question.id, { claimIds: event.target.value ? [event.target.value] : [] })}><option value="">暂不绑定</option>{evidenceWorkspace.claims.map((claim) => <option key={claim.id} value={claim.id}>{claim.id} · {claim.text.slice(0, 36)}</option>)}</select></label><label>绑定缺口<select value={question.evidenceGapIds[0] || ''} onChange={(event) => updateQuestion(question.id, { evidenceGapIds: event.target.value ? [event.target.value] : [] })}><option value="">暂不绑定</option>{value.evidenceGaps.map((gap) => <option key={gap.id} value={gap.id}>{gap.type} · {gap.description.slice(0, 30)}</option>)}</select></label></div>
            {question.riskFlags.length ? <div className="question-risks"><Warning />{question.riskFlags.map((flag) => <span key={flag}>{flag}</span>)}</div> : <div className="question-safe"><CheckCircle />未发现规则风险，仍需记者判断语境。</div>}
            <div className="question-card__footer"><label>追问建议<input value={question.followUps.join('；')} onChange={(event) => updateQuestion(question.id, { followUps: event.target.value.split('；').map((item) => item.trim()).filter(Boolean) })} /></label><button type="button" onClick={() => confirm(question)} disabled={question.userConfirmed}>确认进入采访</button></div>
          </div>
        </article>)}</div>
      </div> : <div className="execution-empty">请先添加采访对象。</div>}
    </WorkbenchPage>
  );
}
