import { NewspaperClipping } from '@phosphor-icons/react';
import type { ClientGenerationMode } from '../services/generator';

interface HeaderProps {
  generationMode?: ClientGenerationMode;
}

export function Header({ generationMode = 'mock' }: HeaderProps) {
  return (
    <header className="app-header">
      <div className="brand" aria-label="NewsPilot AI">
        <span className="brand__mark" aria-hidden="true">
          <NewspaperClipping weight="bold" />
        </span>
        <div className="brand__copy">
          <div className="brand__name">
            NewsPilot
          </div>
          <p>AI 新闻选题与采访策划助手</p>
        </div>
      </div>

      <div className="app-header__meta" aria-label="应用状态">
        <span className="app-header__label">选题研究工具</span>
        <span className="mode-badge">
          {generationMode === 'local-ai' ? '本地 AI' : 'Demo 模式'}
        </span>
      </div>
    </header>
  );
}
