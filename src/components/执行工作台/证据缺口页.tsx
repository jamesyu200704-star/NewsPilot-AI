import type { ReactNode } from 'react';
import { ArrowClockwise, CheckCircle, WarningDiamond } from '@phosphor-icons/react';
import type { EvidenceGap } from '../../../shared/报道执行模型.js';
import { createEvidenceGapTasks } from '../../../shared/采访证据处理.js';
import { deriveEvidenceGaps } from '../../../shared/报道执行流程.js';
import { WorkbenchPage, StatusChip } from './共享';
import type { ExecutionPageProps } from './类型';

export function EvidenceGapPage(props: ExecutionPageProps & { evidencePanel: ReactNode }) {
  const derive = () => props.onChange((current) => {
    const generated = deriveEvidenceGaps({ evidenceWorkspace: props.evidenceWorkspace, executionWorkspace: current });
    const previous = new Map(current.evidenceGaps.map((gap) => [`${gap.type}:${gap.claimIds.join('|')}:${gap.description}`, gap]));
    const gaps = generated.map((gap) => previous.get(`${gap.type}:${gap.claimIds.join('|')}:${gap.description}`) || gap);
    const tasks = createEvidenceGapTasks(gaps).filter((task) => !current.tasks.some((item) => item.id === task.id));
    return { ...current, evidenceGaps: gaps, tasks: [...current.tasks, ...tasks], updatedAt: new Date().toISOString() };
  });
  const updateGap = (id: string, patch: Partial<EvidenceGap>) => props.onChange((current) => ({ ...current, evidenceGaps: current.evidenceGaps.map((gap) => gap.id === id ? { ...gap, ...patch, updatedAt: new Date().toISOString() } : gap), updatedAt: new Date().toISOString() }));
  return (
    <WorkbenchPage eyebrow="证据工作区" title="把采访发现变成明确的证据缺口和核验动作" description="采访陈述保持归因且未核实。原始文件、当事方回应、对立观点、数据、独立佐证、口径冲突与匿名风险都必须显式关闭、接受风险或放弃。" actions={<button className="primary-action" type="button" onClick={derive}><ArrowClockwise />重新分析缺口</button>}>
      <section className="gap-board"><header><div><span>GAP CLOSURE</span><h3>待关闭缺口</h3></div><p>{props.value.evidenceGaps.filter((gap) => gap.status === 'open' || gap.status === 'in_progress').length} 项开放</p></header>{props.value.evidenceGaps.length ? <div className="gap-grid">{props.value.evidenceGaps.map((gap) => <article key={gap.id} data-status={gap.status}><div><WarningDiamond /><span><b>{gap.type}</b><small>{gap.claimIds.join('、') || gap.sourceIds?.join('、') || '项目级'}</small></span><StatusChip tone={gap.status === 'resolved' ? 'good' : gap.status === 'accepted_risk' ? 'warn' : 'danger'}>{gap.status}</StatusChip></div><textarea value={gap.description} onChange={(event) => updateGap(gap.id, { description: event.target.value })} /><label>必须执行的动作<textarea value={gap.requiredAction} onChange={(event) => updateGap(gap.id, { requiredAction: event.target.value })} /></label><label>处理状态<select value={gap.status} onChange={(event) => updateGap(gap.id, { status: event.target.value as EvidenceGap['status'] })}><option value="open">open</option><option value="in_progress">in_progress</option><option value="resolved">resolved</option><option value="accepted_risk">accepted_risk</option><option value="dropped">dropped</option></select></label>{gap.status === 'resolved' || gap.status === 'accepted_risk' || gap.status === 'dropped' ? <label>处理说明<textarea value={gap.resolutionNote || ''} onChange={(event) => updateGap(gap.id, { resolutionNote: event.target.value })} placeholder="说明用什么证据解决，或为何接受风险/放弃" /></label> : null}</article>)}</div> : <div className="execution-empty"><CheckCircle />点击“重新分析缺口”，根据当前主张、采访、引语和冲突生成核验任务。</div>}</section>
      <div className="embedded-evidence-workbench">{props.evidencePanel}</div>
    </WorkbenchPage>
  );
}
