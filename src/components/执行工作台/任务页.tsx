import { useState } from 'react';
import { ArrowsDownUp, CheckCircle, Plus, WarningCircle } from '@phosphor-icons/react';
import type { ReportingTask, ReportingTaskPriority, ReportingTaskStatus } from '../../../shared/报道执行模型.js';
import { computeTaskBlockers, ExecutionPlanner } from '../../../shared/执行计划器.js';
import { WorkbenchPage, StatusChip, formatDateTime, newId } from './共享';
import type { ExecutionPageProps } from './类型';

const statuses: Array<{ value: ReportingTaskStatus; label: string }> = [
  { value: 'todo', label: '待开始' }, { value: 'in_progress', label: '进行中' }, { value: 'blocked', label: '受阻' }, { value: 'done', label: '已完成' }, { value: 'dropped', label: '已放弃' },
];
const priorities: ReportingTaskPriority[] = ['critical', 'high', 'medium', 'low'];

export function TasksPage({ brief, value, onChange }: ExecutionPageProps) {
  const [draggedId, setDraggedId] = useState('');
  const updateTask = (id: string, patch: Partial<ReportingTask>) => onChange((current) => ({
    ...current,
    tasks: current.tasks.map((task) => task.id === id ? { ...task, ...patch, updatedAt: new Date().toISOString() } : task),
    updatedAt: new Date().toISOString(),
  }));
  const reorder = (targetId: string) => {
    if (!draggedId || draggedId === targetId) return;
    onChange((current) => {
      const tasks = [...current.tasks].sort((a, b) => a.order - b.order);
      const from = tasks.findIndex((task) => task.id === draggedId);
      const to = tasks.findIndex((task) => task.id === targetId);
      if (from < 0 || to < 0) return current;
      const [moved] = tasks.splice(from, 1);
      tasks.splice(to, 0, moved!);
      return { ...current, tasks: tasks.map((task, index) => ({ ...task, order: index + 1 })), updatedAt: new Date().toISOString() };
    });
    setDraggedId('');
  };
  const replan = () => onChange((current) => ({
    ...current,
    tasks: new ExecutionPlanner().build({ brief, sourceIds: current.sources.map((source) => source.id) }),
    updatedAt: new Date().toISOString(),
  }));
  const addTask = () => {
    const timestamp = new Date().toISOString();
    onChange((current) => ({ ...current, tasks: [...current.tasks, {
      id: newId('task'), title: '自定义报道任务', description: '', type: 'custom', status: 'todo', priority: 'medium', dueAt: brief.deadline || brief.publishAt || timestamp,
      estimatedMinutes: 30, dependencyIds: [], sourceIds: [], claimIds: [], evidenceGapIds: [], completionCriteria: '由记者填写明确的完成条件。', isTodayFocus: false,
      order: current.tasks.length + 1, createdAt: timestamp, updatedAt: timestamp,
    }], updatedAt: timestamp }));
  };
  const sorted = [...value.tasks].sort((a, b) => a.order - b.order);
  return (
    <WorkbenchPage eyebrow="任务看板" title="把截止时间拆成可完成、可阻塞、可验收的任务" description="支持倒排、依赖、人工阻塞、状态和拖动排序。完成不是点一下勾选，而是满足对应完成条件。" actions={<><button className="secondary-action" type="button" onClick={replan}><ArrowsDownUp />重新倒排</button><button className="primary-action" type="button" onClick={addTask}><Plus />添加任务</button></>}>
      <div className="task-board" aria-label="报道任务列表">
        {sorted.map((task) => {
          const blockers = computeTaskBlockers(task, value.tasks);
          return (
            <article key={task.id} className="task-card" draggable onDragStart={() => setDraggedId(task.id)} onDragOver={(event) => event.preventDefault()} onDrop={() => reorder(task.id)} data-state={task.status}>
              <div className="task-card__grip"><ArrowsDownUp /><span>{String(task.order).padStart(2, '0')}</span></div>
              <div className="task-card__main">
                <input aria-label={`${task.title} 任务名称`} value={task.title} onChange={(event) => updateTask(task.id, { title: event.target.value })} />
                <p>{task.description || task.completionCriteria}</p>
                <div className="task-card__meta">
                  <StatusChip tone={task.priority === 'critical' ? 'danger' : task.priority === 'high' ? 'warn' : 'neutral'}>{task.priority}</StatusChip>
                  <span>截止 {formatDateTime(task.dueAt)}</span><span>预计 {task.estimatedMinutes} 分钟</span>
                </div>
                {blockers.length ? <div className="task-blocker"><WarningCircle />{blockers.join('；')}</div> : task.status === 'done' ? <div className="task-done"><CheckCircle />已完成</div> : null}
              </div>
              <div className="task-card__controls">
                <label>状态<select value={task.status} onChange={(event) => updateTask(task.id, { status: event.target.value as ReportingTaskStatus })}>{statuses.map((status) => <option key={status.value} value={status.value}>{status.label}</option>)}</select></label>
                <label>优先级<select value={task.priority} onChange={(event) => updateTask(task.id, { priority: event.target.value as ReportingTaskPriority })}>{priorities.map((priority) => <option key={priority}>{priority}</option>)}</select></label>
                <label>截止<input type="datetime-local" value={task.dueAt.slice(0, 16)} onChange={(event) => updateTask(task.id, { dueAt: event.target.value ? new Date(event.target.value).toISOString() : task.dueAt })} /></label>
                <label>分钟<input type="number" min="5" max="1440" value={task.estimatedMinutes} onChange={(event) => updateTask(task.id, { estimatedMinutes: Number(event.target.value) || 5 })} /></label>
                <label className="task-wide">阻塞原因<input value={task.manualBlocker || ''} onChange={(event) => updateTask(task.id, { manualBlocker: event.target.value || undefined })} placeholder="没有则留空" /></label>
                <label className="task-wide">完成条件<textarea value={task.completionCriteria} onChange={(event) => updateTask(task.id, { completionCriteria: event.target.value })} /></label>
              </div>
            </article>
          );
        })}
      </div>
    </WorkbenchPage>
  );
}
