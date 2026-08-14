import type { ReactNode } from 'react';

export function WorkbenchPage(props: {
  eyebrow: string;
  title: string;
  description: string;
  actions?: ReactNode;
  children: ReactNode;
}) {
  return (
    <section className="execution-page" aria-labelledby={`execution-${props.eyebrow}`}>
      <header className="execution-page__header">
        <div>
          <span>{props.eyebrow}</span>
          <h2 id={`execution-${props.eyebrow}`}>{props.title}</h2>
          <p>{props.description}</p>
        </div>
        {props.actions ? <div className="execution-page__actions">{props.actions}</div> : null}
      </header>
      {props.children}
    </section>
  );
}

export function StatusChip({ children, tone = 'neutral' }: { children: ReactNode; tone?: 'good' | 'warn' | 'danger' | 'neutral' }) {
  return <span className="execution-status" data-tone={tone}>{children}</span>;
}

export const formatDateTime = (value?: string) => {
  if (!value) return '未设置';
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? '时间无效' : date.toLocaleString('zh-CN', { hour12: false });
};

export const newId = (prefix: string) =>
  `${prefix}-${globalThis.crypto?.randomUUID?.() || `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`}`;

export function downloadFile(content: BlobPart, fileName: string, mimeType: string) {
  const blob = content instanceof Blob ? content : new Blob([content], { type: mimeType });
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement('a');
  anchor.href = url;
  anchor.download = fileName.replace(/[\\/:*?"<>|]/gu, '-');
  anchor.rel = 'noopener';
  anchor.click();
  URL.revokeObjectURL(url);
}
