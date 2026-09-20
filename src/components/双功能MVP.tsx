import { useRef, useState } from 'react';
import {
  ArrowRight,
  Check,
  CheckCircle,
  CircleNotch,
  Copy,
  Microphone,
  NotePencil,
  PencilSimple,
  Plus,
} from '@phosphor-icons/react';
import type { EditorialTaskResult, NewsEditAction } from '../../shared/编辑任务模型';
import { runEditorialTask } from '../services/编辑服务';

type Task = 'interview' | 'news_edit';

const actionConfig: Record<NewsEditAction, {
  label: string;
  description: string;
  inputLabel: string;
  placeholder: string;
  submitLabel: string;
  loadingLabel: string;
  resultLabel: string;
}> = {
  polish: {
    label: '语言润色',
    description: '改病句、口语和重复，事实与引语保持不变',
    inputLabel: '粘贴需要润色的新闻稿',
    placeholder: '在这里粘贴已有新闻稿、消息稿或采访整理稿',
    submitLabel: '开始润色',
    loadingLabel: '正在润色',
    resultLabel: '语言润色结果',
  },
  structure: {
    label: '结构修改',
    description: '重排标题、导语和段落，不补写材料外的事实',
    inputLabel: '粘贴需要调整结构的新闻稿',
    placeholder: '在这里粘贴事实基本完整、需要重组结构的稿件',
    submitLabel: '调整结构',
    loadingLabel: '正在调整结构',
    resultLabel: '结构修改结果',
  },
  commentary: {
    label: '新闻评论',
    description: '基于现有材料形成观点，不把评价写成事实',
    inputLabel: '粘贴作为评论依据的新闻稿或事实材料',
    placeholder: '在这里粘贴已有新闻稿或能够支持评论的事实材料',
    submitLabel: '生成评论',
    loadingLabel: '正在生成评论',
    resultLabel: '新闻评论结果',
  },
};

const interviewExamples = ['柯洁赢棋了，我想采访他', '学校延长图书馆开放时间'];
const sourceTextLimit = 30_000;

const formatInterviewQuestion = (item: NonNullable<EditorialTaskResult['interviewPlan']>['sections'][number]['questions'][number]) => [
  item.question,
  `采访对象：${item.target}`,
  `为什么问：${item.purpose}`,
  `追问：${item.followUp}`,
  `资料依据：${item.sourceTitles.length ? item.sourceTitles.join('、') : '无公开资料依据，请在采访中核实'}`,
].join('\n');

const formatInterviewResult = (result: EditorialTaskResult) => {
  let questionNumber = 0;
  const subjects = result.interviewPlan?.subjects
    .map((subject) => `- ${subject.name}（${subject.role}）：${subject.reason}`)
    .join('\n') ?? '';
  const sections = result.interviewPlan?.sections
    .map((section) => {
      const questions = section.questions.map((item) => {
        questionNumber += 1;
        return [
        `${questionNumber}. ${item.question}`,
        `   采访对象：${item.target}`,
        `   为什么问：${item.purpose}`,
        `   追问：${item.followUp}`,
        `   资料依据：${item.sourceTitles.length ? item.sourceTitles.join('、') : '无公开资料依据，请在采访中核实'}`,
        ].join('\n');
      }).join('\n');
      return `${section.title}\n${questions}`;
    })
    .join('\n\n') ?? result.output;
  const understanding = result.understanding
    ? ['采访事件', result.understanding.event, '采访重点', result.understanding.interviewNeed].join('\n')
    : '';
  const references = result.research?.sources.length
    ? ['参考资料', ...result.research.sources.map((source) => `- ${source.title}${source.url ? `\n  ${source.url}` : ''}`)].join('\n')
    : '';
  const reminders = result.notes.length ? ['采访提醒', ...result.notes.map((note) => `- ${note}`)].join('\n') : '';
  return [result.title, understanding, '采访对象', subjects, '采访问题', sections, references, reminders, '说明：这是一份采访准备材料，问题中的内容仍需向受访者求证。']
    .filter(Boolean)
    .join('\n\n');
};

const usefulVerificationItems = (items: string[]) => items.filter((item) =>
  !/^(?:待核实|待确认|无|暂无|无待核实项)[。！!]?$/u.test(item.trim()),
);

const friendlyResearchNotice = (result: EditorialTaskResult) => {
  if (!result.research) return '';
  if (result.research.status === 'live' && result.research.sources.length) {
    return `已找到 ${result.research.sources.length} 条公开资料，可用于采访前了解背景。资料内容仍需在采访中核实。`;
  }
  return '暂未找到可用的公开资料。提纲仍根据你输入的主题生成，采访前请再核对人物、时间和事件经过。';
};

export function DualWorkflowMvp() {
  const [task, setTask] = useState<Task | null>(null);
  const [action, setAction] = useState<NewsEditAction>('polish');
  const [drafts, setDrafts] = useState<Record<Task, string>>({ interview: '', news_edit: '' });
  const [result, setResult] = useState<EditorialTaskResult | null>(null);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const [copyStatus, setCopyStatus] = useState('');
  const [copiedQuestionKey, setCopiedQuestionKey] = useState('');
  const inputRef = useRef<HTMLTextAreaElement>(null);
  const requestControllerRef = useRef<AbortController | null>(null);
  const currentEditAction = actionConfig[action];
  const sourceText = task ? drafts[task] : '';

  const updateSourceText = (value: string) => {
    if (!task) return;
    setDrafts((current) => ({ ...current, [task]: value }));
    setError('');
  };

  const selectTask = (nextTask: Task) => {
    if (loading) return;
    setTask(nextTask);
    setResult(null);
    setError('');
    setCopyStatus('');
    setCopiedQuestionKey('');
    window.requestAnimationFrame(() => inputRef.current?.focus());
  };

  const useInterviewExample = (example: string) => {
    updateSourceText(example);
    window.requestAnimationFrame(() => inputRef.current?.focus());
  };

  const submit = async () => {
    if (!task || loading || requestControllerRef.current) return;
    const minimum = task === 'interview' ? 1 : 20;
    if (sourceText.trim().length < minimum) {
      setError(task === 'interview'
        ? '请用一句话写下你想采访的人或事件。'
        : '请至少粘贴 20 个字的已有材料，新闻编辑不会凭空补写原稿。');
      inputRef.current?.focus();
      return;
    }
    setError('');
    setLoading(true);
    const requestController = new AbortController();
    requestControllerRef.current = requestController;
    try {
      setResult(await runEditorialTask(task === 'interview'
        ? { taskType: 'interview', sourceText: sourceText.trim() }
        : { taskType: 'news_edit', action, sourceText: sourceText.trim() }, requestController.signal));
    } catch (submitError) {
      setError(submitError instanceof Error ? submitError.message : '暂时无法处理，输入内容已保留，请重新生成。');
      inputRef.current?.focus();
    } finally {
      requestControllerRef.current = null;
      setLoading(false);
    }
  };

  const cancelGeneration = () => requestControllerRef.current?.abort();

  const editSource = () => {
    setResult(null);
    setCopyStatus('');
    setCopiedQuestionKey('');
    window.requestAnimationFrame(() => inputRef.current?.focus());
  };

  const createNewTask = () => {
    if (task) setDrafts((current) => ({ ...current, [task]: '' }));
    setResult(null);
    setCopyStatus('');
    setCopiedQuestionKey('');
    window.requestAnimationFrame(() => inputRef.current?.focus());
  };

  const copyText = async (text: string, successMessage: string) => {
    try {
      await navigator.clipboard.writeText(text);
      setCopyStatus(successMessage);
      return true;
    } catch {
      setCopyStatus('复制失败，请手动选择正文复制');
      return false;
    }
  };

  const copyResult = async () => {
    if (!result) return;
    const text = result.taskType === 'interview'
      ? formatInterviewResult(result)
      : result.output;
    await copyText(text, '已复制');
  };

  if (result) {
    const isInterview = result.taskType === 'interview';
    const verificationItems = usefulVerificationItems(result.verificationNeeded);
    const interviewQuestionCount = result.interviewPlan?.sections.reduce((total, section) => total + section.questions.length, 0) ?? 0;
    let questionNumber = 0;
    return (
      <main className="dual-main dual-main--result" aria-live="polite">
        <section className="dual-result">
          <div className="dual-result-head">
            <div>
              <span>{isInterview ? '采访准备结果' : currentEditAction.resultLabel}</span>
              <small>{isInterview ? '可以直接复制，也可以返回修改主题后重新生成。' : '可以直接复制，也可以返回修改原稿后重新生成。'}</small>
              <small className="dual-result-stats">
                {isInterview && result.interviewPlan
                  ? `${result.interviewPlan.subjects.length} 位采访对象 · ${interviewQuestionCount} 个问题`
                  : `原稿 ${sourceText.length} 字 · 成稿 ${result.output.length} 字`}
              </small>
            </div>
            <div className="dual-result-actions">
              <button type="button" className="primary" onClick={() => void copyResult()}>
                {copyStatus === '已复制' ? <Check weight="bold" /> : <Copy weight="bold" />}
                {isInterview ? '复制采访提纲' : '复制成稿'}
              </button>
              <button type="button" onClick={editSource}><PencilSimple />{isInterview ? '修改主题' : '修改原稿'}</button>
              <button type="button" onClick={createNewTask}><Plus />新建任务</button>
            </div>
          </div>
          {copyStatus ? <p className="dual-copy-status" role="status">{copyStatus}</p> : null}
          {result.fallbackNotice ? <p className="dual-fallback-notice" role="alert">{result.fallbackNotice}</p> : null}

          {result.understanding ? (
            <section className="dual-understanding">
              <h2>采访判断</h2>
              <dl>
                <dt>事件类型</dt><dd>{result.interviewPlan?.eventType || '一般事件'}</dd>
                <dt>采访事件</dt><dd>{result.understanding.event}</dd>
                <dt>采访重点</dt><dd>{result.understanding.interviewNeed}</dd>
              </dl>
            </section>
          ) : null}

          <h1>{result.title}</h1>
          {isInterview && result.interviewPlan ? (
            <>
              <section className="dual-subjects">
                <h2>采访对象</h2>
                <div>{result.interviewPlan.subjects.map((subject) => (
                  <article key={`${subject.role}-${subject.name}`}>
                    <span>{subject.role}</span><h3>{subject.name}</h3><p>{subject.reason}</p>
                  </article>
                ))}</div>
              </section>
              <section className="dual-question-plan">
                <h2>采访问题</h2>
                {result.interviewPlan.sections.map((section) => (
                  <section key={section.title}>
                    <h3>{section.title}</h3>
                    {section.questions.map((item, index) => {
                      questionNumber += 1;
                      const itemNumber = questionNumber;
                      const questionKey = `${section.title}-${index}`;
                      const questionCopied = copiedQuestionKey === questionKey;
                      return (
                      <article key={questionKey}>
                        <header>
                          <span>{itemNumber}. {item.priority === 'must' ? '必问' : '选问'}</span>
                          <b>{item.question}</b>
                          <button type="button" onClick={() => {
                            void copyText(formatInterviewQuestion(item), '这一题已复制').then((copied) => {
                              setCopiedQuestionKey(copied ? questionKey : '');
                            });
                          }}>{questionCopied ? <Check /> : <Copy />}{questionCopied ? '这一题已复制' : '复制这一题'}</button>
                        </header>
                        <dl>
                          <dt>采访对象</dt><dd>{item.target}</dd>
                          <dt>为什么问</dt><dd>{item.purpose}</dd>
                          <dt>回答含糊时追问</dt><dd>{item.followUp}</dd>
                          <dt>资料依据</dt><dd>{item.sourceTitles.length ? item.sourceTitles.join('、') : '本题未使用公开资料'}</dd>
                        </dl>
                      </article>
                      );
                    })}
                  </section>
                ))}
              </section>
            </>
          ) : isInterview ? (
            <article className="dual-output" aria-label="采访提纲正文">{result.output}</article>
          ) : (
            <>
              <article className="dual-output" aria-label="修改后的完整成稿">{result.output}</article>
              <details className="dual-source">
                <summary>查看原稿</summary>
                <article>{sourceText}</article>
              </details>
            </>
          )}

          {result.research ? (
            <section className="dual-research">
              <h2>参考资料</h2>
              <p>{friendlyResearchNotice(result)}</p>
              {result.research.sources.length ? <ul>{result.research.sources.map((source) => (
                <li key={source.url || source.title}>
                  {source.url ? <a href={source.url} target="_blank" rel="noreferrer">{source.title}</a> : <span>{source.title}</span>}
                  <small>{source.sourceName}{source.publishedAt ? ` · ${source.publishedAt}` : ''}</small>
                </li>
              ))}</ul> : null}
            </section>
          ) : null}

          {result.notes.length || (!result.understanding && verificationItems.length) ? (
            <div className="dual-details">
              {result.notes.length ? (
                <section>
                  <h2>{result.understanding ? '采访提醒' : '编辑说明'}</h2>
                  <ul>{result.notes.map((note) => <li key={note}>{note}</li>)}</ul>
                </section>
              ) : null}
              {!result.understanding && verificationItems.length ? (
                <section><h2>建议回看原稿</h2><ul>{verificationItems.map((item) => <li key={item}>{item}</li>)}</ul></section>
              ) : null}
            </div>
          ) : null}
          <p className="dual-result-boundary">
            {isInterview ? '这是一份采访准备材料，问题中的内容仍需向受访者求证。' : '修改只基于你粘贴的原稿，系统不会补写材料外的新闻事实。'}
          </p>
        </section>
      </main>
    );
  }

  return (
    <main className="dual-main">
      <section className="dual-intro" aria-labelledby="dual-title">
        <p className="dual-kicker">NewsPilot</p>
        <h1 id="dual-title">采访准备与新闻编辑</h1>
        <p>选择你现在要做的事。只需一句主题，或一篇已有稿件。</p>
        <div className="dual-choice" role="group" aria-label="任务选择">
          <button aria-label="采访准备" type="button" disabled={loading} className={task === 'interview' ? 'active' : ''} onClick={() => selectTask('interview')} aria-pressed={task === 'interview'}>
            <Microphone weight="fill" />
            <b>采访准备</b>
            <small>输入一句采访主题</small>
            <span>得到采访对象与问题提纲</span>
          </button>
          <button aria-label="新闻编辑" type="button" disabled={loading} className={task === 'news_edit' ? 'active' : ''} onClick={() => selectTask('news_edit')} aria-pressed={task === 'news_edit'}>
            <NotePencil weight="fill" />
            <b>新闻编辑</b>
            <small>粘贴一篇已有稿件</small>
            <span>得到修改后的完整成稿</span>
          </button>
        </div>
      </section>

      {task ? (
        <section className="dual-work" aria-labelledby="dual-work-title" aria-busy={loading}>
          <div className="dual-work-head">
            <div>
              <span>第 2 步</span>
              <h2 id="dual-work-title">{task === 'interview' ? '写下你要采访的主题' : currentEditAction.label}</h2>
            </div>
            <button type="button" className="dual-change-task" onClick={() => setTask(null)} disabled={loading}>重新选择</button>
          </div>

          {task === 'news_edit' ? (
            <>
              <div className="dual-actions" role="group" aria-label="编辑方式">
                {(Object.keys(actionConfig) as NewsEditAction[]).map((item) => (
                  <button key={item} type="button" className={action === item ? 'active' : ''} aria-pressed={action === item} disabled={loading} onClick={() => { setAction(item); setError(''); }}>{actionConfig[item].label}</button>
                ))}
              </div>
              <p className="dual-action-description">{currentEditAction.description}</p>
            </>
          ) : (
            <div className="dual-examples" aria-label="采访主题示例">
              <span>可直接试试</span>
              {interviewExamples.map((example) => <button key={example} type="button" disabled={loading} onClick={() => useInterviewExample(example)}>{example}</button>)}
            </div>
          )}

          <label htmlFor="source-text">{task === 'interview' ? '一句话描述你想采访的对象或事件' : currentEditAction.inputLabel}</label>
          <p id="source-help" className="dual-source-help">
            {task === 'interview'
              ? '只写你现在想到的主题即可，人物、事件和采访重点由工作台判断。'
              : '直接粘贴已有材料即可；系统只处理你提供的内容。'}
          </p>
          <textarea
            ref={inputRef}
            id="source-text"
            value={sourceText}
            onChange={(event) => updateSourceText(event.target.value)}
            onKeyDown={(event) => {
              if (event.key === 'Enter' && !event.shiftKey && !event.nativeEvent.isComposing && !loading) {
                event.preventDefault();
                void submit();
              }
            }}
            placeholder={task === 'interview' ? '例如：柯洁赢棋了，我想采访他' : currentEditAction.placeholder}
            rows={task === 'interview' ? 5 : 11}
            maxLength={sourceTextLimit}
            readOnly={loading}
            aria-describedby={`source-help${error ? ' source-error' : ''}`}
            aria-invalid={Boolean(error)}
          />
          <div className="dual-input-meta">
            <span>{sourceText.length >= 28_000 ? `还可输入 ${sourceTextLimit - sourceText.length} 字` : `${sourceText.length} 字`}</span>
            <span>Enter 生成，Shift + Enter 换行</span>
          </div>
          {error ? <p id="source-error" className="dual-error" role="alert">{error}</p> : null}
          {loading ? <p className="dual-loading-note" role="status">正在本地处理，输入内容会保留；如需修改，可以取消生成。</p> : null}
          <div className="dual-submit-row">
            <button type="button" className="dual-submit" disabled={loading} onClick={() => void submit()}>
              {loading ? <CircleNotch className="mvp-spin" weight="bold" /> : <ArrowRight weight="bold" />}
              {loading ? (task === 'interview' ? '正在生成采访提纲' : currentEditAction.loadingLabel) : task === 'interview' ? '生成采访提纲' : currentEditAction.submitLabel}
            </button>
            {loading ? <button type="button" className="dual-cancel" onClick={cancelGeneration}>取消生成</button> : null}
          </div>
          <p className="dual-boundary"><CheckCircle weight="fill" /> {task === 'interview' ? '只生成采访问题，不代替真实采访。' : '只修改你提供的材料，不补写新闻事实。'}</p>
        </section>
      ) : null}
    </main>
  );
}
