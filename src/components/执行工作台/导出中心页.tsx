import { useState } from 'react';
import { DownloadSimple, FileArchive, FileCsv, FileDoc, FileMd, LockKey, ShieldCheck } from '@phosphor-icons/react';
import type { ExportMode } from '../../../shared/报道执行模型.js';
import { redactExecutionWorkspace } from '../../../shared/报道执行工作区.js';
import { createInterviewSummary } from '../../../shared/报道执行流程.js';
import { runAssignmentCheck } from '../../../shared/报道提交检查.js';
import type { ExportPrivacyConfirmation } from '../../../shared/报道导出.js';
import { WorkbenchPage, downloadFile } from './共享';
import type { ExecutionPageProps } from './类型';

const initialConfirmation: ExportPrivacyConfirmation = { noPrivateContacts: false, noAnonymousIdentity: false, noOffRecord: false, noUnconfirmedQuotes: false, noAudioOrFullTranscript: false, userConfirmed: false };
const loadExportTools = () => import('../../../shared/报道导出.js');
const modes: Array<{ value: ExportMode; label: string; description: string }> = [
  { value: 'course_submission', label: '课程提交', description: '排除私密与未确认材料，适合交作业。' },
  { value: 'redacted_share', label: '脱敏分享', description: '隐藏联系方式、匿名真实身份和私密笔记。' },
  { value: 'open_demo', label: '公开演示', description: '只保留公开标签和方法流程。' },
  { value: 'full_private_backup', label: '完整私密备份', description: '仅用于本机备份，不得公开上传。' },
];

const markdownFile = (content: string, name: string) => downloadFile(content, name, 'text/markdown;charset=utf-8');
const byteBuffer = (value: Uint8Array) => {
  const copied = new Uint8Array(value.byteLength);
  copied.set(value);
  return copied.buffer;
};

export function ExportCenterPage({ projectName, brief, plan, evidenceWorkspace, value }: ExecutionPageProps) {
  const [mode, setMode] = useState<ExportMode>('course_submission');
  const [confirmation, setConfirmation] = useState(initialConfirmation);
  const [busy, setBusy] = useState('');
  const [notice, setNotice] = useState('');
  const confirmed = Object.values(confirmation).every(Boolean);
  const currentChecks = runAssignmentCheck({ brief, workspace: value, evidenceWorkspace });
  const blocking = currentChecks.filter((item) => item.status === 'blocking').length;
  const safeName = (projectName.trim() || 'NewsPilot-报道项目').replace(/[\\/:*?"<>|]/gu, '-');
  const safeMode = mode === 'full_private_backup' ? 'course_submission' : mode;
  const publicWorkspace = redactExecutionWorkspace(
    { ...value, assignmentChecks: currentChecks },
    safeMode,
  );
  const requirePrivacy = () => {
    if (!confirmed) { setNotice('请先逐项确认隐私检查清单。'); return false; }
    return true;
  };
  const run = async (id: string, action: () => Promise<void> | void, requireNoBlock = false) => {
    if (!requirePrivacy()) return;
    if (requireNoBlock && mode === 'course_submission' && blocking > 0) { setNotice(`课程提交仍有 ${blocking} 个 blocking 项，请先处理。`); return; }
    setBusy(id); setNotice('');
    try { await action(); setNotice('文件已生成。请在下载目录检查能否正常打开。'); }
    catch (error) { setNotice(error instanceof Error ? error.message : '导出失败。'); }
    finally { setBusy(''); }
  };
  const exportCards = [
    { id: 'plan', icon: <FileMd />, title: '报道策划案', format: 'Markdown', description: '核心问题、判断、今日任务、采访进度与关键缺口。', action: async () => { const { buildReportingPlanMarkdown } = await loadExportTools(); markdownFile(buildReportingPlanMarkdown({ projectName, brief, plan, workspace: publicWorkspace }), `${safeName}-报道策划案.md`); } },
    { id: 'sources', icon: <FileMd />, title: '信源地图', format: 'Markdown', description: '公开称呼、角色、状态、信息价值、下一步和归因边界。', action: () => markdownFile([`# ${projectName}｜信源地图`, '', ...publicWorkspace.sources.map((source) => `## ${source.publicLabel || source.role}\n\n- 角色：${source.role}\n- 状态：${source.status}\n- 信息价值：${source.informationValue}\n- 归因：${source.attribution.mode}\n- 下一步：${source.nextAction}`)].join('\n'), `${safeName}-信源地图.md`) },
    { id: 'guide', icon: <FileDoc />, title: '分信源采访提纲', format: 'DOCX', description: '每个问题绑定目的、预期证据、主张或缺口。', action: async () => { const { buildInterviewGuideDocx } = await loadExportTools(); const bytes = await buildInterviewGuideDocx({ projectName, brief, workspace: publicWorkspace, mode: safeMode }); downloadFile(byteBuffer(bytes), `${safeName}-采访提纲.docx`, 'application/vnd.openxmlformats-officedocument.wordprocessingml.document'); } },
    { id: 'execution', icon: <FileMd />, title: '执行计划', format: 'Markdown', description: '截止时间、依赖、阻塞、完成条件与任务状态。', action: () => markdownFile([`# ${projectName}｜执行计划`, '', ...publicWorkspace.tasks.sort((a, b) => a.order - b.order).map((task) => `- [${task.status === 'done' ? 'x' : ' '}] ${task.title}｜${task.status}｜${task.dueAt}\n  - 完成条件：${task.completionCriteria}\n  - 依赖：${task.dependencyIds.join('、') || '无'}\n  - 阻塞：${task.manualBlocker || '无'}`)].join('\n'), `${safeName}-执行计划.md`) },
    { id: 'evidence', icon: <FileCsv />, title: '证据矩阵', format: 'CSV', description: '主张、状态、支持/反驳证据与剩余工作。', action: async () => { const { buildEvidenceMatrixCsv } = await loadExportTools(); downloadFile(buildEvidenceMatrixCsv(evidenceWorkspace), `${safeName}-证据矩阵.csv`, 'text/csv;charset=utf-8'); } },
    { id: 'outline', icon: <FileDoc />, title: '报道提纲', format: 'DOCX', description: '段落目的、证据、确认引语、缺口与支撑状态。', action: async () => { const { buildOutlineDocx } = await loadExportTools(); const bytes = await buildOutlineDocx({ projectName, workspace: publicWorkspace, mode: safeMode }); downloadFile(byteBuffer(bytes), `${safeName}-报道提纲.docx`, 'application/vnd.openxmlformats-officedocument.wordprocessingml.document'); } },
    { id: 'check', icon: <FileMd />, title: '作业自查表', format: 'Markdown', description: '逐条保留 passed、warning、blocking 和下一步。', action: () => markdownFile([`# ${projectName}｜作业自查`, '', ...publicWorkspace.assignmentChecks.map((item) => `- [${item.status === 'passed' ? 'x' : ' '}] **${item.label}**｜${item.status}\n  - ${item.detail}${item.action ? `\n  - 下一步：${item.action}` : ''}`)].join('\n'), `${safeName}-作业自查.md`) },
    { id: 'summary', icon: <FileMd />, title: '采访总结', format: 'Markdown', description: '只根据真实采访记录整理，不补写回答或事实。', action: () => markdownFile(publicWorkspace.sources.map((source) => createInterviewSummary(publicWorkspace, source.id)).join('\n\n---\n\n'), `${safeName}-采访总结.md`) },
    { id: 'package', icon: <FileArchive />, title: '完整提交包', format: 'ZIP', description: '规定的六个文件；不含音频、完整转写、私密联系和环境配置。', requireNoBlock: true, action: async () => { const { buildReportingExportPackage } = await loadExportTools(); const bytes = await buildReportingExportPackage({ projectName, brief, plan, workspace: publicWorkspace, evidenceWorkspace, mode: safeMode, privacyConfirmation: confirmation }); downloadFile(byteBuffer(bytes), `${safeName}-课程提交包.zip`, 'application/zip'); } },
  ];
  const privateBackup = () => {
    if (!globalThis.confirm('私密备份会包含真实身份、联系方式、私密笔记和完整本地记录。只保存在你控制的本机位置，不得公开上传。是否继续？')) return;
    downloadFile(JSON.stringify({ format: 'newspilot-private-execution-backup', schemaVersion: 1, projectName, brief, executionWorkspace: value, evidenceWorkspace, exportedAt: new Date().toISOString() }, null, 2), `${safeName}-私密备份.json`, 'application/json;charset=utf-8');
  };
  return (
    <WorkbenchPage eyebrow="导出中心" title="按用途导出，而不是把整个浏览器项目一股脑交出去" description="核心九类交付文件默认脱敏。私密备份是独立、本机专用操作；课程提交包有 blocking 项时不会生成。">
      <div className="export-mode-grid">{modes.map((item) => <button type="button" key={item.value} data-active={mode === item.value} onClick={() => setMode(item.value)}><span>{item.value === 'full_private_backup' ? <LockKey /> : <ShieldCheck />}</span><b>{item.label}</b><small>{item.description}</small></button>)}</div>
      {mode === 'full_private_backup' ? <section className="private-backup-warning"><LockKey /><div><h3>完整私密备份不属于公开提交材料</h3><p>它可能包含真实身份、联系方式和私密采访记录。请只保存在你控制的加密磁盘或安全目录。</p></div><button type="button" onClick={privateBackup}>导出本机私密 JSON</button></section> : null}
      <section className="privacy-checklist"><header><ShieldCheck /><div><h3>导出前隐私确认</h3><p>这些勾选是显式责任确认，不会用默认勾选替你做判断。</p></div></header><div>{([
        ['noPrivateContacts', '导出不含电话号码、微信、邮箱等私密联系方式'], ['noAnonymousIdentity', '匿名信源真实身份已移除'], ['noOffRecord', 'off-record 与私密笔记不会导出'], ['noUnconfirmedQuotes', '未复核或归因未确认的引语不会导出'], ['noAudioOrFullTranscript', '不导出音频与完整转写'], ['userConfirmed', '我已人工检查导出用途、内容和文件名'],
      ] as const).map(([key, label]) => <label key={key}><input type="checkbox" checked={confirmation[key]} onChange={(event) => setConfirmation((current) => ({ ...current, [key]: event.target.checked }))} /><span>{label}</span></label>)}</div></section>
      {notice ? <div className="export-notice" role="status">{notice}</div> : null}
      <div className="export-card-grid">{exportCards.map((card) => <article key={card.id}><div className="export-card__icon">{card.icon}</div><span>{card.format}</span><h3>{card.title}</h3><p>{card.description}</p><button type="button" disabled={Boolean(busy) || !confirmed} onClick={() => void run(card.id, card.action, card.requireNoBlock)}>{busy === card.id ? '生成中…' : <><DownloadSimple />生成并下载</>}</button></article>)}</div>
    </WorkbenchPage>
  );
}
