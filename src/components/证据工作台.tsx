import { useEffect, useMemo, useState } from 'react';
import {
  ArrowSquareOut,
  Check,
  DownloadSimple,
  FileArrowUp,
  FileMagnifyingGlass,
  LinkSimple,
  Plus,
  ShieldWarning,
  Trash,
  X,
} from '@phosphor-icons/react';
import type { ReportingBrief } from '../types';
import type {
  Claim,
  ClaimImportance,
  ClaimType,
  CredibilityTier,
  EvidenceItem,
  EvidenceWorkspaceState,
  SearchQuery,
  SourceRecord,
  SourceType,
} from '../../shared/证据领域模型.js';
import { createClaimsFromBrief, createSearchPlan } from '../../shared/证据工作流.js';
import { groupIndependentSources } from '../../shared/来源去重.js';
import { canonicalizeSourceUrl } from '../../shared/来源去重.js';
import { overrideSourceClassification } from '../../shared/来源分类.js';
import { buildP1ClaimEvidenceMatrix, linkEvidenceToClaims } from '../../shared/核验规则.js';
import { detectEvidenceConflicts } from '../../shared/冲突检测.js';
import { buildEvidenceMarkdown, buildEvidenceWorkspaceJson } from '../../shared/证据导出.js';
import { parseUploadedMaterial } from '../services/材料解析';
import {
  fetchEvidencePage,
  searchEvidence,
  type EvidenceSearchCandidate,
} from '../services/证据API';

interface EvidenceWorkbenchProps {
  projectId: string;
  projectName: string;
  brief: ReportingBrief;
  value: EvidenceWorkspaceState;
  demoMode: boolean;
  onChange: (value: EvidenceWorkspaceState) => void;
}

type Tab = 'claims' | 'sources' | 'verification';
const sourceTypes: SourceType[] = ['primary_document', 'official_statement', 'official_data', 'academic_source', 'news_report', 'interview_material', 'user_material', 'social_post', 'commercial_content', 'repost', 'unknown'];
const tiers: CredibilityTier[] = ['A', 'B', 'C', 'lead_only', 'unrated'];
const claimTypes: ClaimType[] = ['fact', 'opinion', 'hypothesis', 'allegation', 'prediction', 'statistic'];
const importAccept = '.txt,.md,.markdown,.pdf,.docx,.csv,.json';
const positiveEnvNumber = (value: string | undefined, fallback: number) => {
  const parsed = Number(value);
  return Number.isFinite(parsed) && parsed > 0 ? parsed : fallback;
};
const uploadMaxFileBytes = positiveEnvNumber(import.meta.env.VITE_UPLOAD_MAX_FILE_MB, 10) * 1024 * 1024;
const uploadMaxProjectBytes = positiveEnvNumber(import.meta.env.VITE_UPLOAD_MAX_PROJECT_MB, 50) * 1024 * 1024;

const createInitialWorkspace = (
  projectId: string,
  brief: ReportingBrief,
  value: EvidenceWorkspaceState,
) => {
  if (value.claims.length && value.searchPlan) return value;
  const claims = value.claims.length ? value.claims : createClaimsFromBrief(brief);
  return {
    ...value,
    claims,
    searchPlan: value.searchPlan || createSearchPlan(projectId, brief, claims),
    updatedAt: new Date().toISOString(),
  };
};

const reconcileWorkspace = (value: EvidenceWorkspaceState): EvidenceWorkspaceState => {
  const sources = groupIndependentSources(value.sources);
  const sourcesWithLinks = sources.map((source) => ({
    ...source,
    supportsClaimIds: [...new Set(value.evidence.filter((item) => item.sourceId === source.id && item.relation === 'supports').flatMap((item) => item.claimIds))],
    contradictsClaimIds: [...new Set(value.evidence.filter((item) => item.sourceId === source.id && item.relation === 'contradicts').flatMap((item) => item.claimIds))],
  }));
  const claimsWithEvidence = linkEvidenceToClaims(value.claims, sourcesWithLinks, value.evidence);
  const claimEvidenceMatrix = buildP1ClaimEvidenceMatrix(claimsWithEvidence, sourcesWithLinks, value.evidence);
  const rowByClaim = new Map(claimEvidenceMatrix.map((row) => [row.claimId, row]));
  const claims = claimsWithEvidence.map((claim) => ({
    ...claim,
    verificationStatus: rowByClaim.get(claim.id)?.verificationStatus || 'unverified',
    updatedAt: new Date().toISOString(),
  }));
  return {
    ...value,
    sources: sourcesWithLinks,
    claims,
    claimEvidenceMatrix,
    conflicts: detectEvidenceConflicts(claims, sourcesWithLinks, value.evidence),
    updatedAt: new Date().toISOString(),
  };
};

const nextId = (prefix: string, ids: string[]) => {
  const greatest = ids.reduce((max, id) => {
    const value = Number(id.match(/(\d+)$/u)?.[1]);
    return Number.isFinite(value) ? Math.max(max, value) : max;
  }, 0);
  return `${prefix}-${String(greatest + 1).padStart(3, '0')}`;
};

const downloadText = (content: string, fileName: string, type: string) => {
  const url = URL.createObjectURL(new Blob([content], { type }));
  const anchor = document.createElement('a');
  anchor.href = url;
  anchor.download = fileName;
  anchor.click();
  URL.revokeObjectURL(url);
};

const makeEvidenceFromText = (sourceId: string, text: string): EvidenceItem[] => {
  const now = new Date().toISOString();
  const paragraphs = text.split(/\n{2,}|(?<=[。！？!?])\s+/u).map((item) => item.trim()).filter((item) => item.length >= 4);
  return paragraphs.slice(0, 12).map((excerpt, index) => ({
    id: `${sourceId}-E-${String(index + 1).padStart(3, '0')}`,
    sourceId,
    excerpt: excerpt.slice(0, 800),
    normalizedMeaning: excerpt.slice(0, 400),
    location: { paragraphIndex: index },
    relation: 'context',
    claimIds: [],
    directness: 'interpretive',
    userConfirmed: false,
    createdAt: now,
  }));
};

export function EvidenceWorkbench({ projectId, projectName, brief, value, demoMode, onChange }: EvidenceWorkbenchProps) {
  const [workspace, setWorkspace] = useState(() => reconcileWorkspace(createInitialWorkspace(projectId, brief, value)));
  const [activeTab, setActiveTab] = useState<Tab>('claims');
  const [searchResults, setSearchResults] = useState<Record<string, EvidenceSearchCandidate[]>>({});
  const [notice, setNotice] = useState('');
  const [busyQuery, setBusyQuery] = useState('');
  const [manualOpen, setManualOpen] = useState(false);
  const [manual, setManual] = useState({ title: '', publisher: '', url: '', text: '' });
  const [classificationReasons, setClassificationReasons] = useState<Record<string, string>>({});
  const [classificationDrafts, setClassificationDrafts] = useState<Record<string, { sourceType: SourceType; credibilityTier: CredibilityTier }>>({});
  const [drawerEvidenceId, setDrawerEvidenceId] = useState('');

  useEffect(() => {
    const initial = reconcileWorkspace(createInitialWorkspace(projectId, brief, value));
    setWorkspace(initial);
    onChange(initial);
    // 只在切换本地项目时重新装载，避免父组件自动保存造成编辑回退。
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [projectId]);

  const commit = (update: (current: EvidenceWorkspaceState) => EvidenceWorkspaceState) => {
    setWorkspace((current) => {
      const next = reconcileWorkspace(update(current));
      onChange(next);
      return next;
    });
  };

  const selectedEvidence = workspace.evidence.find((item) => item.id === drawerEvidenceId);
  const selectedSource = selectedEvidence ? workspace.sources.find((item) => item.id === selectedEvidence.sourceId) : undefined;
  const matrixByClaim = useMemo(() => new Map(workspace.claimEvidenceMatrix.map((row) => [row.claimId, row])), [workspace.claimEvidenceMatrix]);

  const updateClaim = (claimId: string, patch: Partial<Claim>) => commit((current) => ({
    ...current,
    claims: current.claims.map((claim) => claim.id === claimId ? { ...claim, ...patch } : claim),
  }));

  const addClaim = () => {
    const now = new Date().toISOString();
    commit((current) => ({ ...current, claims: [...current.claims, {
      id: nextId('C', current.claims.map((item) => item.id)),
      text: '新的待验证主张', type: 'hypothesis', importance: 'major', source: 'user_input',
      isUserConfirmed: false, evidenceIds: [], verificationStatus: 'unverified',
      missingEvidence: ['请补充原始文件、直接采访或独立可靠来源。'], createdAt: now, updatedAt: now,
    }] }));
  };

  const deleteClaim = (claimId: string) => commit((current) => ({
    ...current,
    claims: current.claims.filter((claim) => claim.id !== claimId),
    evidence: current.evidence.map((item) => ({ ...item, claimIds: item.claimIds.filter((id) => id !== claimId) })),
    searchPlan: current.searchPlan ? { ...current.searchPlan, queries: current.searchPlan.queries.map((query) => ({ ...query, claimIds: query.claimIds.filter((id) => id !== claimId) })).filter((query) => query.claimIds.length) } : null,
  }));

  const mergeWithPrevious = (index: number) => commit((current) => {
    const target = current.claims[index - 1];
    const removed = current.claims[index];
    if (!target || !removed) return current;
    const claims = current.claims.filter((_, claimIndex) => claimIndex !== index).map((claim) => claim.id === target.id ? {
      ...claim,
      text: `${claim.text}；${removed.text}`,
      missingEvidence: [...new Set([...claim.missingEvidence, ...removed.missingEvidence])],
    } : claim);
    const evidence = current.evidence.map((item) => ({ ...item, claimIds: [...new Set(item.claimIds.map((id) => id === removed.id ? target.id : id))] }));
    return { ...current, claims, evidence };
  });

  const updateQuery = (queryId: string, patch: Partial<SearchQuery>) => commit((current) => ({
    ...current,
    searchPlan: current.searchPlan ? { ...current.searchPlan, queries: current.searchPlan.queries.map((query) => query.id === queryId ? { ...query, ...patch } : query) } : null,
  }));

  const addQuery = () => commit((current) => {
    if (!current.searchPlan || !current.claims[0]) return current;
    return { ...current, searchPlan: { ...current.searchPlan, queries: [...current.searchPlan.queries, {
      id: nextId('SQ', current.searchPlan.queries.map((item) => item.id)), claimIds: [current.claims[0].id],
      query: `${brief.geographicScope || '本校'} ${brief.rawTopic} 原始文件`, purpose: '由用户新增的检索任务。',
      targetSourceTypes: ['primary_document'], priority: 'medium', userEditable: true,
    }] } };
  });

  const runSearch = async (query: SearchQuery, forceRefresh = false) => {
    setBusyQuery(query.id);
    setNotice('');
    try {
      const result = await searchEvidence(query, demoMode, forceRefresh);
      setSearchResults((current) => ({ ...current, [query.id]: result.results }));
      setNotice(result.notice);
    } catch (error) {
      setNotice(error instanceof Error ? error.message : '检索失败，请改用手动来源。');
    } finally {
      setBusyQuery('');
    }
  };

  const addLead = (candidate: EvidenceSearchCandidate) => {
    const source: SourceRecord = {
      id: nextId('S', workspace.sources.map((item) => item.id)), title: candidate.title,
      ...(candidate.url ? { url: candidate.url, canonicalUrl: canonicalizeSourceUrl(candidate.url), domain: new URL(candidate.url).hostname } : {}),
      publisher: candidate.sourceName, ...(candidate.publishedAt ? { publishedAt: candidate.publishedAt } : {}),
      retrievedAt: candidate.retrievedAt, sourceType: candidate.suggestedSourceType,
      credibilityTier: 'lead_only', originStatus: 'origin_unresolved', isLikelyRepost: false,
      shortSummary: candidate.snippet, supportsClaimIds: [], contradictsClaimIds: [],
      userAccepted: true, userRejected: false, extractionStatus: 'metadata_only',
      warnings: ['搜索摘要只作为线索；获取并核对原始页面后才能生成证据片段。'],
      classificationHistory: [{ at: candidate.retrievedAt, actor: 'rules', sourceType: candidate.suggestedSourceType, credibilityTier: 'lead_only', reason: '仅保存搜索结果元数据，未获取原始页面。' }],
    };
    commit((current) => ({ ...current, sources: [...current.sources, source] }));
    setNotice('已保存为线索；它不会参与事实核实。');
  };

  const acceptCandidate = async (candidate: EvidenceSearchCandidate) => {
    if (candidate.isMock || !candidate.url) {
      setNotice('模拟结果或无原始 URL 的结果不能采纳为证据。');
      return;
    }
    setNotice('正在安全获取原始页面…');
    try {
      const page = await fetchEvidencePage(candidate.url);
      const sourceId = nextId('S', workspace.sources.map((item) => item.id));
      const source: SourceRecord = {
        id: sourceId, title: page.title, url: page.sourceUrl, canonicalUrl: canonicalizeSourceUrl(page.sourceUrl), domain: new URL(page.sourceUrl).hostname,
        publisher: page.publisher || candidate.sourceName, ...(page.author ? { author: page.author } : {}),
        ...(page.publishedAt ? { publishedAt: page.publishedAt } : {}), retrievedAt: page.retrievedAt,
        sourceType: candidate.suggestedSourceType, credibilityTier: 'unrated', language: page.language,
        originStatus: 'origin_unresolved', isLikelyRepost: false, shortSummary: page.text.slice(0, 500),
        supportsClaimIds: [], contradictsClaimIds: [], userAccepted: true, userRejected: false,
        extractionStatus: page.text ? 'success' : 'metadata_only', warnings: page.warnings,
        classificationHistory: [{ at: page.retrievedAt, actor: 'rules', sourceType: candidate.suggestedSourceType, credibilityTier: 'unrated', reason: '已取得原始页面，等待用户核对具体材料类型与等级。' }],
      };
      const evidence = page.paragraphs.slice(0, 12).map((paragraph, index): EvidenceItem => ({
        id: `${sourceId}-E-${String(index + 1).padStart(3, '0')}`, sourceId, excerpt: paragraph.text.slice(0, 800),
        normalizedMeaning: paragraph.text.slice(0, 400), location: { paragraphIndex: paragraph.paragraphIndex, ...(paragraph.sectionTitle ? { sectionTitle: paragraph.sectionTitle } : {}) },
        relation: 'context', claimIds: [], directness: 'interpretive', userConfirmed: false, createdAt: page.retrievedAt,
      }));
      commit((current) => ({ ...current, sources: [...current.sources, source], evidence: [...current.evidence, ...evidence] }));
      setNotice(evidence.length ? '已取得原始页面，请逐条绑定并确认短证据片段。' : '正文提取失败，仅保留元数据，不能作为证据。');
    } catch (error) {
      setNotice(error instanceof Error ? error.message : '原始页面获取失败。');
    }
  };

  const saveManual = () => {
    if (!manual.title.trim() || !manual.text.trim()) { setNotice('手动来源必须填写标题和可定位的来源文本。'); return; }
    if (manual.url.trim()) {
      try { const parsed = new URL(manual.url); if (!['http:', 'https:'].includes(parsed.protocol)) throw new Error(); }
      catch { setNotice('来源 URL 必须是有效的 HTTP 或 HTTPS 地址。'); return; }
    }
    const now = new Date().toISOString();
    const sourceId = nextId('S', workspace.sources.map((item) => item.id));
    const canonicalUrl = manual.url.trim() ? canonicalizeSourceUrl(manual.url.trim()) : undefined;
    const source: SourceRecord = {
      id: sourceId, title: manual.title.trim(), ...(canonicalUrl ? { url: manual.url.trim(), canonicalUrl, domain: new URL(canonicalUrl).hostname } : {}),
      ...(manual.publisher.trim() ? { publisher: manual.publisher.trim() } : {}), retrievedAt: now,
      sourceType: 'user_material', credibilityTier: 'unrated', originStatus: 'origin_unresolved', isLikelyRepost: false,
      shortSummary: manual.text.trim().slice(0, 500), excerpt: manual.text.trim().slice(0, 800),
      supportsClaimIds: [], contradictsClaimIds: [], userAccepted: true, userRejected: false,
      extractionStatus: 'success', warnings: ['手动粘贴材料尚未验证来源身份，不自动获得 A 级。'],
      classificationHistory: [{ at: now, actor: 'rules', sourceType: 'user_material', credibilityTier: 'unrated', reason: '用户手动录入材料，等待分类和交叉验证。' }],
    };
    commit((current) => ({ ...current, sources: [...current.sources, source], evidence: [...current.evidence, ...makeEvidenceFromText(sourceId, manual.text)] }));
    setManual({ title: '', publisher: '', url: '', text: '' });
    setManualOpen(false);
    setNotice('手动材料已进入台账；请绑定主张、选择关系并确认证据片段。');
  };

  const importFiles = async (files: FileList | null) => {
    if (!files?.length) return;
    let projectBytes = workspace.uploadedMaterials.reduce((sum, item) => sum + item.fileSize, 0);
    for (const file of [...files]) {
      try {
        const parsed = await parseUploadedMaterial(file, projectId, {
          currentProjectBytes: projectBytes,
          maxFileBytes: uploadMaxFileBytes,
          maxProjectBytes: uploadMaxProjectBytes,
        });
        projectBytes += file.size;
        commit((current) => ({ ...current, uploadedMaterials: [...current.uploadedMaterials, parsed.material], sources: [...current.sources, parsed.source], evidence: [...current.evidence, ...parsed.evidence] }));
        setNotice(`${file.name} 已在浏览器本地解析；不会自动上传到云端。`);
      } catch (error) {
        setNotice(error instanceof Error ? error.message : `${file.name} 解析失败。`);
      }
    }
  };

  const confirmEvidence = (evidenceId: string) => commit((current) => ({ ...current, evidence: current.evidence.map((item) => item.id === evidenceId ? { ...item, userConfirmed: true } : item) }));

  const saveClassification = (source: SourceRecord) => {
    const reason = classificationReasons[source.id]?.trim();
    if (!reason) { setNotice('修改来源分类前请填写判断理由。'); return; }
    const draft = classificationDrafts[source.id] || source;
    commit((current) => ({ ...current, sources: current.sources.map((item) => item.id === source.id ? overrideSourceClassification(item, draft.sourceType, draft.credibilityTier, reason) : item) }));
    setClassificationReasons((current) => ({ ...current, [source.id]: '' }));
    setClassificationDrafts((current) => { const next = { ...current }; delete next[source.id]; return next; });
    setNotice('来源分类与修改历史已保存。');
  };

  const exportWorkspace = (kind: 'json' | 'markdown') => {
    try {
      const safeName = projectName.replace(/[<>:"/\\|?*]/gu, '-');
      if (kind === 'json') downloadText(buildEvidenceWorkspaceJson(workspace), `${safeName}-证据工作区.json`, 'application/json;charset=utf-8');
      else downloadText(buildEvidenceMarkdown(workspace, projectName), `${safeName}-带引用策划案.md`, 'text/markdown;charset=utf-8');
      setNotice('导出前引用完整性校验已通过。');
    } catch (error) {
      setNotice(error instanceof Error ? error.message : '导出前引用完整性校验失败。');
    }
  };

  return (
    <section className="evidence-workbench" aria-labelledby="evidence-workbench-title">
      <header className="evidence-workbench__header">
        <div><span className="kicker">P1 / EVIDENCE DESK</span><h2 id="evidence-workbench-title">资料与证据工作台</h2><p>先拆主张，再找原始来源；证据冲突会保留，搜索摘要不会冒充证据。</p></div>
        <div className="evidence-workbench__stats"><span><b>{workspace.claims.length}</b>项主张</span><span><b>{workspace.sources.length}</b>个来源</span><span><b>{workspace.evidence.filter((item) => item.userConfirmed).length}</b>条已确认片段</span></div>
      </header>

      <div className="evidence-tabs" role="tablist" aria-label="证据工作台视图">
        {([['claims', '主张'], ['sources', '来源'], ['verification', '核验']] as const).map(([id, label]) => <button key={id} type="button" role="tab" aria-selected={activeTab === id} onClick={() => setActiveTab(id)}>{label}</button>)}
      </div>
      {notice ? <p className="evidence-notice" role="status">{notice}</p> : null}
      {demoMode ? <p className="evidence-demo"><ShieldWarning weight="fill" />当前为模拟检索结果，不代表真实网络搜索。可使用手动来源和本地材料完成证据流程。</p> : null}

      <div className="evidence-columns">
        <section className={`evidence-panel ${activeTab === 'claims' ? 'is-active' : ''}`} role="tabpanel" aria-label="主张">
          <div className="evidence-panel__title"><div><span>01</span><h3>待验证主张</h3></div><button type="button" onClick={addClaim}><Plus />新增</button></div>
          <p className="panel-help">宽泛指控默认是 allegation / hypothesis，必须由证据升级。</p>
          <div className="claim-stack">
            {workspace.claims.map((claim, index) => <article className="claim-card" key={claim.id}>
              <div className="claim-card__meta"><code>{claim.id}</code><span data-status={claim.verificationStatus}>{claim.verificationStatus === 'verified' ? '已核实' : claim.verificationStatus === 'conflicted' ? '有冲突' : '待核实'}</span></div>
              <textarea aria-label={`${claim.id} 主张内容`} value={claim.text} onChange={(event) => updateClaim(claim.id, { text: event.target.value })} />
              <div className="claim-card__fields">
                <label>类型<select aria-label={`${claim.id} 主张类型`} value={claim.type} onChange={(event) => updateClaim(claim.id, { type: event.target.value as ClaimType, isUserConfirmed: false })}>{claimTypes.map((type) => <option key={type}>{type}</option>)}</select></label>
                <label>重要性<select aria-label={`${claim.id} 重要性`} value={claim.importance} onChange={(event) => updateClaim(claim.id, { importance: event.target.value as ClaimImportance })}><option value="critical">关键</option><option value="major">重要</option><option value="minor">次要</option></select></label>
              </div>
              <label className="claim-confirm"><input type="checkbox" checked={claim.isUserConfirmed} onChange={(event) => updateClaim(claim.id, { isUserConfirmed: event.target.checked })} />我确认这是可按事实核查的主张</label>
              <p><b>缺口</b>{matrixByClaim.get(claim.id)?.remainingWork.join('；') || claim.missingEvidence.join('；')}</p>
              <div className="claim-card__actions">{index > 0 ? <button type="button" onClick={() => mergeWithPrevious(index)}>合并到上一条</button> : null}<button type="button" onClick={() => deleteClaim(claim.id)}><Trash />删除</button></div>
            </article>)}
          </div>
        </section>

        <section className={`evidence-panel evidence-panel--wide ${activeTab === 'sources' ? 'is-active' : ''}`} role="tabpanel" aria-label="来源">
          <div className="evidence-panel__title"><div><span>02</span><h3>检索与材料</h3></div><button type="button" onClick={() => setManualOpen((current) => !current)}><Plus />添加手动来源</button></div>
          <p className="panel-help">每条检索都绑定主张和用途；由你决定是否执行，不会后台批量搜索。</p>
          {manualOpen ? <div className="manual-source-form">
            <label>来源标题<input value={manual.title} onChange={(event) => setManual({ ...manual, title: event.target.value })} /></label>
            <label>发布机构<input value={manual.publisher} onChange={(event) => setManual({ ...manual, publisher: event.target.value })} /></label>
            <label>来源 URL<input value={manual.url} onChange={(event) => setManual({ ...manual, url: event.target.value })} placeholder="https://（可选）" /></label>
            <label className="manual-source-form__text">来源文本<textarea value={manual.text} onChange={(event) => setManual({ ...manual, text: event.target.value })} placeholder="粘贴可定位的原文片段，不要粘贴搜索摘要。" /></label>
            <button type="button" onClick={saveManual}>保存手动来源</button>
          </div> : null}

          <label className="material-upload"><FileArrowUp weight="duotone" /><span><b>导入本地材料</b><small>TXT / Markdown / PDF 文本层 / DOCX / CSV / JSON；默认仅在当前浏览器解析与保存。</small></span><input type="file" multiple accept={importAccept} onChange={(event) => void importFiles(event.target.files)} /></label>
          {workspace.uploadedMaterials.length ? <ul className="material-list">{workspace.uploadedMaterials.map((item) => <li key={item.id}><b>{item.fileName}</b><span>{item.extractionStatus} · {(item.fileSize / 1024).toFixed(1)} KB</span>{item.warnings.map((warning) => <small key={warning}>{warning}</small>)}</li>)}</ul> : null}

          <div className="search-plan">
            {workspace.searchPlan?.queries.map((query) => <article className="search-query-card" key={query.id}>
              <div><code>{query.id}</code><span>{query.claimIds.join('、')}</span><span>{query.priority}</span></div>
              <label>检索词<input value={query.query} onChange={(event) => updateQuery(query.id, { query: event.target.value })} /></label>
              <label>检索用途<textarea value={query.purpose} onChange={(event) => updateQuery(query.id, { purpose: event.target.value })} /></label>
              <div className="search-query-card__filters">
                <label>优先域名<input value={query.preferredDomains?.join(', ') || ''} onChange={(event) => updateQuery(query.id, { preferredDomains: event.target.value.split(',').map((item) => item.trim()).filter(Boolean) })} placeholder="edu.cn" /></label>
                <label>开始日期<input type="date" value={query.timeRange?.from || ''} onChange={(event) => updateQuery(query.id, { timeRange: { ...query.timeRange, from: event.target.value } })} /></label>
                <label>结束日期<input type="date" value={query.timeRange?.to || ''} onChange={(event) => updateQuery(query.id, { timeRange: { ...query.timeRange, to: event.target.value } })} /></label>
              </div>
              <div className="search-query-card__actions"><button type="button" disabled={busyQuery === query.id} onClick={() => void runSearch(query)}><FileMagnifyingGlass />{busyQuery === query.id ? '检索中…' : '执行此检索'}</button><button type="button" disabled={busyQuery === query.id} onClick={() => void runSearch(query, true)}>强制刷新</button><button type="button" onClick={() => commit((current) => ({ ...current, searchPlan: current.searchPlan ? { ...current.searchPlan, queries: current.searchPlan.queries.filter((item) => item.id !== query.id) } : null }))}><Trash />删除检索</button></div>
              {searchResults[query.id]?.map((candidate) => <article className="search-result-card" key={candidate.id}>
                <div><span>{candidate.isMock ? '模拟' : '实时'}</span><small>{candidate.sourceName} · {new Date(candidate.retrievedAt).toLocaleString('zh-CN')}</small></div>
                <h4>{candidate.title}</h4><p>{candidate.snippet}</p><dl><div><dt>发布机构</dt><dd>{candidate.sourceName}</dd></div><div><dt>作者</dt><dd>搜索结果未提供，需打开原文核对</dd></div><div><dt>发布时间</dt><dd>{candidate.publishedAt || '待从原文提取'}</dd></div><div><dt>建议类型 / 等级</dt><dd>{candidate.suggestedSourceType} / lead_only</dd></div><div><dt>转载 / 独立组</dt><dd>尚未获取原文，无法判断</dd></div><div><dt>检索目的</dt><dd>{candidate.claimIds.join('、')} · {candidate.purpose}</dd></div></dl>
                <div>{candidate.url ? <a href={candidate.url} target="_blank" rel="noopener noreferrer">查看原始页面<ArrowSquareOut /></a> : null}<button type="button" disabled={candidate.isMock || !candidate.url} onClick={() => void acceptCandidate(candidate)}>采纳为证据</button><button type="button" onClick={() => addLead(candidate)}>仅保存为线索</button><button type="button" onClick={() => setSearchResults((current) => ({ ...current, [query.id]: current[query.id].filter((item) => item.id !== candidate.id) }))}>排除</button></div>
              </article>)}
            </article>)}
            <button className="add-query" type="button" onClick={addQuery}><Plus />新增检索任务</button>
          </div>

          <div className="source-ledger">
            <h3>来源台账</h3>
            {workspace.sources.length ? workspace.sources.map((source) => <article className="source-ledger-card" key={source.id}>
              <div className="source-ledger-card__head"><div><code>{source.id}</code><h4>{source.title}</h4></div><span data-tier={source.credibilityTier}>{source.sourceType} · {source.credibilityTier}</span></div>
              <p>{source.shortSummary}</p><dl className="source-ledger-card__meta"><div><dt>作者 / 发布日期</dt><dd>{source.author || '待补'} / {source.publishedAt || '待补'}</dd></div><div><dt>获取时间</dt><dd>{new Date(source.retrievedAt).toLocaleString('zh-CN')}</dd></div><div><dt>转载判断</dt><dd>{source.isLikelyRepost ? '可能转载' : '未检测到明确转载'}</dd></div><div><dt>独立来源组</dt><dd>{source.independenceGroupId || '待分析'}</dd></div></dl>{source.warnings.map((warning) => <small key={warning}>{warning}</small>)}
              <div className="source-classification">
                <label>来源类型<select aria-label={`${source.id} 来源类型`} value={classificationDrafts[source.id]?.sourceType || source.sourceType} onChange={(event) => setClassificationDrafts((current) => ({ ...current, [source.id]: { sourceType: event.target.value as SourceType, credibilityTier: current[source.id]?.credibilityTier || source.credibilityTier } }))}>{sourceTypes.map((type) => <option key={type}>{type}</option>)}</select></label>
                <label>等级<select aria-label={`${source.id} 来源等级`} value={classificationDrafts[source.id]?.credibilityTier || source.credibilityTier} onChange={(event) => setClassificationDrafts((current) => ({ ...current, [source.id]: { sourceType: current[source.id]?.sourceType || source.sourceType, credibilityTier: event.target.value as CredibilityTier } }))}>{tiers.map((tier) => <option key={tier}>{tier}</option>)}</select></label>
                <label>修改理由<input aria-label={`${source.id} 分类理由`} value={classificationReasons[source.id] || ''} onChange={(event) => setClassificationReasons((current) => ({ ...current, [source.id]: event.target.value }))} /></label>
                <button type="button" onClick={() => saveClassification(source)}>保存分类历史</button>
              </div>
              <div className="evidence-snippets">{workspace.evidence.filter((item) => item.sourceId === source.id).map((item) => <article data-testid={`evidence-row-${item.id}`} key={item.id}>
                <button className="evidence-id" type="button" onClick={() => setDrawerEvidenceId(item.id)}>{item.id}</button><blockquote>{item.excerpt}</blockquote>
                <div><label>绑定主张<select value={item.claimIds[0] || ''} onChange={(event) => commit((current) => ({ ...current, evidence: current.evidence.map((evidence) => evidence.id === item.id ? { ...evidence, claimIds: event.target.value ? [event.target.value] : [] } : evidence) }))}><option value="">暂不绑定</option>{workspace.claims.map((claim) => <option key={claim.id} value={claim.id}>{claim.id} · {claim.text.slice(0, 24)}</option>)}</select></label><label>证据关系<select value={item.relation} onChange={(event) => commit((current) => ({ ...current, evidence: current.evidence.map((evidence) => evidence.id === item.id ? { ...evidence, relation: event.target.value as EvidenceItem['relation'] } : evidence) }))}><option value="supports">supports</option><option value="contradicts">contradicts</option><option value="context">context</option><option value="not_relevant">not_relevant</option></select></label><label>直接性<select value={item.directness} onChange={(event) => commit((current) => ({ ...current, evidence: current.evidence.map((evidence) => evidence.id === item.id ? { ...evidence, directness: event.target.value as EvidenceItem['directness'] } : evidence) }))}><option value="direct">直接</option><option value="indirect">间接</option><option value="interpretive">解释性</option></select></label><button type="button" disabled={!item.claimIds.length || item.userConfirmed} onClick={() => confirmEvidence(item.id)}>{item.userConfirmed ? <><Check />已确认</> : '确认这条证据'}</button></div>
              </article>)}</div>
            </article>) : <p className="empty-evidence"><LinkSimple />尚无来源。先执行一条检索、粘贴原文或导入本地材料。</p>}
          </div>
        </section>

        <section className={`evidence-panel ${activeTab === 'verification' ? 'is-active' : ''}`} role="tabpanel" aria-label="核验">
          <div className="evidence-panel__title"><div><span>03</span><h3>交叉核验</h3></div></div>
          <p className="panel-help">一个直接 A 级原始来源，或两个独立 A/B 二手来源；有可信冲突时不得自动裁决。</p>
          <div className="verification-matrix"><h4>证据矩阵</h4>{workspace.claimEvidenceMatrix.map((row) => <article key={row.claimId}>
            <div><code>{row.claimId}</code><span data-status={row.verificationStatus}>{row.verificationStatus}</span></div><p>{row.reasoning}</p><dl><div><dt>支持证据</dt><dd>{row.supportingEvidenceIds.map((id) => <button type="button" key={id} onClick={() => setDrawerEvidenceId(id)}>{id}</button>)}{row.supportingEvidenceIds.length ? null : '无'}</dd></div><div><dt>反驳证据</dt><dd>{row.contradictingEvidenceIds.map((id) => <button type="button" key={id} onClick={() => setDrawerEvidenceId(id)}>{id}</button>)}{row.contradictingEvidenceIds.length ? null : '无'}</dd></div><div><dt>背景证据</dt><dd>{row.contextualEvidenceIds.map((id) => <button type="button" key={id} onClick={() => setDrawerEvidenceId(id)}>{id}</button>)}{row.contextualEvidenceIds.length ? null : '无'}</dd></div><div><dt>独立来源组</dt><dd>{row.independentSourceGroupCount}</dd></div><div><dt>原始来源</dt><dd>{row.primarySourceCount}</dd></div><div><dt>剩余任务</dt><dd>{row.remainingWork.join('；') || '当前规则门槛已满足，仍需编辑复核。'}</dd></div></dl>
          </article>)}</div>
          <div className="conflict-list"><h4>来源冲突</h4>{workspace.conflicts.length ? workspace.conflicts.map((conflict) => <article key={conflict.id}><span>{conflict.type}</span><p>{conflict.explanation}</p><ul>{conflict.nextSteps.map((step) => <li key={step}>{step}</li>)}</ul></article>) : <p>当前没有已确认的支持/反驳证据对；这不等于主张已核实。</p>}</div>
          <div className="evidence-export"><button type="button" onClick={() => exportWorkspace('json')}><DownloadSimple />导出证据 JSON</button><button type="button" onClick={() => exportWorkspace('markdown')}><DownloadSimple />导出带引用策划案</button></div>
        </section>
      </div>

      {selectedEvidence && selectedSource ? <aside className="citation-drawer" aria-label="引用详情"><button type="button" aria-label="关闭引用详情" onClick={() => setDrawerEvidenceId('')}><X /></button><span className="kicker">CITATION / {selectedEvidence.id}</span><h3>{selectedSource.title}</h3><blockquote>{selectedEvidence.excerpt}</blockquote><dl><div><dt>发布机构</dt><dd>{selectedSource.publisher || '待补'}</dd></div><div><dt>发布时间</dt><dd>{selectedSource.publishedAt || '待补'}</dd></div><div><dt>获取时间</dt><dd>{selectedSource.retrievedAt}</dd></div><div><dt>定位</dt><dd>{selectedEvidence.location?.sectionTitle || `段落 ${selectedEvidence.location?.paragraphIndex ?? '待补'}`}</dd></div></dl>{selectedSource.url ? <a href={selectedSource.url} target="_blank" rel="noopener noreferrer">打开原始链接<ArrowSquareOut /></a> : null}</aside> : null}
    </section>
  );
}
