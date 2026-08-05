import { ArrowUpRight, NewspaperClipping } from '@phosphor-icons/react';
import type { ClientGenerationMode } from '../services/generator';
import type { ProviderPresentation } from '../services/providerStatus';

interface EmptyStateProps {
  onSelect: (topic: string) => void;
  disabled?: boolean;
  generationMode?: ClientGenerationMode;
  providerPresentation: ProviderPresentation;
}

const cases = [
  {
    category: 'AI × 教育',
    title: '大学生使用生成式 AI 完成课程作业',
  },
  {
    category: '校园 × 社会',
    title: '高校搭子社交现象调查',
  },
  {
    category: '媒介 × 青年',
    title: '大学生短视频使用习惯变化',
  },
];

export function EmptyState({
  onSelect,
  disabled = false,
  generationMode = 'mock',
  providerPresentation,
}: EmptyStateProps) {
  return (
    <section className="empty-state" aria-labelledby="empty-state-title">
      <div className="empty-state__topline">
        <span>从线索到新闻工作流</span>
        <span>
          {generationMode === 'local-ai'
            ? providerPresentation.activeLabel
            : 'Demo 模式'}
        </span>
      </div>

      <div className="empty-state__statement">
        <div className="empty-state__visual" aria-hidden="true">
          <NewspaperClipping weight="bold" />
        </div>
        <h2 id="empty-state-title">
          一条线索，一套可解释的新闻策划流程。
        </h2>
        <p>先评估新闻价值并检索证据，再由策划、核查、编辑三个 Agent 形成可执行采访路径。</p>
      </div>

      <div className="empty-state__examples">
        <header className="empty-state__examples-header">
          <span>不知道从哪开始？</span>
          <strong>先试一个真实主题</strong>
        </header>
        <div className="empty-cases" aria-label="示例案例">
          {cases.map((item) => (
            <button
              key={item.title}
              type="button"
              onClick={() => onSelect(item.title)}
              disabled={disabled}
            >
              <span className="empty-case__category">{item.category}</span>
              <strong className="empty-case__title">{item.title}</strong>
              <ArrowUpRight aria-hidden="true" weight="bold" />
            </button>
          ))}
        </div>
      </div>

      <div className="empty-state__footer">
        <span>所有生成内容均需独立核验</span>
        <span>NewsPilot AI</span>
      </div>
    </section>
  );
}
