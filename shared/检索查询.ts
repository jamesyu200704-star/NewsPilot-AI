import type { BriefInput } from './generation.js';

const clean = (value: string) =>
  value
    .replace(/[\u0000-\u001f\u007f]/gu, ' ')
    .trim()
    .replace(/\s+/gu, ' ')
    .slice(0, 120);

export const buildSearchQueries = (input: BriefInput): string[] => {
  const topic = clean(input.topic);
  const audience = clean(input.audience);
  const scope = clean(input.scope);
  const context = [audience, scope].filter(Boolean).join(' ');
  const candidates = [
    [topic, context].filter(Boolean).join(' '),
    `${topic} 政策 规定 规范 官方`,
    `${topic} 公开数据 统计 报告`,
    `${topic} 近期 新闻 报道 案例`,
  ];

  return [...new Set(candidates.map(clean).filter(Boolean))].slice(0, 6);
};
