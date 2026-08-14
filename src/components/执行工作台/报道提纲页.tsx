import { LinkSimple, Plus, WarningCircle } from '@phosphor-icons/react';
import type { StoryOutline, StoryOutlineSection, StoryStructureType } from '../../../shared/报道执行模型.js';
import { createEvidenceBackedOutline } from '../../../shared/报道执行流程.js';
import { evaluateOutlineSupport } from '../../../shared/报道提交检查.js';
import { WorkbenchPage, StatusChip, newId } from './共享';
import type { ExecutionPageProps } from './类型';

const structureOptions: Array<{ value: StoryStructureType; label: string }> = [
  { value: 'profile', label: '人物特稿' }, { value: 'campus_phenomenon', label: '校园现象' }, { value: 'policy_implementation', label: '政策执行' }, { value: 'data_investigation', label: '数据调查' }, { value: 'hard_news', label: '硬新闻' }, { value: 'change_story', label: '变化报道' },
];

export function StoryOutlinePage({ plan, evidenceWorkspace, value, onChange }: ExecutionPageProps) {
  const outline = value.outlines[0];
  const generate = (structureType?: StoryStructureType) => onChange((current) => ({ ...current, outlines: [createEvidenceBackedOutline({ plan, evidenceWorkspace, executionWorkspace: current, structureType })], updatedAt: new Date().toISOString() }));
  const updateOutline = (patch: Partial<StoryOutline>) => onChange((current) => ({ ...current, outlines: current.outlines.length ? current.outlines.map((item, index) => index === 0 ? { ...item, ...patch, updatedAt: new Date().toISOString() } : item) : [createEvidenceBackedOutline({ plan, evidenceWorkspace, executionWorkspace: current })], updatedAt: new Date().toISOString() }));
  const updateSection = (id: string, patch: Partial<StoryOutlineSection>) => onChange((current) => ({ ...current, outlines: current.outlines.map((item, index) => index === 0 ? { ...item, sections: item.sections.map((section) => {
    if (section.id !== id) return section;
    const next = { ...section, ...patch };
    const assessment = evaluateOutlineSupport({ section: next, claims: evidenceWorkspace.claims, evidence: evidenceWorkspace.evidence, quotes: current.quotes, conflicts: evidenceWorkspace.conflicts });
    return { ...next, supportStatus: assessment.status };
  }), updatedAt: new Date().toISOString() } : item), updatedAt: new Date().toISOString() }));
  const addSection = () => {
    if (!outline) { generate(); return; }
    updateOutline({ sections: [...outline.sections, { id: newId('outline-section'), title: '新段落', purpose: '说明这一节要回答什么新闻问题。', materialIds: [], claimIds: [], quoteIds: [], evidenceIds: [], gapIds: [], draftNotes: '', supportStatus: 'unsupported', order: outline.sections.length + 1 }] });
  };
  return (
    <WorkbenchPage eyebrow="报道提纲" title="先搭证据骨架，再进入写作" description="每一节都回答：为什么存在、用什么材料、哪些证据已确认、哪些引语可用、还缺什么。无支撑内容显示红色；假设不会变成结论。" actions={<><select aria-label="报道结构" value={outline?.structureType || 'campus_phenomenon'} onChange={(event) => generate(event.target.value as StoryStructureType)}>{structureOptions.map((option) => <option key={option.value} value={option.value}>{option.label}</option>)}</select><button className="secondary-action" type="button" onClick={() => generate(outline?.structureType)}>按证据重建</button><button className="primary-action" type="button" onClick={addSection}><Plus />添加段落</button></>}>
      {outline ? <div className="outline-editor"><div className="outline-title"><label>工作标题<input value={outline.workingTitle} onChange={(event) => updateOutline({ workingTitle: event.target.value })} /></label><label>核心新闻问题<textarea value={outline.centralQuestion} onChange={(event) => updateOutline({ centralQuestion: event.target.value })} /></label></div><div className="outline-sections">{[...outline.sections].sort((a, b) => a.order - b.order).map((section, index) => {
        const assessment = evaluateOutlineSupport({ section, claims: evidenceWorkspace.claims, evidence: evidenceWorkspace.evidence, quotes: value.quotes, conflicts: evidenceWorkspace.conflicts });
        return <article key={section.id} data-support={assessment.status}><div className="outline-section__rail"><span>{String(index + 1).padStart(2, '0')}</span><i /></div><div className="outline-section__body"><header><input aria-label={`第 ${index + 1} 节标题`} value={section.title} onChange={(event) => updateSection(section.id, { title: event.target.value })} /><StatusChip tone={assessment.status === 'supported' ? 'good' : assessment.status === 'partial' ? 'warn' : 'danger'}>{assessment.status}</StatusChip></header><label>本节目的<textarea value={section.purpose} onChange={(event) => updateSection(section.id, { purpose: event.target.value })} /></label><div className="outline-bind-grid"><label><LinkSimple />主张<select value={section.claimIds[0] || ''} onChange={(event) => updateSection(section.id, { claimIds: event.target.value ? [event.target.value] : [] })}><option value="">未绑定</option>{evidenceWorkspace.claims.map((claim) => <option key={claim.id} value={claim.id}>{claim.id} · {claim.text.slice(0, 30)}</option>)}</select></label><label><LinkSimple />证据<select value={section.evidenceIds[0] || ''} onChange={(event) => updateSection(section.id, { evidenceIds: event.target.value ? [event.target.value] : [] })}><option value="">未绑定</option>{evidenceWorkspace.evidence.filter((item) => item.userConfirmed).map((item) => <option key={item.id} value={item.id}>{item.id} · {item.excerpt.slice(0, 26)}</option>)}</select></label><label><LinkSimple />已确认引语<select value={section.quoteIds[0] || ''} onChange={(event) => updateSection(section.id, { quoteIds: event.target.value ? [event.target.value] : [] })}><option value="">未绑定</option>{value.quotes.filter((quote) => quote.reviewStatus === 'confirmed' && !quote.isOffRecord && !quote.isPrivate).map((quote) => <option key={quote.id} value={quote.id}>{quote.id} · {quote.text.slice(0, 24)}</option>)}</select></label><label><LinkSimple />剩余缺口<select value={section.gapIds[0] || ''} onChange={(event) => updateSection(section.id, { gapIds: event.target.value ? [event.target.value] : [] })}><option value="">无</option>{value.evidenceGaps.filter((gap) => gap.status === 'open' || gap.status === 'in_progress').map((gap) => <option key={gap.id} value={gap.id}>{gap.type} · {gap.description.slice(0, 26)}</option>)}</select></label></div><label>写作提示（不是正文）<textarea value={section.draftNotes} onChange={(event) => updateSection(section.id, { draftNotes: event.target.value })} placeholder="记录本节需要如何组织已确认材料，不生成新闻正文。" /></label>{assessment.reasons.length ? <div className="outline-warning"><WarningCircle />{assessment.reasons.join('；')}</div> : null}</div></article>;
      })}</div></div> : <div className="execution-empty"><button type="button" onClick={() => generate()}>建立第一版证据提纲</button></div>}
    </WorkbenchPage>
  );
}
