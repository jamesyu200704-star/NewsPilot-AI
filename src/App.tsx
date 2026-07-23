import { useEffect, useRef, useState } from 'react';
import { EmptyState } from './components/EmptyState';
import { Header } from './components/Header';
import { LoadingState } from './components/LoadingState';
import { ResultSection } from './components/ResultSection';
import { TopicForm } from './components/TopicForm';
import { clientGenerationMode, generateBrief } from './services/generator';
import type { BriefInput, GenerationResult } from './types';

const initialBrief: BriefInput = {
  topic: '',
  reportType: '深度报道',
  audience: '高校学生',
  scope: '校园',
  background: '',
};

export default function App() {
  const [brief, setBrief] = useState<BriefInput>(initialBrief);
  const [result, setResult] = useState<GenerationResult | null>(null);
  const [generatedBrief, setGeneratedBrief] = useState<BriefInput | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState('');
  const [generationError, setGenerationError] = useState('');
  const resultRegionRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!result || !resultRegionRef.current) {
      return;
    }

    const reduceMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    resultRegionRef.current.scrollIntoView({
      behavior: reduceMotion ? 'auto' : 'smooth',
      block: 'start',
    });

    window.setTimeout(() => {
      resultRegionRef.current?.querySelector<HTMLElement>('#results-title')?.focus({
        preventScroll: true,
      });
    }, reduceMotion ? 0 : 450);
  }, [result]);

  const handleBriefChange = (nextBrief: BriefInput) => {
    setBrief(nextBrief);
    if (error && nextBrief.topic.trim()) {
      setError('');
    }
    if (generationError) {
      setGenerationError('');
    }
  };

  const handleGenerate = async () => {
    if (!brief.topic.trim()) {
      setError('请输入新闻主题。');
      document.querySelector<HTMLTextAreaElement>('#topic')?.focus();
      return;
    }

    setError('');
    setGenerationError('');
    setIsLoading(true);
    setResult(null);

    try {
      const submittedBrief = {
        ...brief,
        topic: brief.topic.trim().replace(/\s+/g, ' '),
      };
      const generatedResult = await generateBrief(submittedBrief);
      setGeneratedBrief(submittedBrief);
      setResult(generatedResult);
    } catch {
      setGenerationError('生成失败，请稍后重试。');
    } finally {
      setIsLoading(false);
    }
  };

  const handleExampleSelect = (topic: string) => {
    handleBriefChange({ ...brief, topic });
    window.requestAnimationFrame(() => {
      document.querySelector<HTMLTextAreaElement>('#topic')?.focus();
    });
  };

  return (
    <div className="app-shell">
      <Header generationMode={clientGenerationMode} />
      <main className="workspace">
        <div className="input-workspace">
          <TopicForm
            value={brief}
            error={error}
            generationError={generationError}
            isLoading={isLoading}
            generationMode={clientGenerationMode}
            onChange={handleBriefChange}
            onSubmit={handleGenerate}
          />
        </div>

        <div className="result-region" ref={resultRegionRef} aria-live="polite">
          {isLoading ? (
            <LoadingState />
          ) : result && generatedBrief ? (
            <ResultSection input={generatedBrief} result={result} />
          ) : (
            <EmptyState
              onSelect={handleExampleSelect}
              disabled={isLoading}
              generationMode={clientGenerationMode}
            />
          )}
        </div>
      </main>

      <footer className="site-footer">
        <span>NewsPilot AI</span>
        <p>
          {clientGenerationMode === 'api'
            ? '输入经服务端处理，生成内容需独立核验'
            : '本地模拟，不上传数据，生成内容需独立核验'}
        </p>
      </footer>
    </div>
  );
}
