import { ArrowUpRight, NewspaperClipping } from '@phosphor-icons/react';
import type { ClientGenerationMode } from '../services/generator';

interface EmptyStateProps {
  onSelect: (topic: string) => void;
  disabled?: boolean;
  generationMode?: ClientGenerationMode;
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
}: EmptyStateProps) {
  return (
    <section className="empty-state" aria-labelledby="empty-state-title">
      <div className="empty-state__topline">
        <span>从线索到采访</span>
        <span>{generationMode === 'api' ? 'API 在线' : '本地演示'}</span>
      </div>

      <div className="empty-state__statement">
        <div className="empty-state__visual" aria-hidden="true">
          <NewspaperClipping weight="bold" />
        </div>
        <h2 id="empty-state-title">
          一个主题，三条可采访的报道路径。
        </h2>
        <p>人物、机制、趋势三个方向同时展开，让下一次采访从具体问题开始。</p>
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
