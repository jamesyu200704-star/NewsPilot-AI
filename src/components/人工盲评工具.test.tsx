// @vitest-environment jsdom
import { cleanup, render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, describe, expect, it } from 'vitest';
import { ManualBlindReviewTool } from './人工盲评工具';

afterEach(cleanup);

describe('人工盲评工具', () => {
  it('展开后使用稳定的可访问名称，并保持原生键盘焦点顺序', async () => {
    const user = userEvent.setup();
    render(<ManualBlindReviewTool newsPilotOutput="NewsPilot 输出" />);

    const toolSummary = screen.getByText('人工匿名对照评测').closest('summary');
    const rubricSummary = screen.getByText('查看 13 项评分标准').closest('summary');
    expect(toolSummary).not.toBeNull();
    expect(rubricSummary).not.toBeNull();

    await user.click(toolSummary as HTMLElement);
    expect(document.activeElement).toBe(toolSummary);
    await user.tab();
    expect(document.activeElement).toBe(rubricSummary);
    await user.tab();
    expect(document.activeElement).toBe(screen.getByRole('textbox', { name: '案例编号' }));
    await user.tab();
    expect(document.activeElement).toBe(screen.getByRole('textbox', { name: 'NewsPilot 输出' }));
  });

  it('由测试人员手动输入三类结果并在评审阶段隐藏来源', async () => {
    const user = userEvent.setup();
    render(<ManualBlindReviewTool newsPilotOutput="NewsPilot 输出" />);

    await user.type(
      screen.getByRole('textbox', { name: '通用聊天模型输出' }),
      '通用模型结果',
    );
    await user.type(
      screen.getByRole('textbox', { name: '学生自行策划结果' }),
      '学生结果',
    );
    await user.click(screen.getByRole('button', { name: '生成匿名盲评包' }));

    expect(screen.queryByLabelText('通用聊天模型输出')).toBeNull();
    expect(screen.queryByLabelText('学生自行策划结果')).toBeNull();
    expect(screen.getByText('方案 A')).toBeTruthy();
    expect(screen.getByText('方案 B')).toBeTruthy();
    expect(screen.getByText('方案 C')).toBeTruthy();
    expect(screen.getAllByLabelText(/新闻问题明确度/u).length).toBe(3);
    expect(screen.getByText('查看 13 项评分标准')).toBeTruthy();
    expect(screen.getByRole('button', { name: '导出匿名 JSON' })).toBeTruthy();
    expect(screen.getByRole('button', { name: '导出匿名 CSV' })).toBeTruthy();
    expect((screen.getByRole('button', { name: '单独导出揭盲密钥' }) as HTMLButtonElement).disabled).toBe(true);
  });
});
