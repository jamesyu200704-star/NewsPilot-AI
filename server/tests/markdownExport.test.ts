import assert from 'node:assert/strict';
import test from 'node:test';
import { MockProvider } from '../providers/MockProvider.js';
import { buildMarkdown } from '../../src/utils/markdownExport.js';
import { sampleInput } from './fixtures.js';

test('Markdown 导出将外部文本保持为不可执行的纯文本', async () => {
  const input = {
    ...sampleInput,
    topic: '<img src=x onerror=alert(1)>\n# injected',
    background: '![track](https://attacker.invalid/pixel)\n<script>alert(1)</script>',
  };
  const result = await new MockProvider().generate(input);

  result.topicSummary = '[open](javascript:alert(1))';
  result.angles[0].title = '![remote](https://attacker.invalid/image)';

  const markdown = buildMarkdown(input, result);

  assert.doesNotMatch(markdown, /<img|<script/i);
  assert.doesNotMatch(markdown, /!\[(?:track|remote)\]\(/);
  assert.doesNotMatch(markdown, /\]\(javascript:/i);
  assert.doesNotMatch(markdown, /\n# injected/);
  assert.match(markdown, /&lt;img src=x onerror=alert/);
  assert.match(markdown, /\\!\\\[track\\\]\\\(https:\/\/attacker\.invalid\/pixel\\\)/);
  assert.match(markdown, /\\\[open\\\]\\\(javascript:alert\\\(1\\\)\\\)/i);
});
