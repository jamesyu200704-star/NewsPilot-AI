// @vitest-environment jsdom
import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { useState } from 'react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import type { ReportingBrief } from '../types';
import { ReportingBriefForm } from './报道任务表单';

afterEach(cleanup);

const createBrief = (rawTopic = ''): ReportingBrief => ({
  mode: 'course',
  rawTopic,
  assignmentType: '校园调查',
  courseName: '新闻采访与写作',
  targetLength: 2_000,
  minimumInterviewees: 3,
  geographicScope: '本校校园',
  targetAudience: '本校学生与教师',
  availableInterviewees: ['学生', '任课教师'],
  existingMaterials: [],
  reportingResources: ['1 名学生记者'],
  ethicalConstraints: ['采访前说明用途并征得同意'],
});

interface HarnessProps {
  initialTopic?: string;
  isLoading?: boolean;
  generationError?: string;
  onSubmit: () => void;
}

function FormHarness({
  initialTopic = '',
  isLoading = false,
  generationError = '',
  onSubmit,
}: HarnessProps) {
  const [brief, setBrief] = useState(() => createBrief(initialTopic));

  return (
    <ReportingBriefForm
      value={brief}
      depth="quick"
      error=""
      generationError={generationError}
      isLoading={isLoading}
      onChange={setBrief}
      onModeChange={() => undefined}
      onDepthChange={() => undefined}
      onSubmit={onSubmit}
      onExampleSelect={(topic) => setBrief((current) => ({ ...current, rawTopic: topic }))}
    />
  );
}

describe('新闻线索 Composer', () => {
  it('输入为空时禁用提交按钮且 Enter 不会提交', async () => {
    const onSubmit = vi.fn();
    render(<FormHarness onSubmit={onSubmit} />);

    const input = screen.getByRole('textbox', { name: /新闻线索或作业主题/ });
    const submit = screen.getByRole('button', { name: '开始拆选题' });
    expect((submit as HTMLButtonElement).disabled).toBe(true);

    await userEvent.setup().click(input);
    await userEvent.setup().keyboard('{Enter}');
    expect(onSubmit).not.toHaveBeenCalled();
  });

  it('输入内容后点击同一容器内的按钮可以提交', async () => {
    const onSubmit = vi.fn();
    render(<FormHarness initialTopic="校园夜间摆渡车调整" onSubmit={onSubmit} />);

    const input = screen.getByRole('textbox', { name: /新闻线索或作业主题/ });
    const submit = screen.getByRole('button', { name: '开始拆选题' });
    const composerControl = input.closest('[data-composer-control="true"]');

    expect(composerControl).not.toBeNull();
    expect(composerControl?.contains(submit)).toBe(true);
    await userEvent.setup().click(submit);
    expect(onSubmit).toHaveBeenCalledTimes(1);
  });

  it('Enter 提交，Shift + Enter 只插入换行', async () => {
    const onSubmit = vi.fn();
    const user = userEvent.setup();
    render(<FormHarness initialTopic="校园 AI 使用" onSubmit={onSubmit} />);
    const input = screen.getByRole('textbox', { name: /新闻线索或作业主题/ });

    await user.click(input);
    const textarea = input as HTMLTextAreaElement;
    textarea.setSelectionRange(textarea.value.length, textarea.value.length);
    await user.keyboard('{Shift>}{Enter}{/Shift}补充范围');
    expect(onSubmit).not.toHaveBeenCalled();
    expect((input as HTMLTextAreaElement).value).toBe('校园 AI 使用\n补充范围');

    await user.keyboard('{Enter}');
    expect(onSubmit).toHaveBeenCalledTimes(1);
  });

  it('中文输入法组合期间按 Enter 不会误提交', () => {
    const onSubmit = vi.fn();
    render(<FormHarness initialTopic="校园新闻线索" onSubmit={onSubmit} />);
    const input = screen.getByRole('textbox', { name: /新闻线索或作业主题/ });

    fireEvent.compositionStart(input);
    fireEvent.keyDown(input, { key: 'Enter', code: 'Enter', isComposing: true });
    fireEvent.compositionEnd(input);

    expect(onSubmit).not.toHaveBeenCalled();
  });

  it('Loading 状态禁用按钮并阻止重复提交', () => {
    const onSubmit = vi.fn();
    render(<FormHarness initialTopic="校园新闻线索" isLoading onSubmit={onSubmit} />);
    const input = screen.getByRole('textbox', { name: /新闻线索或作业主题/ });
    const submit = screen.getByRole('button', { name: '正在拆选题' });

    expect((submit as HTMLButtonElement).disabled).toBe(true);
    expect(submit.getAttribute('aria-busy')).toBe('true');
    fireEvent.click(submit);
    fireEvent.keyDown(input, { key: 'Enter', code: 'Enter' });
    expect(onSubmit).not.toHaveBeenCalled();
  });

  it('生成失败后保留输入内容并恢复可提交状态', () => {
    const onSubmit = vi.fn();
    render(
      <FormHarness
        initialTopic="保留这条新闻线索"
        generationError="策划生成失败，请稍后重试。"
        onSubmit={onSubmit}
      />,
    );

    expect(
      (screen.getByRole('textbox', { name: /新闻线索或作业主题/ }) as HTMLTextAreaElement)
        .value,
    ).toBe('保留这条新闻线索');
    expect(
      (screen.getByRole('button', { name: '开始拆选题' }) as HTMLButtonElement).disabled,
    ).toBe(false);
    expect(screen.getByRole('alert').textContent).toContain('策划生成失败');
  });

  it('按钮提供稳定的可访问名称', () => {
    render(<FormHarness initialTopic="校园新闻线索" onSubmit={() => undefined} />);
    expect(
      screen.getByRole('button', { name: '开始拆选题' }).getAttribute('aria-label'),
    ).toBe('开始拆选题');
  });
});
