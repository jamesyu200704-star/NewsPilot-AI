import { useEffect, useState } from 'react';
import { Archive, CalendarCheck, CheckSquare, ClipboardText, FileDoc, ListChecks, MicrophoneStage, Path, UsersThree } from '@phosphor-icons/react';
import { createExecutionWorkspaceFromPlan } from '../../shared/报道执行工作区.js';
import { ProjectOverviewPage } from './执行工作台/项目概览页';
import { TasksPage } from './执行工作台/任务页';
import { SourcesPage } from './执行工作台/采访对象页';
import { InterviewGuidePage } from './执行工作台/采访提纲页';
import { InterviewRecordsPage } from './执行工作台/采访记录页';
import { EvidenceGapPage } from './执行工作台/证据缺口页';
import { StoryOutlinePage } from './执行工作台/报道提纲页';
import { AssignmentCheckPage } from './执行工作台/作业检查页';
import { ExportCenterPage } from './执行工作台/导出中心页';
import type { ExecutionPage, ReportingExecutionWorkbenchProps } from './执行工作台/类型';

const pages = [
  { id: 'overview', label: '概览', caption: '今天与阻塞', icon: CalendarCheck },
  { id: 'tasks', label: '任务', caption: '倒排与依赖', icon: ListChecks },
  { id: 'sources', label: '采访对象', caption: '联系与归因', icon: UsersThree },
  { id: 'guide', label: '采访提纲', caption: '问题与证据', icon: ClipboardText },
  { id: 'records', label: '采访记录', caption: '笔记与转写', icon: MicrophoneStage },
  { id: 'evidence', label: '证据', caption: '缺口与核验', icon: Archive },
  { id: 'outline', label: '报道结构', caption: '证据骨架', icon: Path },
  { id: 'check', label: '作业自查', caption: '提交门槛', icon: CheckSquare },
  { id: 'export', label: '导出', caption: 'DOCX 与包', icon: FileDoc },
] as const;

export function ReportingExecutionWorkbench(props: ReportingExecutionWorkbenchProps) {
  const [page, setPage] = useState<ExecutionPage>('overview');
  useEffect(() => {
    if (props.value.sources.length || props.value.tasks.length) return;
    props.onChange(createExecutionWorkspaceFromPlan(props.plan));
  }, [props.onChange, props.plan, props.value.sources.length, props.value.tasks.length]);
  const pageProps = { ...props, onNavigate: setPage };
  return (
    <section className="execution-workbench" aria-label="NewsPilot 报道执行工作台">
      <header className="execution-workbench__masthead">
        <div><span>P2 · REPORTING EXECUTION</span><h2>从策划方案，进入真实采访与提交闭环</h2><p>这里不生成受访者回答或完整新闻稿；所有进展来自你的任务、联系、采访、材料与人工确认。</p></div>
        <div className="execution-workbench__boundary"><b>LOCAL FIRST</b><span>项目保存在当前浏览器</span></div>
      </header>
      <nav className="execution-nav" aria-label="执行工作台页面">{pages.map((item, index) => { const Icon = item.icon; return <button type="button" key={item.id} data-current={page === item.id} aria-current={page === item.id ? 'page' : undefined} onClick={() => setPage(item.id)}><span className="execution-nav__number">{String(index + 1).padStart(2, '0')}</span><Icon weight={page === item.id ? 'fill' : 'regular'} /><span><b>{item.label}</b><small>{item.caption}</small></span></button>; })}</nav>
      <div className="execution-workbench__page">
        {page === 'overview' ? <ProjectOverviewPage {...pageProps} /> : null}
        {page === 'tasks' ? <TasksPage {...pageProps} /> : null}
        {page === 'sources' ? <SourcesPage {...pageProps} /> : null}
        {page === 'guide' ? <InterviewGuidePage {...pageProps} /> : null}
        {page === 'records' ? <InterviewRecordsPage {...pageProps} /> : null}
        {page === 'evidence' ? <EvidenceGapPage {...pageProps} evidencePanel={props.evidencePanel} /> : null}
        {page === 'outline' ? <StoryOutlinePage {...pageProps} /> : null}
        {page === 'check' ? <AssignmentCheckPage {...pageProps} /> : null}
        {page === 'export' ? <ExportCenterPage {...pageProps} /> : null}
      </div>
    </section>
  );
}
