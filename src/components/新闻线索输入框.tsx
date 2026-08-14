import { ArrowUp, SpinnerGap } from '@phosphor-icons/react';
import {
  useCallback,
  useLayoutEffect,
  useRef,
  type ChangeEvent,
  type KeyboardEvent,
} from 'react';

const MIN_HEIGHT = 56;
const MAX_HEIGHT = 160;

export interface NewsLeadComposerProps {
  value: string;
  onChange: (value: string) => void;
  onSubmit: () => void;
  disabled?: boolean;
  loading?: boolean;
  error?: string;
  placeholder?: string;
}

export function NewsLeadComposer({
  value,
  onChange,
  onSubmit,
  disabled = false,
  loading = false,
  error = '',
  placeholder = '输入一个新闻线索，例如：大学生使用生成式 AI 完成课程作业',
}: NewsLeadComposerProps) {
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const composingRef = useRef(false);
  const cannotSubmit = disabled || loading || !value.trim();

  const resizeTextarea = useCallback((textarea: HTMLTextAreaElement | null) => {
    if (!textarea) return;
    textarea.style.height = 'auto';
    const contentHeight = Math.max(textarea.scrollHeight, MIN_HEIGHT);
    textarea.style.height = `${Math.min(contentHeight, MAX_HEIGHT)}px`;
    textarea.style.overflowY = contentHeight > MAX_HEIGHT ? 'auto' : 'hidden';
  }, []);

  useLayoutEffect(() => {
    resizeTextarea(textareaRef.current);
  }, [resizeTextarea, value]);

  const submit = () => {
    if (cannotSubmit) return;
    onSubmit();
  };

  const handleChange = (event: ChangeEvent<HTMLTextAreaElement>) => {
    onChange(event.target.value);
    resizeTextarea(event.target);
  };

  const handleKeyDown = (event: KeyboardEvent<HTMLTextAreaElement>) => {
    const isComposing = composingRef.current || event.nativeEvent.isComposing;
    if (event.key !== 'Enter' || event.shiftKey || isComposing) return;
    event.preventDefault();
    submit();
  };

  return (
    <div className="news-lead-composer">
      <label className="news-lead-composer__label" htmlFor="raw-topic">
        你手上的新闻线索或作业主题 <em>必填</em>
      </label>
      <div
        className="news-lead-composer__control"
        data-composer-control="true"
        data-error={Boolean(error)}
        data-loading={loading}
      >
        <textarea
          ref={textareaRef}
          className="news-lead-composer__input"
          id="raw-topic"
          rows={1}
          value={value}
          placeholder={placeholder}
          aria-describedby={error ? 'news-lead-error' : 'news-lead-help'}
          aria-invalid={Boolean(error)}
          disabled={disabled || loading}
          enterKeyHint="send"
          onChange={handleChange}
          onKeyDown={handleKeyDown}
          onCompositionStart={() => {
            composingRef.current = true;
          }}
          onCompositionEnd={() => {
            composingRef.current = false;
          }}
        />
        <button
          className="news-lead-composer__submit"
          type="button"
          aria-label={loading ? '正在拆选题' : '开始拆选题'}
          aria-busy={loading}
          disabled={cannotSubmit}
          onClick={submit}
        >
          {loading ? (
            <SpinnerGap className="news-lead-composer__spinner" weight="bold" aria-hidden="true" />
          ) : (
            <ArrowUp weight="bold" aria-hidden="true" />
          )}
          <span className="news-lead-composer__button-label">
            {loading ? '正在拆题…' : '开始拆选题'}
          </span>
        </button>
      </div>
      {error ? (
        <p className="news-lead-composer__error" id="news-lead-error" role="alert">
          {error}
        </p>
      ) : (
        <p className="news-lead-composer__hint" id="news-lead-help">
          Enter 提交 · Shift + Enter 换行
        </p>
      )}
    </div>
  );
}
