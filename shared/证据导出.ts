import type { EvidenceWorkspaceState } from './证据领域模型.js';
import { validateCitationIntegrity } from './引用完整性.js';

const safe = (value: string | number | undefined) => String(value ?? '未提供')
  .replace(/\r?\n/gu, ' ').replace(/[\\`*_\[\]()#!|~]/gu, '\\$&').trim();
const list = (items: string[], empty = '暂无') => items.length ? items.map((item) => `- ${safe(item)}`).join('\n') : `- ${empty}`;

export function buildEvidenceMarkdown(workspace: EvidenceWorkspaceState, title: string) {
  validateCitationIntegrity(workspace);
  const sourceById = new Map(workspace.sources.map((item) => [item.id, item]));
  return [
    `# ${safe(title)}｜新闻选题策划案`, '',
    '## 新闻问题', '', safe(workspace.claims[0]?.text || '尚未建立关键新闻问题。'), '',
    '## 编辑判断', '', '当前判断由报道计划提供；证据状态由确定性规则单独计算。', '',
    '## 已知事实', '', list(workspace.claimEvidenceMatrix.filter((row) => row.verificationStatus === 'verified').map((row) => `${workspace.claims.find((item) => item.id === row.claimId)?.text} ${row.supportingEvidenceIds.map((id) => `[${id}]`).join(' ')}`)), '',
    '## 工作假设', '', list(workspace.claims.filter((item) => ['hypothesis', 'prediction'].includes(item.type)).map((item) => `${item.text}（待核实）`)), '',
    '## 待验证主张', '', list(workspace.claims.map((item) => `${item.id}｜${item.text}｜${item.verificationStatus}｜${item.evidenceIds.map((id) => `[${id}]`).join(' ') || '待核实'}`)), '',
    '## 推荐报道角度', '', '参见 NewsPilot 报道计划；事实性说明必须引用本证据台账。', '',
    '## 信源地图', '', list(workspace.sources.map((item) => `${item.title}｜${item.publisher || '发布者待补'}｜${item.sourceType}｜${item.credibilityTier}`)), '',
    '## 采访计划', '', '优先补齐证据矩阵的剩余核实任务与冲突双方。', '',
    '## 证据台账', '',
    ...workspace.evidence.flatMap((item) => {
      const source = sourceById.get(item.sourceId)!;
      return [`### [${item.id}] ${safe(source.title)}`, '', `- 关系：${item.relation}`, `- 片段：${safe(item.excerpt)}`, `- 定位：${safe(item.location?.sectionTitle || `段落 ${item.location?.paragraphIndex ?? '待补'}`)}`, ''];
    }),
    '## 来源冲突', '', list(workspace.conflicts.map((item) => `${item.explanation} 下一步：${item.nextSteps.join('；')}`)), '',
    '## 事实核查清单', '', list(workspace.claimEvidenceMatrix.flatMap((row) => row.remainingWork)), '',
    '## 仍需补充的材料', '', list(workspace.claims.flatMap((item) => item.missingEvidence)), '',
    '## 下一步行动', '', '1. 获取原始文件或页面并保存可定位短片段。\n2. 对冲突双方分别采访，不进行来源数量投票。\n3. 更新主张状态并再次运行引用完整性校验。', '',
    '## 来源列表', '',
    ...workspace.sources.flatMap((item) => [
      `### ${safe(item.id)} · ${safe(item.title)}`, '',
      `- 发布者：${safe(item.publisher)}`, `- 作者：${safe(item.author)}`, `- 日期：${safe(item.publishedAt)}`,
      `- Evidence ID：${workspace.evidence.filter((evidence) => evidence.sourceId === item.id).map((evidence) => `[${evidence.id}]`).join('、') || '尚无可引用证据片段'}`,
      `- 来源类型：${item.sourceType}`, `- 核实等级：${item.credibilityTier}`,
      `- 原始链接或材料名称：${item.url ? safe(item.url) : safe(item.title)}`, `- 获取时间：${safe(item.retrievedAt)}`,
      `- 定位信息：${safe(item.pageNumber ? `第 ${item.pageNumber} 页` : item.sectionTitle)}`, '',
    ]),
    '> NewsPilot 不替代记者采访。搜索结果与用户材料需要人工判断；社交媒体只能作为线索；来源冲突不会自动裁决。',
  ].join('\n');
}

export function buildEvidenceWorkspaceJson(workspace: EvidenceWorkspaceState) {
  validateCitationIntegrity(workspace);
  return JSON.stringify({
    schemaVersion: workspace.schemaVersion,
    claims: workspace.claims,
    sources: workspace.sources,
    evidence: workspace.evidence,
    claimEvidenceMatrix: workspace.claimEvidenceMatrix,
    conflicts: workspace.conflicts,
    searchPlan: workspace.searchPlan,
    uploadedMaterials: workspace.uploadedMaterials.map(({ extractedText: _text, ...metadata }) => metadata),
    updatedAt: workspace.updatedAt,
  }, null, 2);
}
