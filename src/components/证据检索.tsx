import {
  ArrowSquareOut,
  Database,
  MagnifyingGlass,
} from '@phosphor-icons/react';
import type { GenerationResult, RetrievalEvidence } from '../types';

interface EvidenceRetrievalProps {
  result: GenerationResult;
}

const statusLabels = {
  mock: '本地知识库',
  live: '实时检索已完成',
  failed: '检索降级',
} as const;

const sourceLabels: Record<RetrievalEvidence['sourceType'], string> = {
  news: '新闻报道',
  policy: '政策文件',
  data: '公开数据',
  case: '公开案例',
  'news-value': '新闻价值方法',
  'case-pattern': '报道结构案例',
  'interview-strategy': '采访策略',
};

function EvidenceCard({ item }: { item: RetrievalEvidence }) {
  return (
    <article className={'evidence-card evidence-card--' + item.origin}>
      <div className="evidence-card__meta">
        <span>{item.origin === 'search' ? 'Search' : 'Knowledge'}</span>
        <b>{sourceLabels[item.sourceType]}</b>
      </div>
      <h4>{item.title}</h4>
      <p>{item.summary}</p>
      <footer>
        <code>{item.id}</code>
        {item.sourceUrl ? (
          <a href={item.sourceUrl} target="_blank" rel="noreferrer">
            查看来源
            <ArrowSquareOut aria-hidden="true" weight="bold" />
          </a>
        ) : (
          <span>{item.sourceName ?? '内置方法知识'}</span>
        )}
      </footer>
    </article>
  );
}

export function EvidenceRetrieval({ result }: EvidenceRetrievalProps) {
  const { retrievalContext } = result;
  const primaryEvidence = retrievalContext.evidence.slice(0, 6);
  const remainingEvidence = retrievalContext.evidence.slice(6);

  return (
    <section className="evidence" aria-labelledby="evidence-title">
      <header className="evidence__header">
        <div>
          <span className="section-kicker">Evidence desk / 03</span>
          <h3 id="evidence-title">先找证据，再让模型判断。</h3>
        </div>
        <div
          className={'evidence__status evidence__status--' + retrievalContext.searchStatus}
        >
          <span aria-hidden="true" />
          <div>
            <b>{statusLabels[retrievalContext.searchStatus]}</b>
            <small>{retrievalContext.searchProvider.toUpperCase()}</small>
          </div>
        </div>
      </header>

      {retrievalContext.notice ? (
        <p className="evidence__notice">{retrievalContext.notice}</p>
      ) : null}

      <div className="search-query-board">
        <div className="search-query-board__title">
          <MagnifyingGlass aria-hidden="true" weight="bold" />
          <span>自动生成的检索查询</span>
        </div>
        <ol>
          {retrievalContext.queries.map((query, index) => (
            <li key={query}>
              <span>{String(index + 1).padStart(2, '0')}</span>
              {query}
            </li>
          ))}
        </ol>
      </div>

      <div className="evidence__count">
        <Database aria-hidden="true" weight="bold" />
        <span>{retrievalContext.evidence.length} 条可追溯上下文</span>
        <p>搜索摘要只能作为线索；正式报道必须打开原文复核。</p>
      </div>

      <div className="evidence__grid">
        {primaryEvidence.map((item) => (
          <EvidenceCard key={item.id} item={item} />
        ))}
      </div>

      {remainingEvidence.length ? (
        <details className="evidence__more">
          <summary>查看其余 {remainingEvidence.length} 条证据</summary>
          <div className="evidence__grid">
            {remainingEvidence.map((item) => (
              <EvidenceCard key={item.id} item={item} />
            ))}
          </div>
        </details>
      ) : null}
    </section>
  );
}
