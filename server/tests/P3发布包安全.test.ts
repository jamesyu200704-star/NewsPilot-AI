import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import { existsSync, readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import test from 'node:test';
import { parseLocalProjectImport } from '../../shared/本地项目模型.js';

const root = process.cwd();
const read = (path: string) => readFileSync(resolve(root, path), 'utf8');
const fixtureNames = [
  'profile-feature-project.json',
  'campus-investigation-project.json',
  'policy-observation-project.json',
] as const;

test('三个人工验收夹具可以导入且明确标记为虚构教学数据', () => {
  for (const name of fixtureNames) {
    const serialized = read(`qa/fixtures/${name}`);
    const raw = JSON.parse(serialized) as { fixtureMetadata?: { synthetic?: boolean; notice?: string } };
    assert.equal(raw.fixtureMetadata?.synthetic, true);
    assert.match(raw.fixtureMetadata?.notice ?? '', /虚构教学数据/u);
    assert.equal(parseLocalProjectImport(serialized).projects.length, 1);
  }
});

test('三个公开示例项目文件齐全且不包含真实身份、密钥或本地路径', () => {
  const scenarios = ['profile-feature', 'campus-investigation', 'policy-observation'];
  const expected = ['project.json', 'README.md', 'reporting-plan.md', 'interview-guide.md', 'evidence-matrix.csv', 'outline.md'];
  for (const scenario of scenarios) {
    const combined = expected.map((filename) => {
      const path = `examples/${scenario}/${filename}`;
      assert.equal(existsSync(resolve(root, path)), true, `${path} 缺失`);
      return read(path);
    }).join('\n');
    assert.match(combined, /本示例为虚构教学数据/u);
    assert.match(combined, /不对应真实人物、真实学校或真实事件/u);
    assert.doesNotMatch(combined, /\bsk-[A-Za-z0-9_-]{8,}\b|[A-Z]:\\Users\\|\b1[3-9]\d{9}\b|[\w.+-]+@[\w.-]+\.[A-Za-z]{2,}/iu);
  }
});

test('GitHub 发布规范文件、三套工作流与 Beta 版本声明存在', () => {
  const required = [
    'CODE_OF_CONDUCT.md',
    '.github/ISSUE_TEMPLATE/bug_report.yml',
    '.github/ISSUE_TEMPLATE/usability_issue.yml',
    '.github/ISSUE_TEMPLATE/strategy_feedback.yml',
    '.github/ISSUE_TEMPLATE/feature_request.yml',
    '.github/PULL_REQUEST_TEMPLATE.md',
    '.github/workflows/test.yml',
    '.github/workflows/build.yml',
    '.github/workflows/release-check.yml',
    'release/v1.1.0-beta.1.md',
  ];
  required.forEach((path) => assert.equal(existsSync(resolve(root, path)), true, `${path} 缺失`));
  const packageJson = JSON.parse(read('package.json')) as { version: string };
  assert.equal(packageJson.version, '1.1.0-beta.1');
  assert.match(read('README.md'), /当前版本仍处于 Beta 阶段，尚未完成充分的真实用户验证/u);
});

test('Git 跟踪文件不包含环境密钥文件、node_modules 或本地研究结果', () => {
  const tracked = execFileSync('git', ['ls-files'], { cwd: root, encoding: 'utf8' })
    .split(/\r?\n/u)
    .filter(Boolean);
  assert.equal(tracked.some((path) => path === '.env' || /^\.env\.(?!example$)/u.test(path)), false);
  assert.equal(tracked.some((path) => path.includes('node_modules/')), false);
  assert.equal(tracked.some((path) => /research\/(?:data|results|sessions)\//u.test(path)), false);
  assert.match(read('.gitignore'), /\.env\.\*/u);
});

test('SearXNG 只提交示例配置，本机实配被忽略且 Compose 仅绑定回环地址', () => {
  const tracked = execFileSync('git', ['ls-files'], { cwd: root, encoding: 'utf8' })
    .split(/\r?\n/u)
    .filter(Boolean);
  assert.equal(tracked.includes('searxng/settings.yml'), false);
  assert.equal(existsSync(resolve(root, 'searxng/settings.yml.example')), true);
  assert.match(read('searxng/settings.yml.example'), /REPLACE_WITH_GENERATED_SECRET/u);
  assert.match(read('.gitignore'), /searxng\/settings\.yml/u);
  assert.match(read('docker-compose.search.yml'), /127\.0\.0\.1:8080:8080/u);
  assert.match(read('docs/SEARCH_SETUP.md'), /初始化SearXNG配置\.ps1/u);
});

test('研究包 Schema 只允许 schemaVersion 2 和 ProductEvent.eventName', () => {
  const schema = JSON.parse(read('research/schemas/research-data-bundle.schema.json')) as {
    properties?: { schemaVersion?: { const?: number } };
    $defs?: { productEvent?: { required?: string[]; properties?: Record<string, unknown> } };
  };
  assert.equal(schema.properties?.schemaVersion?.const, 2);
  assert.ok(schema.$defs?.productEvent?.required?.includes('eventName'));
  assert.equal(Object.hasOwn(schema.$defs?.productEvent?.properties ?? {}, 'name'), false);
});

test('CI 使用锁定依赖、Mock/Manual Provider 和仓库中真实存在的质量脚本', () => {
  const workflows = [
    read('.github/workflows/build.yml'),
    read('.github/workflows/test.yml'),
    read('.github/workflows/release-check.yml'),
  ];
  for (const workflow of workflows) {
    assert.match(workflow, /npm ci/u);
    assert.match(workflow, /VITE_RESEARCH_MODE:\s*'false'/u);
    assert.match(workflow, /GENERATION_MODE:\s*mock/u);
    assert.match(workflow, /SEARCH_PROVIDER:\s*manual/u);
    assert.match(workflow, /TRANSCRIPTION_PROVIDER:\s*manual/u);
    assert.doesNotMatch(workflow, /continue-on-error:\s*true/u);
  }
  const releaseWorkflow = workflows[2];
  for (const script of ['npm test', 'npm run build', 'npm run eval:campus', 'npm run eval:p1', 'npm run eval:p2', 'npm run eval:p3']) {
    assert.ok(releaseWorkflow.includes(script), `${script} 未进入 Release Check`);
  }
});
