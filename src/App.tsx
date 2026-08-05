import { useEffect, useRef, useState } from 'react';
import { EmptyState } from './components/EmptyState';
import { Header } from './components/Header';
import { LoadingState } from './components/LoadingState';
import { ResultSection } from './components/ResultSection';
import { TopicForm } from './components/TopicForm';
import {
  clientGenerationMode,
  generateBrief,
  type ClientGenerationMode,
} from './services/generator';
import {
  checkingProviderStatus,
  detectGenerationProvider,
  getProviderPresentation,
  resolveGenerationMode,
  shouldDetectGenerationProvider,
  unavailableProviderStatus,
} from './services/providerStatus';
import type { BriefInput, GenerationResult } from './types';

const PROVIDER_HEALTH_ENDPOINT = '/api/health';
const PROVIDER_HEALTH_TIMEOUT_MS = 3_000;
const shouldDetectProvider = shouldDetectGenerationProvider(
  clientGenerationMode,
  import.meta.env.PROD,
);

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
  const [generationMode, setGenerationMode] =
    useState<ClientGenerationMode>(clientGenerationMode);
  const [providerStatus, setProviderStatus] = useState(
    shouldDetectProvider ? checkingProviderStatus : unavailableProviderStatus,
  );
  const resultRegionRef = useRef<HTMLDivElement>(null);
  const providerPresentation = getProviderPresentation(providerStatus);
  const aiGenerationUnavailable =
    generationMode === 'local-ai' && providerStatus.state !== 'ready';

  useEffect(() => {
    if (!shouldDetectProvider) {
      return;
    }

    let isCurrent = true;

    void detectGenerationProvider({
      endpoint: PROVIDER_HEALTH_ENDPOINT,
      timeoutMs: PROVIDER_HEALTH_TIMEOUT_MS,
    }).then((nextStatus) => {
      if (!isCurrent) {
        return;
      }

      setProviderStatus(nextStatus);
      setGenerationMode((currentMode) =>
        resolveGenerationMode(currentMode, nextStatus),
      );
    });

    return () => {
      isCurrent = false;
    };
  }, []);

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

    if (aiGenerationUnavailable) {
      setGenerationMode('mock');
      setGenerationError('AI 生成服务尚未就绪，已切换到 Demo 模式。');
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
      const generatedResult = await generateBrief(submittedBrief, generationMode);
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

  const handleGenerationModeChange = (nextMode: ClientGenerationMode) => {
    if (nextMode === 'local-ai' && providerPresentation.optionDisabled) {
      return;
    }

    setGenerationMode(nextMode);
    setGenerationError('');
  };

  return (
    <div className="app-shell">
      <Header
        generationMode={generationMode}
        providerPresentation={providerPresentation}
      />
      <main className="workspace">
        <div className="input-workspace">
          <TopicForm
            value={brief}
            error={error}
            generationError={generationError}
            isLoading={isLoading}
            generationMode={generationMode}
            providerPresentation={providerPresentation}
            onChange={handleBriefChange}
            onGenerationModeChange={handleGenerationModeChange}
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
              generationMode={generationMode}
              providerPresentation={providerPresentation}
            />
          )}
        </div>
      </main>

      <footer className="site-footer">
        <span>NewsPilot AI</span>
        <p>
          {generationMode === 'local-ai'
            ? providerPresentation.footerNotice
            : '本地模拟，不上传数据，生成内容需独立核验'}
        </p>
      </footer>
    </div>
  );
}
