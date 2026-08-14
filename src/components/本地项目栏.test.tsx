// @vitest-environment jsdom
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';
import type { LocalReportingProject } from '../../shared/本地项目模型';
import { LocalProjectBar } from './本地项目栏';
import { createEmptyEvidenceWorkspace } from '../../shared/证据工作区';
import { createEmptyExecutionWorkspace } from '../../shared/报道执行工作区';

const project: LocalReportingProject = {
  dataVersion: 3,
  id: 'project-1',
  name: '食堂价格调查',
  brief: {
    mode: 'course',
    rawTopic: '食堂价格变化',
    assignmentType: '校园调查',
    availableInterviewees: [],
    existingMaterials: [],
    reportingResources: [],
    ethicalConstraints: [],
  },
  plan: null,
  selectedAngleId: '',
  evidenceWorkspace: createEmptyEvidenceWorkspace('2026-08-12T11:00:00.000Z'),
  executionWorkspace: createEmptyExecutionWorkspace('2026-08-12T11:00:00.000Z'),
  createdAt: '2026-08-12T10:00:00.000Z',
  updatedAt: '2026-08-12T11:00:00.000Z',
};

describe('本地项目栏', () => {
  it('明确本机保存并提供项目生命周期操作', async () => {
    const user = userEvent.setup();
    const onCreate = vi.fn();
    const onRename = vi.fn();
    const onDelete = vi.fn();
    render(
      <LocalProjectBar
        projects={[project]}
        currentProjectId={project.id}
        autosaveStatus="已自动保存"
        notice=""
        onOpen={vi.fn()}
        onCreate={onCreate}
        onRename={onRename}
        onDuplicate={vi.fn()}
        onDelete={onDelete}
        onDeleteAll={vi.fn()}
        onExport={vi.fn()}
        onImport={vi.fn()}
      />,
    );

    expect(screen.getByText(/只保存在当前设备的这个浏览器/u)).toBeTruthy();
    expect(screen.getByLabelText('导入项目文件').getAttribute('tabindex')).toBe('-1');
    await user.click(screen.getByRole('button', { name: '新建项目' }));
    expect(onCreate).toHaveBeenCalledOnce();

    const nameInput = screen.getByRole('textbox', { name: '项目名称' });
    await user.clear(nameInput);
    await user.type(nameInput, '新的项目名');
    await user.click(screen.getByRole('button', { name: '保存名称' }));
    expect(onRename).toHaveBeenCalledWith('新的项目名');

    await user.click(screen.getByRole('button', { name: '删除项目' }));
    expect(onDelete).not.toHaveBeenCalled();
    await user.click(screen.getByRole('button', { name: '确认删除' }));
    expect(onDelete).toHaveBeenCalledOnce();
  });
});
