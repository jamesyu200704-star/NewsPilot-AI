import {
  ArrowRight,
  LockKey,
  MagicWand,
  SpinnerGap,
  WarningCircle,
} from '@phosphor-icons/react';
import type { FormEvent } from 'react';
import type { ClientGenerationMode } from '../services/generator';
import type { ProviderPresentation } from '../services/providerStatus';
import type { BriefInput } from '../types';
import { ExampleTopics } from './ExampleTopics';

interface TopicFormProps {
  value: BriefInput;
  error: string;
  generationError: string;
  isLoading: boolean;
  generationMode?: ClientGenerationMode;
  providerPresentation: ProviderPresentation;
  onChange: (nextValue: BriefInput) => void;
  onGenerationModeChange: (nextMode: ClientGenerationMode) => void;
  onSubmit: () => void;
}

const reportTypes = ['消息', '特写', '深度报道', '评论'];

export function TopicForm({
  value,
  error,
  generationError,
  isLoading,
  generationMode = 'mock',
  providerPresentation,
  onChange,
  onGenerationModeChange,
  onSubmit,
}: TopicFormProps) {
  const updateField = <Key extends keyof BriefInput>(
    field: Key,
    fieldValue: BriefInput[Key],
  ) => {
    onChange({ ...value, [field]: fieldValue });
  };

  const handleSubmit = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    onSubmit();
  };

  return (
    <section className="input-panel" aria-labelledby="assignment-title">
      <header className="input-panel__header">
        <span className="section-kicker">从主题开始</span>
        <h1 id="assignment-title">你想报道什么？</h1>
        <p>把一个模糊想法，拆成三个能采访、能核查、能继续推进的报道角度。</p>
      </header>

      <form className="topic-form" onSubmit={handleSubmit} noValidate>
        <fieldset className="field generation-modes">
          <legend>生成方式</legend>
          <div className="generation-modes__options">
            <label>
              <input
                type="radio"
                name="generationMode"
                value="mock"
                checked={generationMode === 'mock'}
                onChange={() => onGenerationModeChange('mock')}
                disabled={isLoading}
              />
              <span>
                <strong>Demo 模式</strong>
                <small>浏览器本地模拟，无需配置模型</small>
              </span>
            </label>
            <label>
              <input
                type="radio"
                name="generationMode"
                value="local-ai"
                checked={generationMode === 'local-ai'}
                onChange={() => onGenerationModeChange('local-ai')}
                disabled={isLoading || providerPresentation.optionDisabled}
              />
              <span>
                <strong>{providerPresentation.optionTitle}</strong>
                <small>{providerPresentation.optionDescription}</small>
              </span>
            </label>
          </div>
        </fieldset>

        <div className="field field--topic">
            <label htmlFor="topic">
              新闻主题
              <span aria-hidden="true">*</span>
            </label>
            <textarea
              id="topic"
              name="topic"
              rows={2}
              value={value.topic}
              onChange={(event) => updateField('topic', event.target.value)}
              placeholder="例如：大学生使用生成式 AI 完成课程作业"
              aria-describedby={error ? 'topic-error' : 'topic-help'}
              aria-invalid={Boolean(error)}
              disabled={isLoading}
              maxLength={120}
              required
              autoFocus
            />
            <div className="field__under">
              {error ? (
                <p className="field__error" id="topic-error" role="alert">
                  {error}
                </p>
              ) : (
                <p className="field__help" id="topic-help">
                  先写清“谁 + 发生了什么”，方案会更具体。
                </p>
              )}
              <span>{value.topic.length}/120</span>
            </div>
            <ExampleTopics
              onSelect={(topic) => updateField('topic', topic)}
              disabled={isLoading}
            />
        </div>

          <fieldset className="field report-types">
            <legend>报道类型</legend>
            <div className="report-types__options">
              {reportTypes.map((type) => (
                <label key={type}>
                  <input
                    type="radio"
                    name="reportType"
                    value={type}
                    checked={value.reportType === type}
                    onChange={(event) => updateField('reportType', event.target.value)}
                    disabled={isLoading}
                  />
                  <span>{type}</span>
                </label>
              ))}
            </div>
          </fieldset>

          <div className="topic-form__row">
            <div className="field">
              <label htmlFor="audience">目标受众</label>
              <input
                id="audience"
                name="audience"
                type="text"
                value={value.audience}
                onChange={(event) => updateField('audience', event.target.value)}
                placeholder="例如：高校学生"
                disabled={isLoading}
                maxLength={40}
              />
            </div>
            <div className="field">
              <label htmlFor="scope">报道范围</label>
              <input
                id="scope"
                name="scope"
                type="text"
                value={value.scope}
                onChange={(event) => updateField('scope', event.target.value)}
                placeholder="例如：校园、全国、高校群体"
                disabled={isLoading}
                maxLength={40}
              />
            </div>
          </div>

          <div className="field">
            <label htmlFor="background">
              补充背景
              <span className="field__optional">选填</span>
            </label>
            <textarea
              id="background"
              name="background"
              rows={4}
              value={value.background}
              onChange={(event) => updateField('background', event.target.value)}
              placeholder="补充已知事实、现场线索或希望重点追问的问题。请勿填写无关敏感个人信息。"
              disabled={isLoading}
              maxLength={600}
            />
          </div>

          {generationError ? (
            <div className="generation-error" role="alert">
              <WarningCircle aria-hidden="true" weight="fill" />
              <p>{generationError}</p>
            </div>
          ) : null}

          <div className="topic-form__footer">
            <button
              className="generate-button"
              type="submit"
              disabled={
                isLoading ||
                (generationMode === 'local-ai' &&
                  providerPresentation.optionDisabled)
              }
            >
              <span className="generate-button__icon" aria-hidden="true">
                {isLoading ? (
                  <SpinnerGap className="spin" weight="bold" />
                ) : (
                  <MagicWand weight="bold" />
                )}
              </span>
              <span>{isLoading ? '工作流运行中...' : '生成新闻策划报告'}</span>
              <ArrowRight className="generate-button__arrow" aria-hidden="true" weight="bold" />
            </button>
            <p>
              <LockKey aria-hidden="true" weight="bold" />
              {generationMode === 'local-ai'
                ? providerPresentation.privacyNotice
                : '所有内容在本地模拟生成，不会上传或保存。'}
            </p>
          </div>
      </form>
    </section>
  );
}
