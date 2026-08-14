import assert from 'node:assert/strict';
import test from 'node:test';
import {
  createEmptyEvidenceWorkspace,
  parseEvidenceWorkspaceExport,
  serializeEvidenceWorkspace,
} from '../../shared/证据工作区.js';
import { detectEvidenceConflicts } from '../../shared/冲突检测.js';
import { validateCitationIntegrity } from '../../shared/引用完整性.js';
import {
  createLocalReportingProject,
  parseLocalProjectImport,
  serializeLocalProjects,
} from '../../shared/本地项目模型.js';
import {
  buildEvidenceMarkdown,
  buildEvidenceWorkspaceJson,
} from '../../shared/证据导出.js';
import type {
  Claim,
  EvidenceItem,
  EvidenceWorkspaceState,
  SourceRecord,
} from '../../shared/证据领域模型.js';
import type { ReportingBrief } from '../../shared/学生报道模型.js';

const brief: ReportingBrief = {
  mode: 'course', rawTopic: '学校是否全面禁止 AI 作业', assignmentType: '校园调查',
  availableInterviewees: [], existingMaterials: [], reportingResources: [], ethicalConstraints: [],
};
const claim: Claim = {
  id: 'C-001', text: '学校禁止所有课程作业使用生成式 AI。', type: 'fact', importance: 'critical',
  source: 'user_input', isUserConfirmed: true, evidenceIds: ['E-001', 'E-002'],
  verificationStatus: 'conflicted', missingEvidence: ['课程层面作业说明'],
  createdAt: '2026-08-13T00:00:00.000Z', updatedAt: '2026-08-13T00:00:00.000Z',
};
const source = (id: string, overrides: Partial<SourceRecord> = {}): SourceRecord => ({
  id, title: id === 'S-001' ? '学校生成式 AI 使用规定' : '课程作业说明',
  url: `https://example.edu/${id}`, canonicalUrl: `https://example.edu/${id}`, domain: 'example.edu',
  publisher: id === 'S-001' ? '学校教务处' : '课程教师', retrievedAt: '2026-08-13T00:00:00.000Z',
  sourceType: 'primary_document', credibilityTier: 'A', independenceGroupId: `IG-${id}`,
  isLikelyRepost: false, shortSummary: '可定位的正式文件。', supportsClaimIds: [], contradictsClaimIds: [],
  userAccepted: true, userRejected: false, extractionStatus: 'success', warnings: [], classificationHistory: [],
  ...overrides,
});
const evidence = (id: string, sourceId: string, relation: EvidenceItem['relation'], excerpt: string): EvidenceItem => ({
  id, sourceId, excerpt, normalizedMeaning: excerpt, relation, claimIds: ['C-001'], directness: 'direct',
  userConfirmed: true, createdAt: '2026-08-13T00:00:00.000Z', location: { paragraphIndex: 1, sectionTitle: '适用范围' },
});

const workspace = (): EvidenceWorkspaceState => ({
  ...createEmptyEvidenceWorkspace('2026-08-13T00:00:00.000Z'),
  claims: [claim],
  sources: [source('S-001'), source('S-002')],
  evidence: [
    evidence('E-001', 'S-001', 'contradicts', '学校允许教师在课程中自行规定辅助使用边界。'),
    evidence('E-002', 'S-002', 'supports', '本课程禁止在所有作业中使用生成式 AI。'),
  ],
  claimEvidenceMatrix: [{
    claimId: 'C-001', supportingEvidenceIds: ['E-002'], contradictingEvidenceIds: ['E-001'],
    contextualEvidenceIds: [], independentSourceGroupCount: 2, primarySourceCount: 2,
    verificationStatus: 'conflicted', reasoning: '范围存在冲突。', remainingWork: ['核对学校与课程规则的适用层级。'],
  }],
});

test('ConflictDetector 识别范围、数值和时间冲突且不自动裁决', () => {
  const state = workspace();
  const scope = detectEvidenceConflicts(state.claims, state.sources, state.evidence);
  assert.equal(scope.length, 1);
  assert.equal(scope[0].type, 'scope');
  assert.equal(scope[0].status, 'open');
  assert.ok(scope[0].nextSteps.some((item) => /适用范围|层级/u.test(item)));

  const numericClaim = { ...claim, id: 'C-N', text: '共有 100 名学生参与。' };
  const numericEvidence = [
    { ...evidence('E-N1', 'S-001', 'supports', '统计表显示共有 100 名学生。'), claimIds: ['C-N'] },
    { ...evidence('E-N2', 'S-002', 'contradicts', '报告写明共有 82 名学生。'), claimIds: ['C-N'] },
  ];
  assert.equal(detectEvidenceConflicts([numericClaim], workspace().sources, numericEvidence)[0].type, 'numeric');
});

test('ConflictDetector 忽略仅线索级、C 级或已拒绝来源的反驳', () => {
  const state = workspace();
  const weakContradiction = source('S-002', { sourceType: 'social_post', credibilityTier: 'lead_only' });
  assert.equal(detectEvidenceConflicts(state.claims, [state.sources[0], weakContradiction], state.evidence).length, 0);
});

test('引用完整性拒绝不存在 ID、无定位片段和未获取原文的搜索摘要', () => {
  assert.doesNotThrow(() => validateCitationIntegrity(workspace()));
  assert.throws(
    () => validateCitationIntegrity({ ...workspace(), evidence: [{ ...workspace().evidence[0], sourceId: 'missing' }] }),
    /sourceId|来源/u,
  );
  assert.throws(
    () => validateCitationIntegrity({ ...workspace(), evidence: [{ ...workspace().evidence[0], excerpt: '', location: undefined }] }),
    /片段|定位/u,
  );
  assert.throws(
    () => validateCitationIntegrity({
      ...workspace(),
      sources: [{ ...workspace().sources[0], extractionStatus: 'metadata_only', warnings: ['仅搜索摘要'] }, workspace().sources[1]],
    }),
    /搜索摘要|原始页面/u,
  );
});

test('证据工作区 JSON Schema 版本化导出且不包含完整网页正文', () => {
  const serialized = serializeEvidenceWorkspace(workspace(), '2026-08-13T01:00:00.000Z');
  const parsed = parseEvidenceWorkspaceExport(serialized);
  assert.equal(parsed.schemaVersion, 1);
  assert.equal(parsed.format, 'newspilot-evidence-workspace');
  assert.equal(parsed.claims.length, 1);
  assert.doesNotMatch(serialized, /fullHtml|rawWebPage|完整网页正文/u);
  assert.throws(() => parseEvidenceWorkspaceExport('{"schemaVersion":999}'), /版本|格式/u);
});

test('本地项目从 v1 无损迁移为 v3 并保存证据与执行工作区', () => {
  const legacy = {
    format: 'newspilot-local-projects', dataVersion: 1,
    exportedAt: '2026-08-13T00:00:00.000Z', projects: [{
      dataVersion: 1, id: 'legacy', name: '旧项目', brief, plan: null, selectedAngleId: '',
      createdAt: '2026-08-12T00:00:00.000Z', updatedAt: '2026-08-12T01:00:00.000Z',
    }],
  };
  const migrated = parseLocalProjectImport(JSON.stringify(legacy));
  assert.equal(migrated.dataVersion, 3);
  assert.equal(migrated.projects[0].dataVersion, 3);
  assert.equal(migrated.projects[0].evidenceWorkspace.schemaVersion, 1);
  assert.deepEqual(migrated.projects[0].evidenceWorkspace.claims, []);
  assert.equal(migrated.projects[0].executionWorkspace.schemaVersion, 1);

  const project = createLocalReportingProject({ id: 'new', name: '证据项目', brief, evidenceWorkspace: workspace(), now: '2026-08-13T00:00:00.000Z' });
  const roundTrip = parseLocalProjectImport(serializeLocalProjects([project]));
  assert.equal(roundTrip.projects[0].evidenceWorkspace.conflicts.length, 0);
  assert.equal(roundTrip.projects[0].evidenceWorkspace.sources.length, 2);
});

test('Markdown 和 JSON 导出包含 claim/evidence/source/conflict/searchPlan 且引用可追溯', () => {
  const state = { ...workspace(), conflicts: detectEvidenceConflicts(workspace().claims, workspace().sources, workspace().evidence) };
  const markdown = buildEvidenceMarkdown(state, '学校 AI 作业政策观察');
  const json = buildEvidenceWorkspaceJson(state);
  assert.match(markdown, /## 待验证主张/u);
  assert.match(markdown, /\[E-001\]/u);
  assert.match(markdown, /## 来源冲突/u);
  assert.match(markdown, /https:\/\/example\.edu\/S-001/u);
  const exported = JSON.parse(json) as Record<string, unknown>;
  assert.equal(exported.schemaVersion, 1);
  assert.ok(Array.isArray(exported.claims));
  assert.ok(Array.isArray(exported.sources));
  assert.ok(Array.isArray(exported.conflicts));
  assert.ok(Object.hasOwn(exported, 'searchPlan'));
});
