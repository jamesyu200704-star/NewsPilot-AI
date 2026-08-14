import { ArrowRight, CalendarBlank, CheckCircle, Clock, WarningCircle } from '@phosphor-icons/react';
import { computeTaskBlockers } from '../../../shared/执行计划器.js';
import { WorkbenchPage, StatusChip, formatDateTime } from './共享';
import type { ExecutionPageProps } from './类型';

export function ProjectOverviewPage({ brief, evidenceWorkspace, value, onNavigate }: ExecutionPageProps) {
  const deadline = brief.deadline || brief.publishAt;
  const remainingMs = deadline ? Date.parse(deadline) - Date.now() : Number.NaN;
  const remainingHours = Number.isFinite(remainingMs) ? Math.max(0, Math.ceil(remainingMs / 3_600_000)) : null;
  const today = value.tasks.filter((task) => task.isTodayFocus && task.status !== 'done').slice(0, 3);
  const blockers = value.tasks.flatMap((task) => computeTaskBlockers(task, value.tasks).map((reason) => ({ task, reason })));
  const criticalInterviews = value.sessions.filter((session) => session.status !== 'completed').length;
  const unverifiedCritical = evidenceWorkspace.claims.filter((claim) => claim.importance === 'critical' && claim.verificationStatus !== 'verified').length;
  const completed = value.tasks.filter((task) => task.status === 'done').length;
  return (
    <WorkbenchPage eyebrow="项目概览" title="先处理最影响交付的三件事" description="概览只呈现截止时间、今日重点、阻塞项、关键采访和关键主张，不用信息洪流掩盖风险。">
      <div className="overview-metrics">
        <article><CalendarBlank /><span>交付时间</span><b>{formatDateTime(deadline)}</b><small>{remainingHours === null ? '请补充截止时间' : `剩余约 ${remainingHours} 小时`}</small></article>
        <article><CheckCircle /><span>任务进度</span><b>{completed}/{value.tasks.length}</b><small>仅完成满足验收条件的任务</small></article>
        <article><Clock /><span>未完成采访</span><b>{criticalInterviews}</b><small>需通过同意、笔记和复盘门槛</small></article>
        <article data-alert={unverifiedCritical > 0}><WarningCircle /><span>未核实关键主张</span><b>{unverifiedCritical}</b><small>不能进入已支撑结论</small></article>
      </div>
      <div className="overview-columns">
        <article className="execution-panel">
          <header><div><span className="section-number">01</span><h3>今日三件事</h3></div><button type="button" onClick={() => onNavigate('tasks')}>全部任务 <ArrowRight /></button></header>
          <ol className="today-list">
            {today.length ? today.map((task) => <li key={task.id}><StatusChip tone={task.priority === 'critical' ? 'danger' : 'warn'}>{task.priority}</StatusChip><div><b>{task.title}</b><p>{task.completionCriteria}</p></div></li>) : <li><div><b>今日重点已处理</b><p>可进入提纲或提交检查。</p></div></li>}
          </ol>
        </article>
        <article className="execution-panel">
          <header><div><span className="section-number">02</span><h3>当前阻塞</h3></div></header>
          {blockers.length ? <ul className="blocker-list">{blockers.slice(0, 5).map(({ task, reason }) => <li key={`${task.id}-${reason}`}><WarningCircle /><div><b>{task.title}</b><p>{reason}</p></div></li>)}</ul> : <div className="execution-empty">没有已记录阻塞项。仍请核对外部采访与证据依赖。</div>}
        </article>
      </div>
      <div className="overview-next">
        <button type="button" onClick={() => onNavigate(criticalInterviews ? 'sources' : 'evidence')}>
          <span>建议下一步</span><b>{criticalInterviews ? '推进关键采访对象' : '关闭关键证据缺口'}</b><ArrowRight />
        </button>
      </div>
    </WorkbenchPage>
  );
}
