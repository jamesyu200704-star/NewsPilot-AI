// @vitest-environment jsdom
import { cleanup, render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { createEmptyEvidenceWorkspace } from '../../shared/证据工作区';
import type { ReportingBrief } from '../types';
import { EvidenceWorkbench } from './证据工作台';

const brief: ReportingBrief = {
  mode: 'course', rawTopic: '很多学生使用 AI 违规完成课程作业', assignmentType: '校园调查',
  geographicScope: '本校', targetAudience: '本校师生', availableInterviewees: ['学生', '教师'],
  existingMaterials: [], reportingResources: ['手机录音'], ethicalConstraints: ['匿名保护学生'],
};

afterEach(cleanup);

describe('P1 证据工作台', () => {
  it('覆盖主张、搜索计划、模拟搜索、手动来源、证据绑定、矩阵和导出路径', async () => {
    const user = userEvent.setup();
    const onChange = vi.fn();
    render(
      <EvidenceWorkbench
        projectId="project-1"
        projectName="AI 作业调查"
        brief={brief}
        value={createEmptyEvidenceWorkspace('2026-08-13T00:00:00.000Z')}
        demoMode
        onChange={onChange}
      />,
    );

    expect(screen.getAllByText(/待核实/u).length).toBeGreaterThan(0);
    expect(screen.getByText(/当前为模拟检索/u)).toBeTruthy();
    expect(screen.getAllByText(/C-001/u).length).toBeGreaterThan(0);

    const query = screen.getAllByLabelText(/检索词/u)[0];
    await user.clear(query);
    await user.type(query, 'site:edu.cn 生成式人工智能 作业规定');
    await user.click(screen.getAllByRole('button', { name: '执行此检索' })[0]);
    expect(await screen.findByText(/模拟来源卡/u)).toBeTruthy();
    expect(screen.getAllByText(/不代表真实网络搜索/u).length).toBeGreaterThan(0);

    await user.click(screen.getByRole('button', { name: '添加手动来源' }));
    await user.type(screen.getByLabelText('来源标题'), '学校课程规定原文');
    await user.type(screen.getByLabelText('发布机构'), '学校教务处');
    await user.type(screen.getByLabelText('来源 URL'), 'https://example.edu/policy');
    await user.type(
      screen.getByLabelText('来源文本'),
      '第一条：教师可以根据课程目标规定生成式 AI 的使用边界。',
    );
    await user.click(screen.getByRole('button', { name: '保存手动来源' }));
    expect(screen.getByText('学校课程规定原文')).toBeTruthy();

    const evidenceRow = screen.getByTestId(/evidence-row/u);
    await user.selectOptions(within(evidenceRow).getByLabelText('绑定主张'), 'C-001');
    await user.selectOptions(within(evidenceRow).getByLabelText('证据关系'), 'contradicts');
    await user.click(within(evidenceRow).getByRole('button', { name: '确认这条证据' }));

    expect(screen.getByText(/证据矩阵/u)).toBeTruthy();
    expect(screen.getAllByText(/unverified|待核实/u).length).toBeGreaterThan(0);
    expect(screen.getByRole('button', { name: '导出证据 JSON' })).toBeTruthy();
    expect(screen.getByRole('button', { name: '导出带引用策划案' })).toBeTruthy();
    expect(onChange).toHaveBeenCalled();
  });

  it('手机模式提供主张、来源、核验三个 Tab', async () => {
    const user = userEvent.setup();
    render(
      <EvidenceWorkbench
        projectId="project-1"
        projectName="测试"
        brief={brief}
        value={createEmptyEvidenceWorkspace()}
        demoMode
        onChange={vi.fn()}
      />,
    );
    expect(screen.getByRole('tab', { name: '主张' })).toBeTruthy();
    expect(screen.getByRole('tab', { name: '来源' })).toBeTruthy();
    expect(screen.getByRole('tab', { name: '核验' })).toBeTruthy();
    await user.click(screen.getByRole('tab', { name: '来源' }));
    expect(screen.getByRole('tabpanel', { name: '来源' })).toBeTruthy();
  });

  it('完成上传材料、分类、绑定、来源冲突与带 Evidence ID 导出流程', async () => {
    const user = userEvent.setup();
    const createObjectURL = vi.fn(() => 'blob:newspilot-evidence');
    Object.defineProperty(URL, 'createObjectURL', { configurable: true, value: createObjectURL });
    Object.defineProperty(URL, 'revokeObjectURL', { configurable: true, value: vi.fn() });
    vi.spyOn(HTMLAnchorElement.prototype, 'click').mockImplementation(() => undefined);
    render(
      <EvidenceWorkbench
        projectId="project-e2e"
        projectName="证据流程"
        brief={brief}
        value={createEmptyEvidenceWorkspace()}
        demoMode
        onChange={vi.fn()}
      />,
    );

    await user.click(screen.getByRole('tab', { name: '来源' }));
    await user.upload(
      screen.getByLabelText(/导入本地材料/u),
      new File(['学校文件明确允许教师规定课程内 AI 使用边界。'], '校规.txt', { type: 'text/plain' }),
    );
    expect((await screen.findAllByText('校规.txt')).length).toBeGreaterThan(0);

    const uploadedCard = screen.getByRole('heading', { name: '校规.txt' }).closest('.source-ledger-card') as HTMLElement;
    await user.selectOptions(within(uploadedCard).getByRole('combobox', { name: /来源类型/u }), 'primary_document');
    await user.selectOptions(within(uploadedCard).getByRole('combobox', { name: /来源等级/u }), 'A');
    await user.type(within(uploadedCard).getByRole('textbox', { name: /分类理由/u }), '学校正式文件原件');
    await user.click(within(uploadedCard).getByRole('button', { name: '保存分类历史' }));
    await user.selectOptions(within(uploadedCard).getByLabelText('绑定主张'), 'C-001');
    await user.selectOptions(within(uploadedCard).getByLabelText('证据关系'), 'supports');
    await user.click(within(uploadedCard).getByRole('button', { name: '确认这条证据' }));
    await user.click(screen.getAllByLabelText('我确认这是可按事实核查的主张')[0]);

    await user.click(screen.getByRole('button', { name: '添加手动来源' }));
    await user.type(screen.getByLabelText('来源标题'), '课程教师书面要求');
    await user.type(screen.getByLabelText('发布机构'), '课程教师');
    await user.type(screen.getByLabelText('来源文本'), '本课程书面要求明确禁止任何作业使用生成式 AI。');
    await user.click(screen.getByRole('button', { name: '保存手动来源' }));
    const manualCard = screen.getByText('课程教师书面要求').closest('.source-ledger-card') as HTMLElement;
    await user.selectOptions(within(manualCard).getByRole('combobox', { name: /来源类型/u }), 'interview_material');
    await user.selectOptions(within(manualCard).getByRole('combobox', { name: /来源等级/u }), 'A');
    await user.type(within(manualCard).getByRole('textbox', { name: /分类理由/u }), '已核对原始课程说明');
    await user.click(within(manualCard).getByRole('button', { name: '保存分类历史' }));
    await user.selectOptions(within(manualCard).getByLabelText('绑定主张'), 'C-001');
    await user.selectOptions(within(manualCard).getByLabelText('证据关系'), 'contradicts');
    await user.click(within(manualCard).getByRole('button', { name: '确认这条证据' }));

    await user.click(screen.getByRole('tab', { name: '核验' }));
    expect(screen.getAllByText(/conflicted|有冲突/u).length).toBeGreaterThan(0);
    expect(screen.getByText(/系统不自动裁决/u)).toBeTruthy();
    await user.click(screen.getByRole('button', { name: '导出带引用策划案' }));
    expect(createObjectURL).toHaveBeenCalled();
  });
});
