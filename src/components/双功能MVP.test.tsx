// @vitest-environment jsdom
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { DualWorkflowMvp } from './双功能MVP';

const validArticle =
  '学校于今天发布了新的图书馆开放安排，晚间开放时间延长至晚上十点，学生可以通过预约系统入馆。';

afterEach(cleanup);
beforeEach(() => {
  Object.defineProperty(navigator, 'clipboard', {
    configurable: true,
    value: { writeText: vi.fn().mockResolvedValue(undefined) },
  });
  globalThis.fetch = (async (_input, init) => {
    const request = JSON.parse(String(init?.body || '{}')) as { taskType?: string };
    const result = request.taskType === 'news_edit' ? {
      taskType: 'news_edit', title: '评论配发建议', output: '评论结果', notes: ['编辑说明内容'],
      verificationNeeded: ['待核实'], generatedAt: '2026-09-17T00:00:00.000Z', mode: 'qwen',
    } : {
    taskType: 'interview', title: '采访提纲', output: '采访问题', notes: ['提醒'],
    verificationNeeded: ['待核实'], generatedAt: '2026-09-17T00:00:00.000Z', mode: 'qwen',
    understanding: { interviewSubject: '柯洁', event: '柯洁赢棋了', interviewNeed: '了解事件经过' },
    interviewPlan: {
      eventType: '人物赛事',
      subjects: [
        { name: '柯洁', role: '主要采访对象', reason: '事件当事人' },
        { name: '赛事相关人员', role: '补充采访对象', reason: '补充赛事背景' },
      ],
      sections: [{ title: '关键过程', questions: [{
        target: '柯洁', question: '比赛中最关键的时刻是什么？', purpose: '还原关键过程',
        sourceTitles: ['柯洁夺冠赛事报道'], followUp: '当时为什么这样判断？', priority: 'must',
      }] }],
    },
  };
    return new Response(JSON.stringify(result), { status: 200, headers: { 'Content-Type': 'application/json' } });
  }) as typeof fetch;
});

describe('DualWorkflowMvp', () => {
  it('显示采访准备与新闻编辑入口', () => {
    render(<DualWorkflowMvp />);
    expect(screen.getByRole('heading', { name: '采访准备与新闻编辑' })).toBeTruthy();
    expect(screen.getByRole('button', { name: '采访准备' })).toBeTruthy();
    expect(screen.getByRole('button', { name: '新闻编辑' })).toBeTruthy();
  });

  it('任务入口直接说明用户要提供什么和会得到什么', () => {
    render(<DualWorkflowMvp />);
    expect(screen.getByText('输入一句采访主题')).toBeTruthy();
    expect(screen.getByText('得到采访对象与问题提纲')).toBeTruthy();
    expect(screen.getByText('粘贴一篇已有稿件')).toBeTruthy();
    expect(screen.getByText('得到修改后的完整成稿')).toBeTruthy();
  });

  it('一句话采访需求显示系统理解', async () => {
    const user = userEvent.setup();
    render(<DualWorkflowMvp />);
    await user.click(screen.getByRole('button', { name: '采访准备' }));
    await user.type(screen.getByLabelText('一句话描述你想采访的对象或事件'), '柯洁赢棋了，我想采访他。');
    await user.click(screen.getByRole('button', { name: '生成采访提纲' }));
    expect(await screen.findByText('采访判断')).toBeTruthy();
    expect(screen.getByRole('heading', { name: '采访对象' })).toBeTruthy();
    expect(screen.getByRole('heading', { name: '柯洁' })).toBeTruthy();
    expect(screen.getByText('柯洁赢棋了')).toBeTruthy();
  });

  it('只输入采访主题也可以生成提纲', async () => {
    const user = userEvent.setup();
    render(<DualWorkflowMvp />);
    await user.click(screen.getByRole('button', { name: '采访准备' }));
    await user.type(screen.getByLabelText('一句话描述你想采访的对象或事件'), '柯洁');
    await user.click(screen.getByRole('button', { name: '生成采访提纲' }));
    expect(await screen.findByText('采访判断')).toBeTruthy();
  });

  it('输入采访主题后按 Enter 直接生成', async () => {
    const user = userEvent.setup();
    render(<DualWorkflowMvp />);
    await user.click(screen.getByRole('button', { name: '采访准备' }));
    await user.type(screen.getByLabelText('一句话描述你想采访的对象或事件'), '校园新增夜间班车{enter}');
    expect(await screen.findByText('采访判断')).toBeTruthy();
  });

  it('显示输入字数、键盘规则并提供可点击示例', async () => {
    const user = userEvent.setup();
    render(<DualWorkflowMvp />);
    await user.click(screen.getByRole('button', { name: '采访准备' }));
    expect(screen.getByText('0 字')).toBeTruthy();
    expect(screen.getByText(/Enter 生成，Shift \+ Enter 换行/u)).toBeTruthy();
    await user.click(screen.getByRole('button', { name: '柯洁赢棋了，我想采访他' }));
    expect((screen.getByLabelText('一句话描述你想采访的对象或事件') as HTMLTextAreaElement).value).toBe('柯洁赢棋了，我想采访他');
    expect(screen.getByText('11 字')).toBeTruthy();
  });

  it('在两类任务之间切换时分别保留草稿', async () => {
    const user = userEvent.setup();
    render(<DualWorkflowMvp />);
    await user.click(screen.getByRole('button', { name: '采访准备' }));
    await user.type(screen.getByLabelText('一句话描述你想采访的对象或事件'), '采访草稿');
    await user.click(screen.getByRole('button', { name: '新闻编辑' }));
    await user.type(screen.getByLabelText('粘贴需要润色的新闻稿'), '这是新闻编辑草稿，需要被单独保存并继续完成。');
    await user.click(screen.getByRole('button', { name: '采访准备' }));
    expect((screen.getByLabelText('一句话描述你想采访的对象或事件') as HTMLTextAreaElement).value).toBe('采访草稿');
    await user.click(screen.getByRole('button', { name: '新闻编辑' }));
    expect((screen.getByLabelText('粘贴需要润色的新闻稿') as HTMLTextAreaElement).value).toBe('这是新闻编辑草稿，需要被单独保存并继续完成。');
  });

  it('三种新闻编辑任务显示各自的输入和提交文案', async () => {
    const user = userEvent.setup();
    render(<DualWorkflowMvp />);
    await user.click(screen.getByRole('button', { name: '新闻编辑' }));

    expect(screen.getByLabelText('粘贴需要润色的新闻稿')).toBeTruthy();
    expect(screen.getByRole('button', { name: '开始润色' })).toBeTruthy();
    expect(screen.getByText('改病句、口语和重复，事实与引语保持不变')).toBeTruthy();

    await user.click(screen.getByRole('button', { name: '结构修改' }));
    expect(screen.getByLabelText('粘贴需要调整结构的新闻稿')).toBeTruthy();
    expect(screen.getByRole('button', { name: '调整结构' })).toBeTruthy();
    expect(screen.getByText('重排标题、导语和段落，不补写材料外的事实')).toBeTruthy();

    await user.click(screen.getByRole('button', { name: '新闻评论' }));
    expect(screen.getByLabelText('粘贴作为评论依据的新闻稿或事实材料')).toBeTruthy();
    expect(screen.getByText('基于现有材料形成观点，不把评价写成事实')).toBeTruthy();
    await user.type(screen.getByLabelText('粘贴作为评论依据的新闻稿或事实材料'), validArticle);
    await user.click(screen.getByRole('button', { name: '生成评论' }));
    expect(await screen.findByText('编辑说明')).toBeTruthy();
    expect(screen.getByText('新闻评论结果')).toBeTruthy();
  });

  it('输入不足时聚焦输入框并保留可操作错误', async () => {
    const user = userEvent.setup();
    render(<DualWorkflowMvp />);
    await user.click(screen.getByRole('button', { name: '新闻编辑' }));
    await user.click(screen.getByRole('button', { name: '开始润色' }));
    const input = screen.getByLabelText('粘贴需要润色的新闻稿');
    expect(document.activeElement).toBe(input);
    expect(screen.getByRole('alert').textContent).toContain('请至少粘贴 20 个字');
  });

  it('新闻编辑结果可以复制、查看原稿并返回继续修改', async () => {
    const user = userEvent.setup();
    const writeText = vi.spyOn(navigator.clipboard, 'writeText').mockResolvedValue(undefined);
    render(<DualWorkflowMvp />);
    await user.click(screen.getByRole('button', { name: '新闻编辑' }));
    await user.type(screen.getByLabelText('粘贴需要润色的新闻稿'), validArticle);
    await user.click(screen.getByRole('button', { name: '开始润色' }));
    expect(await screen.findByText('语言润色结果')).toBeTruthy();
    expect(screen.getByText('查看原稿')).toBeTruthy();
    await user.click(screen.getByRole('button', { name: '复制成稿' }));
    expect(writeText).toHaveBeenCalledWith(expect.stringContaining('评论结果'));
    expect(screen.getByText('已复制')).toBeTruthy();
    await user.click(screen.getByRole('button', { name: '修改原稿' }));
    expect((screen.getByLabelText('粘贴需要润色的新闻稿') as HTMLTextAreaElement).value).toBe(validArticle);
  });

  it('采访结果可以复制为包含对象和问题的文本', async () => {
    const user = userEvent.setup();
    const writeText = vi.spyOn(navigator.clipboard, 'writeText').mockResolvedValue(undefined);
    render(<DualWorkflowMvp />);
    await user.click(screen.getByRole('button', { name: '采访准备' }));
    await user.type(screen.getByLabelText('一句话描述你想采访的对象或事件'), '柯洁赢棋');
    await user.click(screen.getByRole('button', { name: '生成采访提纲' }));
    expect(await screen.findByText('采访判断')).toBeTruthy();
    await user.click(screen.getByRole('button', { name: '复制采访提纲' }));
    expect(writeText).toHaveBeenCalledWith(expect.stringMatching(/采访对象[\s\S]*柯洁[\s\S]*比赛中最关键的时刻/u));
  });

  it('采访结果展示实时搜索的参考资料', async () => {
    const user = userEvent.setup();
    const originalFetch = globalThis.fetch;
    globalThis.fetch = (async () => new Response(JSON.stringify({
      taskType: 'interview',
      title: '采访提纲',
      output: '【核心问题】\n1. 赛前如何准备？',
      notes: ['先核实事实'],
      verificationNeeded: ['比赛日期'],
      generatedAt: '2026-09-17T00:00:00.000Z',
      mode: 'qwen',
      understanding: { interviewSubject: '柯洁', event: '柯洁赢棋', interviewNeed: '了解比赛过程' },
      research: {
        status: 'live',
        notice: '已搜索公开资料',
        sources: [{ title: '柯洁夺冠赛事报道', url: 'https://example.com/ke-jie', snippet: '赛事摘要', sourceName: '示例媒体' }],
      },
    }), { status: 200, headers: { 'Content-Type': 'application/json' } })) as typeof fetch;
    try {
      render(<DualWorkflowMvp />);
      await user.click(screen.getByRole('button', { name: '采访准备' }));
      await user.type(screen.getByLabelText('一句话描述你想采访的对象或事件'), '柯洁赢棋');
      await user.click(screen.getByRole('button', { name: '生成采访提纲' }));
      expect(await screen.findByText('参考资料')).toBeTruthy();
      expect(screen.getByRole('link', { name: '柯洁夺冠赛事报道' })).toBeTruthy();
    } finally {
      globalThis.fetch = originalFetch;
    }
  });

  it('采访结果展示对象分工和问题依据链', async () => {
    const user = userEvent.setup();
    render(<DualWorkflowMvp />);
    await user.click(screen.getByRole('button', { name: '采访准备' }));
    await user.type(screen.getByLabelText('一句话描述你想采访的对象或事件'), '柯洁赢棋');
    await user.click(screen.getByRole('button', { name: '生成采访提纲' }));
    expect(await screen.findByRole('heading', { name: '采访对象' })).toBeTruthy();
    expect(screen.getByText('主要采访对象')).toBeTruthy();
    expect(screen.getByText('补充采访对象')).toBeTruthy();
    expect(screen.getByText('为什么问')).toBeTruthy();
    expect(screen.getByText('回答含糊时追问')).toBeTruthy();
    expect(screen.getByText('资料依据')).toBeTruthy();
    expect(screen.queryByText('待核实')).toBeNull();
    expect(screen.queryByText('待核实项')).toBeNull();
  });

  it('选择任务后直接聚焦输入框', async () => {
    const user = userEvent.setup();
    render(<DualWorkflowMvp />);
    await user.click(screen.getByRole('button', { name: '采访准备' }));
    const input = screen.getByLabelText('一句话描述你想采访的对象或事件');
    await waitFor(() => expect(document.activeElement).toBe(input));
  });

  it('点击采访示例后把焦点送回输入框', async () => {
    const user = userEvent.setup();
    render(<DualWorkflowMvp />);
    await user.click(screen.getByRole('button', { name: '采访准备' }));
    await user.click(screen.getByRole('button', { name: '学校延长图书馆开放时间' }));
    const input = screen.getByLabelText('一句话描述你想采访的对象或事件');
    expect((input as HTMLTextAreaElement).value).toBe('学校延长图书馆开放时间');
    await waitFor(() => expect(document.activeElement).toBe(input));
  });

  it('生成期间锁定任务入口并允许取消', async () => {
    const user = userEvent.setup();
    globalThis.fetch = vi.fn((_input, init) => new Promise<Response>((_resolve, reject) => {
      init?.signal?.addEventListener('abort', () => reject(new DOMException('Aborted', 'AbortError')));
    })) as typeof fetch;
    render(<DualWorkflowMvp />);
    await user.click(screen.getByRole('button', { name: '采访准备' }));
    await user.type(screen.getByLabelText('一句话描述你想采访的对象或事件'), '校园夜间班车');
    await user.click(screen.getByRole('button', { name: '生成采访提纲' }));
    expect((screen.getByRole('button', { name: '采访准备' }) as HTMLButtonElement).disabled).toBe(true);
    expect((screen.getByRole('button', { name: '新闻编辑' }) as HTMLButtonElement).disabled).toBe(true);
    await user.click(screen.getByRole('button', { name: '取消生成' }));
    expect((await screen.findByRole('alert')).textContent).toContain('已取消');
    expect((screen.getByRole('button', { name: '生成采访提纲' }) as HTMLButtonElement).disabled).toBe(false);
  });

  it('采访结果返回输入时使用修改主题而不是修改原稿', async () => {
    const user = userEvent.setup();
    render(<DualWorkflowMvp />);
    await user.click(screen.getByRole('button', { name: '采访准备' }));
    await user.type(screen.getByLabelText('一句话描述你想采访的对象或事件'), '柯洁赢棋');
    await user.click(screen.getByRole('button', { name: '生成采访提纲' }));
    expect(await screen.findByRole('button', { name: '修改主题' })).toBeTruthy();
    expect(screen.queryByRole('button', { name: '修改原稿' })).toBeNull();
    expect(screen.getByText('可以直接复制，也可以返回修改主题后重新生成。')).toBeTruthy();
  });

  it('复制完整采访提纲时包含目的、追问和资料依据', async () => {
    const user = userEvent.setup();
    const writeText = vi.spyOn(navigator.clipboard, 'writeText').mockResolvedValue(undefined);
    render(<DualWorkflowMvp />);
    await user.click(screen.getByRole('button', { name: '采访准备' }));
    await user.type(screen.getByLabelText('一句话描述你想采访的对象或事件'), '柯洁赢棋');
    await user.click(screen.getByRole('button', { name: '生成采访提纲' }));
    await user.click(await screen.findByRole('button', { name: '复制采访提纲' }));
    expect(writeText).toHaveBeenCalledWith(expect.stringMatching(/为什么问：还原关键过程[\s\S]*追问：当时为什么这样判断[\s\S]*资料依据：柯洁夺冠赛事报道/u));
  });

  it('复制多组采访提纲时问题编号连续', async () => {
    const user = userEvent.setup();
    const writeText = vi.spyOn(navigator.clipboard, 'writeText').mockResolvedValue(undefined);
    globalThis.fetch = (async () => new Response(JSON.stringify({
      taskType: 'interview', title: '采访提纲', output: '采访问题', notes: ['提醒'],
      verificationNeeded: [], generatedAt: '2026-09-17T00:00:00.000Z', mode: 'qwen',
      understanding: { interviewSubject: '柯洁', event: '柯洁赢棋', interviewNeed: '了解比赛过程' },
      interviewPlan: {
        eventType: '人物赛事',
        subjects: [{ name: '柯洁', role: '主要采访对象', reason: '当事人' }, { name: '教练', role: '补充采访对象', reason: '补充背景' }],
        sections: [
          { title: '赛前', questions: [{ target: '柯洁', question: '赛前如何准备？', purpose: '了解准备', sourceTitles: [], followUp: '最重要的一项是什么？', priority: 'must' }] },
          { title: '赛后', questions: [{ target: '柯洁', question: '赛后如何复盘？', purpose: '了解复盘', sourceTitles: [], followUp: '下一步是什么？', priority: 'optional' }] },
        ],
      },
    }), { status: 200, headers: { 'Content-Type': 'application/json' } })) as typeof fetch;
    render(<DualWorkflowMvp />);
    await user.click(screen.getByRole('button', { name: '采访准备' }));
    await user.type(screen.getByLabelText('一句话描述你想采访的对象或事件'), '柯洁赢棋');
    await user.click(screen.getByRole('button', { name: '生成采访提纲' }));
    await user.click(await screen.findByRole('button', { name: '复制采访提纲' }));
    expect(writeText).toHaveBeenCalledWith(expect.stringMatching(/1\. 赛前如何准备[\s\S]*2\. 赛后如何复盘/u));
  });

  it('采访结果可以只复制一道问题及其追问', async () => {
    const user = userEvent.setup();
    const writeText = vi.spyOn(navigator.clipboard, 'writeText').mockResolvedValue(undefined);
    render(<DualWorkflowMvp />);
    await user.click(screen.getByRole('button', { name: '采访准备' }));
    await user.type(screen.getByLabelText('一句话描述你想采访的对象或事件'), '柯洁赢棋');
    await user.click(screen.getByRole('button', { name: '生成采访提纲' }));
    await user.click(await screen.findByRole('button', { name: '复制这一题' }));
    expect(writeText).toHaveBeenCalledWith(expect.stringMatching(/比赛中最关键的时刻是什么[\s\S]*当时为什么这样判断/u));
  });

  it('搜索失败时使用普通用户能看懂的说明而不暴露供应商文案', async () => {
    const user = userEvent.setup();
    globalThis.fetch = (async () => new Response(JSON.stringify({
      taskType: 'interview', title: '采访提纲', output: '采访问题', notes: ['提醒'],
      verificationNeeded: [], generatedAt: '2026-09-17T00:00:00.000Z', mode: 'qwen',
      understanding: { interviewSubject: '柯洁', event: '柯洁赢棋', interviewNeed: '了解比赛过程' },
      research: { status: 'failed', notice: 'Bing 新闻搜索不可用，provider timeout', sources: [] },
    }), { status: 200, headers: { 'Content-Type': 'application/json' } })) as typeof fetch;
    render(<DualWorkflowMvp />);
    await user.click(screen.getByRole('button', { name: '采访准备' }));
    await user.type(screen.getByLabelText('一句话描述你想采访的对象或事件'), '柯洁赢棋');
    await user.click(screen.getByRole('button', { name: '生成采访提纲' }));
    expect(await screen.findByText(/暂未找到可用的公开资料/u)).toBeTruthy();
    expect(screen.queryByText(/Bing|provider|timeout/iu)).toBeNull();
  });

  it('新闻编辑结果不显示没有信息量的待核实占位词', async () => {
    const user = userEvent.setup();
    render(<DualWorkflowMvp />);
    await user.click(screen.getByRole('button', { name: '新闻编辑' }));
    await user.type(screen.getByLabelText('粘贴需要润色的新闻稿'), validArticle);
    await user.click(screen.getByRole('button', { name: '开始润色' }));
    await screen.findByText('语言润色结果');
    expect(screen.queryByText('待核实')).toBeNull();
    expect(screen.queryByRole('heading', { name: '原稿中的事实问题' })).toBeNull();
  });

  it('输入框限制为服务端可接受的三万字并在接近上限时提示剩余字数', async () => {
    const user = userEvent.setup();
    render(<DualWorkflowMvp />);
    await user.click(screen.getByRole('button', { name: '新闻编辑' }));
    const input = screen.getByLabelText('粘贴需要润色的新闻稿') as HTMLTextAreaElement;
    expect(input.maxLength).toBe(30000);
    fireEvent.change(input, { target: { value: '新'.repeat(29950) } });
    expect(screen.getByText('还可输入 50 字')).toBeTruthy();
  });

  it('快速重复提交时只发送一次请求', async () => {
    const user = userEvent.setup();
    const request = vi.fn(() => new Promise<Response>(() => undefined));
    globalThis.fetch = request as typeof fetch;
    render(<DualWorkflowMvp />);
    await user.click(screen.getByRole('button', { name: '采访准备' }));
    await user.type(screen.getByLabelText('一句话描述你想采访的对象或事件'), '校园夜间班车');
    const submitButton = screen.getByRole('button', { name: '生成采访提纲' });
    fireEvent.click(submitButton);
    fireEvent.click(submitButton);
    expect(request).toHaveBeenCalledTimes(1);
  });

  it('生成期间输入内容仍可选择复制但不能继续改写', async () => {
    const user = userEvent.setup();
    globalThis.fetch = vi.fn(() => new Promise<Response>(() => undefined)) as typeof fetch;
    render(<DualWorkflowMvp />);
    await user.click(screen.getByRole('button', { name: '采访准备' }));
    const input = screen.getByLabelText('一句话描述你想采访的对象或事件') as HTMLTextAreaElement;
    await user.type(input, '校园夜间班车');
    await user.click(screen.getByRole('button', { name: '生成采访提纲' }));
    expect(input.readOnly).toBe(true);
    expect(input.disabled).toBe(false);
    expect(screen.getByText(/输入内容会保留/u)).toBeTruthy();
  });

  it('复制新闻成稿时不夹带工作台的结果栏目名称', async () => {
    const user = userEvent.setup();
    const writeText = vi.spyOn(navigator.clipboard, 'writeText').mockResolvedValue(undefined);
    render(<DualWorkflowMvp />);
    await user.click(screen.getByRole('button', { name: '新闻编辑' }));
    await user.type(screen.getByLabelText('粘贴需要润色的新闻稿'), validArticle);
    await user.click(screen.getByRole('button', { name: '开始润色' }));
    await user.click(await screen.findByRole('button', { name: '复制成稿' }));
    expect(writeText).toHaveBeenCalledWith('评论结果');
  });

  it('跨分组连续编号采访问题而不是每组重新从一开始', async () => {
    const user = userEvent.setup();
    globalThis.fetch = (async () => new Response(JSON.stringify({
      taskType: 'interview', title: '采访提纲', output: '采访问题', notes: ['提醒'],
      verificationNeeded: [], generatedAt: '2026-09-17T00:00:00.000Z', mode: 'qwen',
      understanding: { interviewSubject: '柯洁', event: '柯洁赢棋', interviewNeed: '了解比赛过程' },
      interviewPlan: {
        eventType: '人物赛事',
        subjects: [{ name: '柯洁', role: '主要采访对象', reason: '当事人' }, { name: '教练', role: '补充采访对象', reason: '补充背景' }],
        sections: [
          { title: '赛前', questions: [{ target: '柯洁', question: '赛前如何准备？', purpose: '了解准备', sourceTitles: [], followUp: '最重要的一项是什么？', priority: 'must' }] },
          { title: '赛后', questions: [{ target: '柯洁', question: '赛后如何复盘？', purpose: '了解复盘', sourceTitles: [], followUp: '下一步是什么？', priority: 'optional' }] },
        ],
      },
    }), { status: 200, headers: { 'Content-Type': 'application/json' } })) as typeof fetch;
    render(<DualWorkflowMvp />);
    await user.click(screen.getByRole('button', { name: '采访准备' }));
    await user.type(screen.getByLabelText('一句话描述你想采访的对象或事件'), '柯洁赢棋');
    await user.click(screen.getByRole('button', { name: '生成采访提纲' }));
    expect(await screen.findByText('1. 必问')).toBeTruthy();
    expect(screen.getByText('2. 选问')).toBeTruthy();
  });

  it('复制单题后在原按钮位置显示已复制', async () => {
    const user = userEvent.setup();
    render(<DualWorkflowMvp />);
    await user.click(screen.getByRole('button', { name: '采访准备' }));
    await user.type(screen.getByLabelText('一句话描述你想采访的对象或事件'), '柯洁赢棋');
    await user.click(screen.getByRole('button', { name: '生成采访提纲' }));
    const button = await screen.findByRole('button', { name: '复制这一题' });
    await user.click(button);
    expect(screen.getByRole('button', { name: '这一题已复制' })).toBeTruthy();
  });

  it('复制单题失败时不显示已复制', async () => {
    const user = userEvent.setup();
    vi.spyOn(navigator.clipboard, 'writeText').mockRejectedValue(new Error('clipboard unavailable'));
    render(<DualWorkflowMvp />);
    await user.click(screen.getByRole('button', { name: '采访准备' }));
    await user.type(screen.getByLabelText('一句话描述你想采访的对象或事件'), '柯洁赢棋');
    await user.click(screen.getByRole('button', { name: '生成采访提纲' }));
    await user.click(await screen.findByRole('button', { name: '复制这一题' }));
    expect(screen.queryByRole('button', { name: '这一题已复制' })).toBeNull();
    expect(screen.getByRole('status').textContent).toContain('复制失败');
  });

  it('结果没有编辑说明时不显示空栏目', async () => {
    const user = userEvent.setup();
    globalThis.fetch = (async () => new Response(JSON.stringify({
      taskType: 'news_edit', title: '润色稿', output: '这是完整的润色结果。', notes: [],
      verificationNeeded: [], generatedAt: '2026-09-20T00:00:00.000Z', mode: 'qwen',
    }), { status: 200, headers: { 'Content-Type': 'application/json' } })) as typeof fetch;
    render(<DualWorkflowMvp />);
    await user.click(screen.getByRole('button', { name: '新闻编辑' }));
    await user.type(screen.getByLabelText('粘贴需要润色的新闻稿'), validArticle);
    await user.click(screen.getByRole('button', { name: '开始润色' }));
    await screen.findByText('这是完整的润色结果。');
    expect(screen.queryByRole('heading', { name: '编辑说明' })).toBeNull();
  });

  it('事实检查降级时明确说明本次未完成修改', async () => {
    const user = userEvent.setup();
    globalThis.fetch = (async () => new Response(JSON.stringify({
      taskType: 'news_edit', title: '原稿标题', output: validArticle,
      notes: ['为避免改变事实，已保留原稿内容。'], verificationNeeded: [],
      fallbackNotice: '本次修改没有通过事实检查，正文已保留为原稿。',
      generatedAt: '2026-09-20T00:00:00.000Z', mode: 'qwen',
    }), { status: 200, headers: { 'Content-Type': 'application/json' } })) as typeof fetch;
    render(<DualWorkflowMvp />);
    await user.click(screen.getByRole('button', { name: '新闻编辑' }));
    await user.type(screen.getByLabelText('粘贴需要润色的新闻稿'), validArticle);
    await user.click(screen.getByRole('button', { name: '开始润色' }));
    expect((await screen.findByRole('alert')).textContent).toContain('本次修改没有通过事实检查');
  });

  it('采访结果显示对象数和问题数', async () => {
    const user = userEvent.setup();
    render(<DualWorkflowMvp />);
    await user.click(screen.getByRole('button', { name: '采访准备' }));
    await user.type(screen.getByLabelText('一句话描述你想采访的对象或事件'), '柯洁赢棋');
    await user.click(screen.getByRole('button', { name: '生成采访提纲' }));
    expect(await screen.findByText('2 位采访对象 · 1 个问题')).toBeTruthy();
  });

  it('新闻编辑结果显示原稿和成稿字数', async () => {
    const user = userEvent.setup();
    render(<DualWorkflowMvp />);
    await user.click(screen.getByRole('button', { name: '新闻编辑' }));
    await user.type(screen.getByLabelText('粘贴需要润色的新闻稿'), validArticle);
    await user.click(screen.getByRole('button', { name: '开始润色' }));
    expect(await screen.findByText(`原稿 ${validArticle.length} 字 · 成稿 4 字`)).toBeTruthy();
  });

  it('输入区直接说明只需一句主题并把帮助与错误关联到输入框', async () => {
    const user = userEvent.setup();
    render(<DualWorkflowMvp />);
    await user.click(screen.getByRole('button', { name: '采访准备' }));
    const input = screen.getByLabelText('一句话描述你想采访的对象或事件');
    expect(screen.getByText('只写你现在想到的主题即可，人物、事件和采访重点由工作台判断。')).toBeTruthy();
    expect(input.getAttribute('aria-describedby')).toContain('source-help');
    await user.click(screen.getByRole('button', { name: '生成采访提纲' }));
    expect(input.getAttribute('aria-describedby')).toContain('source-error');
  });
});
