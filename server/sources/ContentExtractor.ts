export interface ExtractedParagraph {
  paragraphIndex: number;
  sectionTitle?: string;
  text: string;
}

export interface ExtractedWebContent {
  title: string;
  author?: string;
  publisher?: string;
  publishedAt?: string;
  language?: string;
  text: string;
  paragraphs: ExtractedParagraph[];
  warnings: string[];
  sourceUrl: string;
}

const decode = (value: string) => value
  .replace(/&nbsp;/giu, ' ')
  .replace(/&amp;/giu, '&')
  .replace(/&lt;/giu, '<')
  .replace(/&gt;/giu, '>')
  .replace(/&quot;/giu, '"')
  .replace(/&#39;|&apos;/giu, "'")
  .replace(/&#(\d+);/gu, (_full, code: string) => String.fromCodePoint(Number(code)));
const textOf = (html: string) => decode(html.replace(/<[^>]+>/gu, ' ').replace(/\s+/gu, ' ').trim());
const meta = (html: string, key: string) => {
  const tags = html.match(/<meta\b[^>]*>/giu) || [];
  const tag = tags.find((item) => new RegExp(`(?:name|property)=["']${key.replace(/[.*+?^${}()|[\]\\]/gu, '\\$&')}["']`, 'iu').test(item));
  return tag?.match(/content=["']([^"']*)["']/iu)?.[1]?.trim();
};

export function extractWebContent(html: string, sourceUrl: string): ExtractedWebContent {
  const title = textOf(html.match(/<title\b[^>]*>([\s\S]*?)<\/title>/iu)?.[1] || '') ||
    textOf(html.match(/<h1\b[^>]*>([\s\S]*?)<\/h1>/iu)?.[1] || '') || '未命名网页';
  const author = meta(html, 'author');
  const publisher = meta(html, 'og:site_name');
  const publishedAt = meta(html, 'article:published_time') || meta(html, 'date');
  const language = html.match(/<html\b[^>]*\blang=["']([^"']+)["']/iu)?.[1];
  let clean = html
    .replace(/<!--([\s\S]*?)-->/gu, '')
    .replace(/<(script|style|iframe|object|embed|svg|canvas|noscript)\b[^>]*>[\s\S]*?<\/\1>/giu, ' ')
    .replace(/<(nav|header|footer|aside|form)\b[^>]*>[\s\S]*?<\/\1>/giu, ' ')
    .replace(/<[^>]+(?:\bhidden\b|aria-hidden=["']true["']|style=["'][^"']*(?:display\s*:\s*none|visibility\s*:\s*hidden)[^"']*)[^>]*>[\s\S]*?<\/[^>]+>/giu, ' ');
  const body = clean.match(/<body\b[^>]*>([\s\S]*?)<\/body>/iu)?.[1] || clean;
  const tokens = body.match(/<(?:h[1-6]|p|li|blockquote|td|th)\b[^>]*>[\s\S]*?<\/(?:h[1-6]|p|li|blockquote|td|th)>/giu) || [];
  const paragraphs: ExtractedParagraph[] = [];
  let sectionTitle: string | undefined;
  for (const token of tokens) {
    const value = textOf(token);
    if (!value) continue;
    if (/^<h[1-6]\b/iu.test(token)) { sectionTitle = value; continue; }
    if (value.length < 8) continue;
    paragraphs.push({ paragraphIndex: paragraphs.length, ...(sectionTitle ? { sectionTitle } : {}), text: value.slice(0, 4000) });
  }
  const text = paragraphs.map((item) => item.text).join('\n\n').slice(0, 100_000);
  return {
    title: title.slice(0, 300),
    ...(author ? { author } : {}),
    ...(publisher ? { publisher } : {}),
    ...(publishedAt ? { publishedAt } : {}),
    ...(language ? { language } : {}),
    text,
    paragraphs,
    warnings: text ? [] : ['正文提取失败，仅保留网页元数据。'],
    sourceUrl,
  };
}
