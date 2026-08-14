// @vitest-environment jsdom
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';
import type { ReportingBrief } from '../types';
import { AssignmentRequirementParser } from './作业要求解析器';

const brief: ReportingBrief = {
  mode: 'course',
  rawTopic: '',
  assignmentType: '校园调查',
  targetLength: 1800,
  minimumInterviewees: 3,
  availableInterviewees: [],
  existingMaterials: [],
  reportingResources: [],
  ethicalConstraints: [],
};

describe('作业要求解析器', () => {
  it('要求用户确认后才把解析结果应用到 ReportingBrief', async () => {
    const user = userEvent.setup();
    const onApply = vi.fn();
    render(<AssignmentRequirementParser brief={brief} onApply={onApply} />);

    await user.type(
      screen.getByRole('textbox', { name: '课程作业要求原文' }),
      '完成一篇 2500 字人物特稿，至少采访 4 人，提交采访提纲。',
    );
    await user.click(screen.getByRole('button', { name: '解析要求' }));

    expect(screen.getByText('原文依据')).toBeTruthy();
    expect(screen.getByText('需要确认')).toBeTruthy();
    expect(
      screen.getByRole('button', { name: '应用已确认要求' }).hasAttribute('disabled'),
    ).toBe(true);

    await user.click(screen.getByRole('checkbox', { name: /字数要求/u }));
    await user.click(screen.getByRole('checkbox', { name: /最少采访人数/u }));
    await user.click(screen.getByRole('button', { name: '应用已确认要求' }));

    expect(onApply).toHaveBeenCalledTimes(1);
    expect(onApply.mock.calls[0][0].targetLength).toBe(2500);
    expect(onApply.mock.calls[0][0].minimumInterviewees).toBe(4);
    expect(onApply.mock.calls[0][0].assignmentType).toBe('校园调查');
  });
});
