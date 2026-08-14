import { ArrowClockwise, CheckCircle, Info, WarningCircle, XCircle } from '@phosphor-icons/react';
import { runAssignmentCheck } from '../../../shared/报道提交检查.js';
import { WorkbenchPage, StatusChip } from './共享';
import type { ExecutionPageProps } from './类型';

const iconFor = (status: 'passed' | 'warning' | 'blocking' | 'not_applicable') => {
  if (status === 'passed') return <CheckCircle weight="fill" />;
  if (status === 'blocking') return <XCircle weight="fill" />;
  if (status === 'warning') return <WarningCircle weight="fill" />;
  return <Info weight="fill" />;
};

export function AssignmentCheckPage({ brief, evidenceWorkspace, value, onChange, onNavigate }: ExecutionPageProps) {
  const run = () => onChange((current) => ({ ...current, assignmentChecks: runAssignmentCheck({ brief, workspace: current, evidenceWorkspace }), updatedAt: new Date().toISOString() }));
  const checks = value.assignmentChecks;
  const blocking = checks.filter((item) => item.status === 'blocking');
  return (
    <WorkbenchPage eyebrow="作业自查" title="把提交要求逐条变成可见门槛" description="这里不提供会掩盖硬伤的综合分数。任何 blocking 项都会保留到你补完采访、证据、归因或格式要求。" actions={<button className="primary-action" type="button" onClick={run}><ArrowClockwise />重新检查</button>}>
      <div className="check-summary" data-ready={checks.length > 0 && blocking.length === 0}><div>{checks.length ? blocking.length === 0 ? <CheckCircle weight="fill" /> : <XCircle weight="fill" /> : <Info weight="fill" />}</div><span><b>{checks.length ? blocking.length === 0 ? '没有阻断项，可以进入隐私确认与导出' : `仍有 ${blocking.length} 个提交阻断项` : '尚未执行作业检查'}</b><small>警告项可以在明确风险后继续；阻断项必须解决。</small></span>{checks.length && blocking.length === 0 ? <button type="button" onClick={() => onNavigate('export')}>进入导出中心</button> : null}</div>
      <div className="check-list">{checks.map((item) => <article key={item.id} data-status={item.status}><div className="check-icon">{iconFor(item.status)}</div><div><header><h3>{item.label}</h3><StatusChip tone={item.status === 'passed' ? 'good' : item.status === 'blocking' ? 'danger' : item.status === 'warning' ? 'warn' : 'neutral'}>{item.status}</StatusChip></header><p>{item.detail}</p>{item.action && item.status !== 'passed' ? <small>下一步：{item.action}</small> : null}</div></article>)}</div>
      {!checks.length ? <div className="execution-empty"><button type="button" onClick={run}>根据当前项目记录运行检查</button></div> : null}
    </WorkbenchPage>
  );
}
