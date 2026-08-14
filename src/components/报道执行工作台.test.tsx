// @vitest-environment jsdom
import { useState } from 'react';
import { cleanup, render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, describe, expect, it } from 'vitest';
import { createStudentReportingPlan } from '../../shared/学生报道工作流';
import type { ReportingBrief } from '../../shared/学生报道模型';
import { createExecutionWorkspaceFromPlan } from '../../shared/报道执行工作区';
import { createEmptyEvidenceWorkspace } from '../../shared/证据工作区';
import { ReportingExecutionWorkbench } from './报道执行工作台';

afterEach(cleanup);

const brief: ReportingBrief = {
  mode: 'course', rawTopic: '校园门禁新规实施情况', assignmentType: '校园调查', deadline: '2026-08-20T23:59:00.000Z', minimumInterviewees: 2,
  availableInterviewees: ['学生', '学校管理者'], existingMaterials: ['公开通知'], reportingResources: ['学生记者'], ethicalConstraints: ['录音前征得同意'],
  requiresDifferentSourceTypes: true, requiresHumanStory: true, requiresInterviewOutline: true, requiresPlanningDocument: true, requiresInterviewSummary: true, formatRequirements: 'DOCX',
};

function Harness() {
  const plan = createStudentReportingPlan(brief);
  const [execution, setExecution] = useState(() => createExecutionWorkspaceFromPlan(plan, '2026-08-13T08:00:00.000Z'));
  const [evidence, setEvidence] = useState(() => createEmptyEvidenceWorkspace('2026-08-13T08:00:00.000Z'));
  return <ReportingExecutionWorkbench projectName="门禁调查" brief={brief} plan={plan} value={execution} onChange={setExecution} evidenceWorkspace={evidence} onEvidenceChange={setEvidence} evidencePanel={<div>证据工作台主体</div>} />;
}

describe('报道执行工作台', () => {
  it('九个独立页面按导航切换，不把所有内容堆在一屏', async () => {
    const user = userEvent.setup();
    render(<Harness />);
    expect(screen.getByRole('heading', { name: '先处理最影响交付的三件事' })).toBeTruthy();
    expect(screen.queryByRole('heading', { name: '把截止时间拆成可完成、可阻塞、可验收的任务' })).toBeNull();

    await user.click(screen.getByRole('button', { name: /任务倒排与依赖/u }));
    expect(screen.getByRole('heading', { name: '把截止时间拆成可完成、可阻塞、可验收的任务' })).toBeTruthy();
    expect(screen.queryByRole('heading', { name: '先处理最影响交付的三件事' })).toBeNull();

    await user.click(screen.getByRole('button', { name: /证据缺口与核验/u }));
    expect(screen.getByText('证据工作台主体')).toBeTruthy();
  });

  it('采访模式在缺少同意与归因时阻止开始', async () => {
    const user = userEvent.setup();
    render(<Harness />);
    await user.click(screen.getByRole('button', { name: /采访记录笔记与转写/u }));
    await user.click(screen.getByRole('button', { name: /开始采访/u }));
    expect(screen.getByRole('status').textContent).toMatch(/确认材料使用和归因边界/u);

    await user.click(screen.getByRole('checkbox', { name: /允许使用采访材料/u }));
    await user.click(screen.getByRole('checkbox', { name: /已确认.*归因/u }));
    await user.click(screen.getByRole('button', { name: /开始采访/u }));
    expect(screen.getByText(/当前问题/u)).toBeTruthy();
    expect(screen.getByText(/不会录音/u)).toBeTruthy();
  });

  it('导出按钮在隐私清单未确认前保持禁用', async () => {
    const user = userEvent.setup();
    render(<Harness />);
    await user.click(screen.getByRole('button', { name: /导出DOCX 与包/u }));
    const buttons = screen.getAllByRole('button', { name: /生成并下载/u });
    expect(buttons.length).toBe(9);
    expect(buttons.every((button) => button.hasAttribute('disabled'))).toBe(true);
    const checks = screen.getAllByRole('checkbox');
    expect(checks.length).toBe(6);
  });

  it('尚未运行自查时也会实时识别阻断项并拒绝生成完整提交包', async () => {
    const user = userEvent.setup();
    render(<Harness />);
    await user.click(screen.getByRole('button', { name: /导出DOCX 与包/u }));
    for (const checkbox of screen.getAllByRole('checkbox')) await user.click(checkbox);

    const packageCard = screen.getByRole('heading', { name: '完整提交包' }).closest('article');
    expect(packageCard).toBeTruthy();
    await user.click(packageCard!.querySelector('button')!);

    expect(screen.getByRole('status').textContent).toMatch(/blocking 项，请先处理/u);
  });
});
