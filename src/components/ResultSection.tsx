import {
  Check,
  Copy,
  DownloadSimple,
  WarningCircle,
} from '@phosphor-icons/react';
import { useEffect, useRef, useState } from 'react';
import type { BriefInput, GenerationResult } from '../types';
import { copyText } from '../utils/copy';
import {
  buildMarkdown,
  exportMarkdown,
  storyAngleToMarkdown,
} from '../utils/markdownExport';
import { StoryAngleCard } from './StoryAngleCard';

interface ResultSectionProps {
  input: BriefInput;
  result: GenerationResult;
}

const formatTime = (value: string) =>
  new Intl.DateTimeFormat('zh-CN', {
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
  }).format(new Date(value));

export function ResultSection({ input, result }: ResultSectionProps) {
  const [copiedId, setCopiedId] = useState<string | null>(null);
  const [feedback, setFeedback] = useState('');
  const feedbackTimer = useRef<number | undefined>(undefined);

  useEffect(
    () => () => {
      window.clearTimeout(feedbackTimer.current);
    },
    [],
  );

  const showFeedback = (message: string, copiedItem: string | null = null) => {
    window.clearTimeout(feedbackTimer.current);
    setFeedback(message);
    setCopiedId(copiedItem);
    feedbackTimer.current = window.setTimeout(() => {
      setFeedback('');
      setCopiedId(null);
    }, 1800);
  };

  const handleCopy = async (text: string, id: string) => {
    try {
      await copyText(text);
      showFeedback('复制成功。', id);
    } catch {
      showFeedback('复制失败，请检查浏览器权限。');
    }
  };

  const handleExport = () => {
    exportMarkdown(input, result);
    showFeedback('Markdown 文件已导出。');
  };

  return (
    <section className="results" aria-labelledby="results-title">
      <header className="results__header">
        <div className="results__headline">
          <span className="section-kicker">策划结果</span>
          <h2 id="results-title" tabIndex={-1}>
            3 个报道角度
          </h2>
          <p>{result.topicSummary}</p>
        </div>

        <div className="results__toolbar">
          <div className="results__meta">
            {formatTime(result.generatedAt)} / {result.mode.toUpperCase()}
          </div>
          <div className="results__buttons">
            <button
              className="secondary-button"
              type="button"
              onClick={() => handleCopy(buildMarkdown(input, result), 'all')}
            >
              {copiedId === 'all' ? (
                <Check aria-hidden="true" weight="bold" />
              ) : (
                <Copy aria-hidden="true" weight="bold" />
              )}
              {copiedId === 'all' ? '复制成功' : '复制全部'}
            </button>
            <button className="primary-button" type="button" onClick={handleExport}>
              <DownloadSimple aria-hidden="true" weight="bold" />
              导出 Markdown
            </button>
          </div>
        </div>
      </header>

      {result.fallbackNotice ? (
        <div className="results__notice" role="status">
          <WarningCircle aria-hidden="true" weight="fill" />
          <p>{result.fallbackNotice}</p>
        </div>
      ) : null}

      <div className="results__cards">
        {result.angles.map((angle, index) => (
          <StoryAngleCard
            key={angle.id}
            angle={angle}
            index={index}
            copied={copiedId === angle.id}
            onCopy={() => handleCopy(storyAngleToMarkdown(angle, index), angle.id)}
          />
        ))}
      </div>

      <div className={'feedback ' + (feedback ? 'feedback--visible' : '')} role="status" aria-live="polite">
        {feedback}
      </div>
    </section>
  );
}
