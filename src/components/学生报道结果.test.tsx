// @vitest-environment jsdom
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';
import { createStudentReportingPlan } from '../../shared/学生报道工作流.js';
import type { ReportingBrief } from '../types';
import { StudentReportingResults } from './学生报道结果';

const brief: ReportingBrief = {
  mode: 'course',
  rawTopic: '校园门禁新规对晚归学生的影响',
  assignmentType: '校园调查',
  deadline: '2026-08-30',
  minimumInterviewees: 3,
  availableInterviewees: ['学生', '宿管', '保卫处'],
  existingMaterials: ['门禁通知'],
  reportingResources: ['手机录音'],
  ethicalConstraints: ['匿名保护学生'],
};

describe('快速策划结果', () => {
  it('只展示七类决策信息并通过进入完整策划切换模式', async () => {
    const user = userEvent.setup();
    const onDepthChange = vi.fn();
    const plan = createStudentReportingPlan(brief);
    render(
      <StudentReportingResults
        plan={plan}
        step={2}
        depth="quick"
        selectedAngleId={plan.recommendedAngleId}
        onSelectedAngleChange={vi.fn()}
        onStepChange={vi.fn()}
        onDepthChange={onDepthChange}
      />,
    );

    expect(screen.getByText('推荐的新闻问题')).toBeTruthy();
    expect(screen.getByText('最先查找的 3 项资料')).toBeTruthy();
    expect(screen.getByText('最大风险')).toBeTruthy();
    expect(screen.queryByText('采访问题阶梯')).toBeNull();
    expect(screen.queryByText('把关键说法放进证据矩阵')).toBeNull();
    expect(screen.queryByRole('button', { name: '复制策划案' })).toBeNull();
    expect(screen.queryByRole('button', { name: '导出 Markdown' })).toBeNull();

    await user.click(screen.getByRole('button', { name: '进入完整策划' }));
    expect(onDepthChange).toHaveBeenCalledWith('full');
  });
});
