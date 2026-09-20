import assert from 'node:assert/strict';
import test from 'node:test';
import {
  assertEditorialTaskRequest,
  assertInterviewPlan,
  SchemaValidationError,
} from '../validation.js';
import { buildEditorialTaskPrompt } from '../../prompts/编辑任务提示词.js';
import { MockProvider } from '../providers/MockProvider.js';
import { createMockEditorialTaskResult, normalizeInterviewPlan, type EditorialTaskRequest } from '../../shared/编辑任务模型.js';
import { EditorialService } from '../services/editor.js';
import type { SearchProviderResult } from '../search/p1/SearchProvider.js';

const liveSearchResult: SearchProviderResult = {
  providerId: 'searxng',
  status: 'live',
  queryId: 'editor-interview',
  retrievedAt: '2026-09-17T00:00:00.000Z',
  notice: '实时搜索结果',
  cached: false,
  results: [{
    id: 'source-1',
    title: '柯洁夺冠赛事报道',
    url: 'https://example.com/ke-jie',
    snippet: '柯洁在决赛中战胜党毅飞。',
    sourceName: '示例媒体',
    publishedAt: '2026-09-10',
    suggestedSourceType: 'news_report',
    claimIds: [],
    purpose: '了解事件背景',
    queryId: 'editor-interview',
    retrievedAt: '2026-09-17T00:00:00.000Z',
    isMock: false,
  }],
};

test('编辑任务拒绝空材料', () => {
  assert.throws(
    () =>
      assertEditorialTaskRequest({
        taskType: 'interview',
        sourceText: '   ',
      }),
    SchemaValidationError,
  );
});

test('采访任务接受一句很短的主题', () => {
  assert.doesNotThrow(() =>
    assertEditorialTaskRequest({
      taskType: 'interview',
      sourceText: '柯洁赢棋',
    }),
  );
});

test('新闻编辑仍要求提供足够的原稿', () => {
  assert.throws(
    () =>
      assertEditorialTaskRequest({
        taskType: 'news_edit',
        action: 'polish',
        sourceText: '太短',
      }),
    SchemaValidationError,
  );
});

test('采访稿提示词明确禁止编造采访内容', () => {
  const prompt = buildEditorialTaskPrompt({
    taskType: 'interview',
    sourceText: '记者：你怎么看？\n受访者：我觉得变化很大。',
  });

  assert.match(prompt.system, /不得编造受访者、引语、经历、时间或事实/u);
  assert.match(prompt.system, /只返回.*JSON/u);
  assert.match(prompt.system, /6 至 8 个问题/u);
  assert.match(prompt.system, /人物赛事/u);
  assert.match(prompt.system, /purpose/u);
});

test('新闻编辑保留用户选择的编辑动作', async () => {
  const provider = new MockProvider();
  const service = new EditorialService(provider, provider);
  const result = await service.run({
    taskType: 'news_edit',
    action: 'commentary',
    sourceText: '学校于今天发布了新的图书馆开放安排，晚间开放时间延长至晚上十点，学生可以通过预约系统入馆。',
  });

  assert.equal(result.taskType, 'news_edit');
  assert.match(result.output, /评论/u);
});

test('语言润色提示词要求逐项保留原稿事实表达', () => {
  const prompt = buildEditorialTaskPrompt({
    taskType: 'news_edit',
    action: 'polish',
    sourceText: '9月17日下午，学校图书馆宣布下周一延长开放至晚上十点。',
  });

  assert.match(prompt.system, /不得新增、删除或换算/u);
  assert.match(prompt.system, /人名、机构名、时间、日期、数字、引语/u);
  assert.match(prompt.system, /下周一.*具体日期/u);
  assert.match(prompt.system, /合并重复句/u);
  assert.match(prompt.system, /不得原样照抄/u);
  assert.match(prompt.system, /verificationNeeded.*空数组/u);
  assert.match(prompt.system, /日期.*必须保留在 output 正文/u);
  assert.match(prompt.user, /原稿开始[\s\S]*原稿结束/u);
  assert.match(prompt.user, /逐项核对/u);
});

test('语言润色只编辑新闻表达并返回完整润色稿', () => {
  const prompt = buildEditorialTaskPrompt({
    taskType: 'news_edit',
    action: 'polish',
    sourceText: '学校今天宣布延长图书馆开放时间，学生对此表示欢迎。',
  });

  assert.match(prompt.system, /只做语言层面的编辑/u);
  assert.match(prompt.system, /完整润色稿/u);
  assert.match(prompt.system, /不得改变段落所表达的事实关系/u);
});

test('结构修改选择合适新闻结构并返回完整重组稿', () => {
  const prompt = buildEditorialTaskPrompt({
    taskType: 'news_edit',
    action: 'structure',
    sourceText: '学生对此表示欢迎。学校今天宣布延长图书馆开放时间，具体安排下周公布。',
  });

  assert.match(prompt.system, /倒金字塔、时间线或人物叙事/u);
  assert.match(prompt.system, /完整重组稿/u);
  assert.match(prompt.system, /不得只返回提纲或修改建议/u);
  assert.match(prompt.system, /缺失.*verificationNeeded/u);
});

test('新闻评论基于材料生成独立评论并区分事实与观点', () => {
  const prompt = buildEditorialTaskPrompt({
    taskType: 'news_edit',
    action: 'commentary',
    sourceText: '学校今天宣布延长图书馆开放时间，学生对此表示欢迎。',
  });

  assert.match(prompt.system, /独立的完整新闻评论/u);
  assert.match(prompt.system, /中心观点、论据、回应和结论/u);
  assert.match(prompt.system, /事实与观点/u);
  assert.match(prompt.system, /不得把原稿没有的材料当作论据/u);
  assert.match(prompt.system, /不得把“有人、部分学生”改成“教师、管理方”/u);
  assert.match(prompt.system, /观点句.*应该、需要或值得/u);
});

test('采访任务自动搜索并把公开来源交给模型和返回前端', async () => {
  let providerInput: EditorialTaskRequest | undefined;
  const baseProvider = new MockProvider();
  const provider = Object.assign(baseProvider, { runEditorialTask: async (input: EditorialTaskRequest) => {
    providerInput = input;
    return createMockEditorialTaskResult(input);
  } });
  let searchCalls = 0;
  const searchService = {
    search: async () => {
      searchCalls += 1;
      return liveSearchResult;
    },
  };
  const service = new EditorialService(provider, provider, console, searchService);

  const result = await service.run({ taskType: 'interview', sourceText: '柯洁赢棋' });

  assert.equal(searchCalls, 3);
  assert.equal(providerInput?.research?.sources[0]?.title, '柯洁夺冠赛事报道');
  assert.equal(result.research?.status, 'live');
  assert.equal(result.research?.sources[0]?.url, 'https://example.com/ke-jie');
});

test('口语化主题会提取专名并通过多组查询补足事件背景', async () => {
  const queries: string[] = [];
  let providerInput: EditorialTaskRequest | undefined;
  const baseProvider = new MockProvider();
  const provider = Object.assign(baseProvider, { runEditorialTask: async (input: EditorialTaskRequest) => {
    providerInput = input;
    return createMockEditorialTaskResult(input);
  } });
  const service = new EditorialService(provider, provider, console, {
    search: async (query) => {
      queries.push(query.query);
      return {
        ...liveSearchResult,
        queryId: query.id,
        results: query.query.includes('走红 起因')
          ? [{ ...liveSearchResult.results[0], id: 'goose-aunt-origin', url: 'https://example.com/origin', title: '鹅腿阿姨为何走红三所高校' }]
          : [{ ...liveSearchResult.results[0], id: 'irrelevant-goose', url: 'https://example.com/goose', title: '鹅的生活习性', snippet: '介绍雁形目鸭科动物。' }, ...Array.from({ length: 6 }, (_, index) => ({
              ...liveSearchResult.results[0],
              id: `${query.id}-${index}`,
              url: `https://example.com/recent-${query.id}-${index}`,
              title: `鹅腿阿姨近期报道 ${query.id}-${index}`,
            }))],
      };
    },
  });

  await service.run({ taskType: 'interview', sourceText: '我想采访鹅腿阿姨，应该问她什么？' });

  assert.deepEqual(queries, ['鹅腿阿姨', '鹅腿阿姨 新闻 背景', '鹅腿阿姨 走红 起因 人物经历']);
  assert.ok(providerInput?.research?.sources.some((source) => source.title === '鹅腿阿姨为何走红三所高校'));
  assert.equal(providerInput?.research?.sources.some((source) => source.title === '鹅的生活习性'), false);
});

test('新闻编辑不调用实时搜索', async () => {
  const provider = new MockProvider();
  let searchCalls = 0;
  const service = new EditorialService(provider, provider, console, {
    search: async () => {
      searchCalls += 1;
      return liveSearchResult;
    },
  });

  await service.run({
    taskType: 'news_edit',
    action: 'polish',
    sourceText: '学校于今天发布了新的图书馆开放安排，晚间开放时间延长至晚上十点，学生可以通过预约系统入馆。',
  });

  assert.equal(searchCalls, 0);
});

test('实时搜索失败时仍生成采访提纲并明确说明', async () => {
  const provider = new MockProvider();
  const service = new EditorialService(provider, provider, { warn() {} }, {
    search: async () => { throw new Error('搜索服务离线'); },
  });

  const result = await service.run({ taskType: 'interview', sourceText: '柯洁赢棋' });

  assert.match(result.output, /核心问题/u);
  assert.equal(result.research?.status, 'failed');
  assert.match(result.research?.notice || '', /暂时不可用/u);
});

test('采访提示词包含实时来源且明确来源不是采访回答', () => {
  const prompt = buildEditorialTaskPrompt({
    taskType: 'interview',
    sourceText: '柯洁赢棋',
    research: {
      status: 'live',
      notice: '实时搜索结果',
      sources: [{
        title: '柯洁夺冠赛事报道',
        url: 'https://example.com/ke-jie',
        snippet: '柯洁在决赛中战胜党毅飞。',
        sourceName: '示例媒体',
        publishedAt: '2026-09-10',
      }],
    },
  });

  assert.match(prompt.user, /柯洁夺冠赛事报道/u);
  assert.match(prompt.system, /公开资料不是采访回答/u);
});

test('采访结果按事件类型给出采访对象和问题依据链', () => {
  const result = createMockEditorialTaskResult({
    taskType: 'interview',
    sourceText: '柯洁赢棋',
    research: {
      status: 'live', notice: '实时搜索结果',
      sources: [{ title: '柯洁夺冠赛事报道', snippet: '赛事摘要', sourceName: '示例媒体' }],
    },
  });

  assert.equal(result.interviewPlan?.eventType, '人物赛事');
  assert.equal(result.interviewPlan?.subjects[0]?.role, '主要采访对象');
  assert.ok((result.interviewPlan?.subjects.length || 0) >= 2);
  assert.ok((result.interviewPlan?.sections.length || 0) >= 3);
  const question = result.interviewPlan?.sections[0]?.questions[0];
  assert.ok(question?.purpose);
  assert.ok(question?.followUp);
  assert.equal(Object.hasOwn(question || {}, 'verification'), false);
  assert.equal(question?.sourceTitles[0], '柯洁夺冠赛事报道');
});

test('采访提示词要求先判断事件类型和多类采访对象', () => {
  const prompt = buildEditorialTaskPrompt({ taskType: 'interview', sourceText: '学校食堂涨价' });
  assert.match(prompt.system, /eventType/u);
  assert.match(prompt.system, /主要采访对象/u);
  assert.match(prompt.system, /补充采访对象/u);
  assert.match(prompt.system, /sourceTitles/u);
  assert.match(prompt.system, /不得仅按.*食堂/u);
});

test('没有降级模型时主模型失败应直接报错', async () => {
  const provider = Object.assign(new MockProvider(), {
    runEditorialTask: async () => { throw new Error('Ollama unavailable'); },
  });
  const service = new EditorialService(provider);
  await assert.rejects(
    () => service.run({ taskType: 'interview', sourceText: '柯洁赢棋' }),
    /Ollama unavailable/u,
  );
});

test('采访计划合并重名阶段且不超过八个问题', () => {
  const question = { target: '学生代表', question: '问题', purpose: '目的', sourceTitles: [], followUp: '追问', priority: 'must' as const };
  const plan = normalizeInterviewPlan({
    eventType: '人物赛事、政策变化、突发事件、公共争议或其他具体类型',
    subjects: [
      { name: '学生代表', role: '主要采访对象', reason: '受影响者' },
      { name: '食堂负责人', role: '补充采访对象', reason: '执行方' },
    ],
    sections: [
      { title: '按事件类型生成的采访阶段', questions: [question, question, question] },
      { title: '后续阶段', questions: [question, question, question] },
      { title: '后续阶段', questions: [question, question, question] },
    ],
  }, '学校食堂涨价');
  assert.equal(plan.eventType, '政策变化');
  assert.equal(plan.sections[0]?.title, '核心事实');
  assert.ok(plan.sections.every((section) => section.questions.length > 0));
  assert.equal(new Set(plan.sections.flatMap((section) => section.questions.map((item) => item.question))).size, plan.sections.flatMap((section) => section.questions).length);
  assert.ok(plan.sections.flatMap((section) => section.questions).length >= 6);
  assert.ok(plan.sections.flatMap((section) => section.questions).length <= 8);
});

test('人物赛事过滤明显无关的补充采访对象', () => {
  const plan = normalizeInterviewPlan({
    eventType: '人物赛事',
    subjects: [
      { name: '柯洁', role: '主要采访对象', reason: '当事人' },
      { name: '学生代表', role: '补充采访对象', reason: '旁例污染' },
    ],
    sections: [
      { title: '过程', questions: [{ target: '柯洁', question: '关键过程？', purpose: '还原过程', sourceTitles: [], followUp: '具体细节？', priority: 'must' }] },
      { title: '影响', questions: [{ target: '柯洁', question: '后续影响？', purpose: '了解影响', sourceTitles: [], followUp: '下一步？', priority: 'must' }] },
    ],
  }, '柯洁赢棋');
  assert.equal(plan.subjects[1]?.name, '赛事相关人员');
});

test('鹅腿阿姨不会被模型误判为比赛并补入赛事问题', () => {
  const plan = normalizeInterviewPlan({
    eventType: '人物赛事',
    subjects: [
      { name: '鹅腿阿姨', role: '主要采访对象', reason: '事件当事人' },
      { name: '学生代表', role: '补充采访对象', reason: '消费者视角' },
    ],
    sections: [{ title: '经历', questions: [{ target: '鹅腿阿姨', question: '最初为什么开始售卖鹅腿？', purpose: '了解人物经历', sourceTitles: [], followUp: '最早是在什么时候？', priority: 'must' }] }],
  }, '鹅腿阿姨');

  assert.equal(plan.eventType, '人物事件');
  assert.doesNotMatch(JSON.stringify(plan), /赛前|比赛中|胜负/u);
  assert.doesNotThrow(() => assertInterviewPlan(plan));
});

test('二十大归为重大会议且不会补入食堂或价格问题', () => {
  const plan = normalizeInterviewPlan({
    eventType: '政策变化',
    subjects: [
      { name: '学生代表', role: '主要采访对象', reason: '青年视角' },
      { name: '食堂负责人', role: '补充采访对象', reason: '食堂管理' },
    ],
    sections: [{ title: '关注重点', questions: [
      { target: '学生代表', question: '你最关注报告中的哪些内容？', purpose: '了解关注点', sourceTitles: [], followUp: '为什么关注这一点？', priority: 'must' },
      { target: '食堂负责人', question: '你如何看待食堂管理？', purpose: '了解食堂', sourceTitles: [], followUp: '具体有什么影响？', priority: 'must' },
    ] }],
  }, '二十大');

  assert.equal(plan.eventType, '重大会议');
  assert.doesNotMatch(JSON.stringify(plan), /食堂|价格|赛前|比赛/u);
  assert.ok(plan.subjects.length >= 2);
  assert.doesNotThrow(() => assertInterviewPlan(plan));
});

test('跨主题质量门槛过滤其他领域模板和凭空姓名', () => {
  const cases = [
    { topic: '某科技公司发布新手机', type: '企业动态', forbidden: /伤员|消防|赛前|食堂/u },
    { topic: '某地发布暴雨红色预警', type: '突发事件', forbidden: /营收|股价|赛前|食堂/u },
    { topic: '校园新增夜间班车', type: '公共服务', forbidden: /夺冠|后厨|董事会|火灾/u },
    { topic: '一位青年导演的新电影上映', type: '文化事件', forbidden: /食堂|价格规则|事故责任|联赛/u },
    { topic: '城市调整共享单车管理办法', type: '政策变化', forbidden: /赛前|后厨|票房|伤员/u },
    { topic: '社区居民投诉夜间施工噪声', type: '公共争议', forbidden: /决赛|财报|食堂|电影上映/u },
    { topic: '高校实验室发生设备故障', type: '突发事件', forbidden: /夺冠|股价|后厨|票房/u },
    { topic: '青年作家出版新小说', type: '人物事件', forbidden: /联赛|消防救援|食堂|董事会/u },
    { topic: '全国人工智能教育论坛召开', type: '重大会议', forbidden: /胜负|后厨|伤员|股价/u },
    { topic: '柯洁赢得围棋决赛', type: '人物赛事', forbidden: /食堂|消防|董事会|票房/u },
  ];

  for (const item of cases) {
    const plan = normalizeInterviewPlan({
      eventType: item.type,
      subjects: [
        { name: item.type === '企业动态' ? '主要采访对象' : '相关当事人', role: '主要采访对象', reason: '了解事件' },
        { name: '李华', role: '补充采访对象', reason: '模型凭空生成的姓名' },
        { name: '相关领域专家', role: '补充采访对象', reason: '提供专业背景' },
      ],
      sections: [{ title: '混合问题', questions: [
        { target: '相关当事人', question: '赛前做了哪些准备？', purpose: '了解比赛', sourceTitles: [], followUp: '哪场比赛？', priority: 'must' },
        { target: '李华', question: '食堂价格如何确定？', purpose: '了解餐饮', sourceTitles: [], followUp: '后厨如何管理？', priority: 'must' },
        { target: '相关当事人', question: '这件事最初是怎样开始的？', purpose: '了解起因', sourceTitles: [], followUp: '请说明时间线。', priority: 'must' },
      ] }],
    }, item.topic);

    assert.doesNotMatch(JSON.stringify(plan), item.forbidden);
    assert.equal(plan.subjects.some((subject) => subject.name === '李华'), false);
    assert.equal(plan.subjects.some((subject) => /^(?:主要|补充)采访对象\d*$/u.test(subject.name)), false);
    assert.ok(plan.subjects.length >= 2);
    assert.equal(new Set(plan.subjects.map((subject) => subject.name)).size, plan.subjects.length);
    const questions = plan.sections.flatMap((section) => section.questions.map((question) => question.question));
    assert.equal(new Set(questions).size, questions.length);
    assert.doesNotThrow(() => assertInterviewPlan(plan));
  }
});

test('模型给出的事件类型没有资料支持时不得据此补题', () => {
  const plan = normalizeInterviewPlan({
    eventType: '人物赛事',
    subjects: [
      { name: '许家印', role: '主要采访对象', reason: '事件当事人' },
      { name: '学生代表', role: '补充采访对象', reason: '模型误配对象' },
    ],
    sections: [{ title: '人物经历', questions: [
      { target: '许家印', question: '你如何看待自己在房地产行业的扩张方式？', purpose: '了解经营决策', sourceTitles: ['许家印案完整始末'], followUp: '当时依据是什么？', priority: 'must' },
    ] }],
  }, '许家印', '许家印曾任中国恒大集团董事局主席，恒大采用高负债、高杠杆、高周转的房地产扩张模式。');

  assert.equal(plan.eventType, '人物事件');
  assert.doesNotMatch(JSON.stringify(plan), /赛事|赛前|比赛|胜负|夺冠/u);
  assert.equal(plan.subjects.some((subject) => /学生|教师/u.test(subject.name)), false);
  assert.doesNotThrow(() => assertInterviewPlan(plan));
});

test('用户明确给出的采访对象优先于模型的泛化对象', () => {
  const plan = normalizeInterviewPlan({
    eventType: '政策变化',
    subjects: [
      { name: '受影响者代表', role: '主要采访对象', reason: '了解影响' },
      { name: '政策执行部门负责人', role: '补充采访对象', reason: '了解执行' },
    ],
    sections: [{ title: '政策回应', questions: [
      { target: '受影响者代表', question: '后勤部门认为夜间断电政策的依据和目的是什么？', purpose: '了解政策依据', sourceTitles: [], followUp: '具体依据是什么？', priority: 'must' },
      { target: '受影响者代表', question: '住宿生受到哪些具体影响？', purpose: '了解实际影响', sourceTitles: [], followUp: '能否举例？', priority: 'must' },
    ] }],
  }, '宿舍夜间断电政策引发争议，我想采访后勤部门和住宿生。');

  assert.deepEqual(plan.subjects.map((subject) => subject.name), ['后勤部门', '住宿生']);
  const questions = plan.sections.flatMap((section) => section.questions);
  assert.equal(questions.find((question) => /后勤部门认为/u.test(question.question))?.target, '后勤部门');
  assert.equal(questions.find((question) => /住宿生受到/u.test(question.question))?.target, '住宿生');
});

test('一个问题同时询问两个采访对象时从提纲中移除', () => {
  const plan = normalizeInterviewPlan({
    eventType: '政策变化',
    subjects: [
      { name: '学生', role: '主要采访对象', reason: '了解使用感受' },
      { name: '老师', role: '补充采访对象', reason: '了解规范制定' },
    ],
    sections: [{ title: '规范影响', questions: [
      { target: '学生', question: '老师如何看待这一新规范？它对学生有何影响？', purpose: '同时了解双方', sourceTitles: [], followUp: '请分别回答。', priority: 'must' },
      { target: '学生', question: '学生使用AI写作时遇到哪些困难？', purpose: '了解学生体验', sourceTitles: [], followUp: '请举例。', priority: 'must' },
    ] }],
  }, '学校新增AI写作使用规范，我想采访老师和学生。');

  assert.doesNotMatch(JSON.stringify(plan), /老师如何看待这一新规范/u);
});

test('同一对象的复合问题只保留第一问并把其余内容转为追问', () => {
  const plan = normalizeInterviewPlan({
    eventType: '公共服务',
    subjects: [
      { name: '学生', role: '主要采访对象', reason: '说明体验' },
      { name: '馆长', role: '补充采访对象', reason: '说明安排' },
    ],
    sections: [{ title: '使用体验', questions: [
      { target: '学生', question: '延长开放对学习有什么影响？你还有什么建议？', purpose: '了解体验', sourceTitles: [], followUp: '请举例。', priority: 'must' },
    ] }],
  }, '图书馆延长开放时间，我想采访学生和馆长。');

  const question = plan.sections[0]?.questions[0];
  assert.equal(question?.question, '延长开放对学习有什么影响？');
  assert.match(question?.followUp || '', /你还有什么建议/u);
});

test('采访理解优先采用用户明确给出的采访对象', () => {
  const result = createMockEditorialTaskResult({
    taskType: 'interview',
    sourceText: '学校图书馆延长开放时间，我想采访馆长和学生。',
  });

  assert.equal(result.understanding?.interviewSubject, '馆长');
});

test('采访重点根据事件类型生成而不是套用人物经历模板', () => {
  const result = createMockEditorialTaskResult({ taskType: 'interview', sourceText: '校医院把夜间门诊延长到十点' });
  assert.match(result.understanding?.interviewNeed || '', /调整原因|具体安排|就诊体验|执行/u);
  assert.doesNotMatch(result.understanding?.interviewNeed || '', /人生经历/u);
});

test('AI写作使用规范识别为政策变化', () => {
  const plan = normalizeInterviewPlan({
    eventType: '人物事件',
    subjects: [
      { name: '学生', role: '主要采访对象', reason: '了解影响' },
      { name: '老师', role: '补充采访对象', reason: '了解规则' },
    ],
    sections: [{ title: '规范内容', questions: [
      { target: '老师', question: '这项规范如何制定？', purpose: '了解规则', sourceTitles: [], followUp: '具体依据是什么？', priority: 'must' },
    ] }],
  }, '学校新增AI写作使用规范，我想采访老师和学生。');

  assert.equal(plan.eventType, '政策变化');
});

test('采访本人时不要求其用第三人称评价自己', () => {
  const plan = normalizeInterviewPlan({
    eventType: '人物赛事',
    subjects: [
      { name: '柯洁', role: '主要采访对象', reason: '赛事当事人' },
      { name: '教练', role: '补充采访对象', reason: '补充视角' },
    ],
    sections: [{ title: '比赛表现', questions: [
      { target: '柯洁', question: '你如何评价柯洁在这场比赛中的表现？', purpose: '了解本人判断', sourceTitles: [], followUp: '关键时刻是什么？', priority: 'must' },
    ] }],
  }, '柯洁夺得围棋比赛冠军，我想采访他。');

  assert.doesNotMatch(JSON.stringify(plan), /你如何评价柯洁/u);
  assert.match(JSON.stringify(plan), /你如何评价自己/u);
});

test('人物赛事把胜因和后续影响问题交给本人并清理模板化目的', () => {
  const plan = normalizeInterviewPlan({
    eventType: '人物赛事',
    subjects: [
      { name: '柯洁', role: '主要采访对象', reason: '赛事当事人' },
      { name: '柯洁的教练或队友', role: '补充采访对象', reason: '补充视角' },
    ],
    sections: [{ title: '赛后复盘', questions: [
      { target: '柯洁', question: '你认为柯洁赢棋的原因是什么？', purpose: '为什么问，因为用户想了解柯洁获胜的具体原因。', sourceTitles: [], followUp: '请举例。', priority: 'must' },
      { target: '柯洁的教练或队友', question: '这次经历对下一阶段有什么影响？', purpose: '了解后续影响', sourceTitles: [], followUp: '有哪些计划？', priority: 'must' },
    ] }],
  }, '柯洁赢棋了，我想采访他。');

  const questions = plan.sections.flatMap((section) => section.questions);
  assert.equal(questions.find((item) => /这场胜利/u.test(item.question))?.target, '柯洁');
  assert.equal(questions.find((item) => /下一阶段/u.test(item.question))?.target, '柯洁');
  assert.equal(questions.some((item) => /你认为柯洁/u.test(item.question)), false);
  assert.equal(questions.some((item) => /^为什么问/u.test(item.purpose)), false);
  assert.equal(plan.subjects[1]?.reason, '补充比赛背景、现场观察和不同视角。');
});

test('模型的泛化对象按角色顺序映射为用户明确对象', () => {
  const plan = normalizeInterviewPlan({
    eventType: '政策变化',
    subjects: [
      { name: '管理部门', role: '主要采访对象', reason: '解释政策' },
      { name: '学生代表', role: '补充采访对象', reason: '说明影响' },
    ],
    sections: [{ title: '政策影响', questions: [
      { target: '学生代表', question: '你认为学校应该采取哪些改进措施？', purpose: '了解学生建议', sourceTitles: [], followUp: '为什么？', priority: 'must' },
    ] }],
  }, '校园开始限制电动自行车入校，我想采访管理部门和骑车学生。');

  assert.equal(plan.sections[0]?.questions[0]?.target, '骑车学生');
});

test('问题中的角色动作词用于纠正采访对象', () => {
  const plan = normalizeInterviewPlan({
    eventType: '公共争议',
    subjects: [
      { name: '社团负责人', role: '主要采访对象', reason: '解释筹款' },
      { name: '学生代表', role: '补充采访对象', reason: '说明捐款体验' },
    ],
    sections: [{ title: '捐款动机', questions: [
      { target: '社团负责人', question: '你为什么选择捐款给这个社团？', purpose: '了解捐款动机', sourceTitles: [], followUp: '何时开始关注？', priority: 'must' },
    ] }],
  }, '校园流浪猫救助社团筹款受到质疑，我想采访社团负责人和捐款学生。');

  assert.equal(plan.sections[0]?.questions[0]?.target, '捐款学生');
});

test('每个用户明确指定的采访对象至少获得一道问题', () => {
  const plan = normalizeInterviewPlan({
    eventType: '一般事件',
    subjects: [
      { name: '事件当事人', role: '主要采访对象', reason: '了解事件' },
      { name: '事件相关人员', role: '补充采访对象', reason: '补充视角' },
    ],
    sections: [{ title: '事件过程', questions: [
      { target: '事件当事人', question: '摆摊最初是怎样开始的？', purpose: '了解起因', sourceTitles: [], followUp: '具体是哪一天？', priority: 'must' },
    ] }],
  }, '毕业生在校园摆摊售卖二手物品走红，我想采访发起者和购买者。');

  const targets = new Set(plan.sections.flatMap((section) => section.questions.map((question) => question.target)));
  assert.equal(targets.has('发起者'), true);
  assert.equal(targets.has('购买者'), true);
});

test('校园服务、菜价调整和暴雨取消识别为对应事件类型', () => {
  const cases = [
    { topic: '学校图书馆从下周一开始延长开放到晚上十点', expected: '公共服务' },
    { topic: '某高校食堂菜价上涨引发讨论', expected: '政策变化' },
    { topic: '学校运动会因暴雨临时取消', expected: '突发事件' },
  ];

  for (const item of cases) {
    const plan = normalizeInterviewPlan({
      eventType: '一般事件',
      subjects: [
        { name: '事件负责人', role: '主要采访对象', reason: '了解事件' },
        { name: '学生代表', role: '补充采访对象', reason: '了解影响' },
      ],
      sections: [{ title: '事件情况', questions: [
        { target: '事件负责人', question: '事情为何发生？', purpose: '了解原因', sourceTitles: [], followUp: '具体依据是什么？', priority: 'must' },
      ] }],
    }, item.topic);

    assert.equal(plan.eventType, item.expected);
  }
});

test('音乐节因天气取消时使用主办方和原定参与者而不是泛化对象', () => {
  const plan = normalizeInterviewPlan({
    eventType: '突发事件',
    subjects: [
      { name: '学生代表', role: '主要采访对象', reason: '了解影响' },
      { name: '事件相关人员', role: '补充采访对象', reason: '补充情况' },
    ],
    sections: [{ title: '核心事实', questions: [{
      target: '事件相关人员',
      question: '你认为校园音乐节取消的原因是什么？',
      purpose: '了解原因，以便后续采访学生代表时理解他们的观点',
      sourceTitles: [],
      followUp: '如果学生代表回答不明确，可以追问他们的具体感受。',
      priority: 'must',
    }, {
      target: '学生代表',
      question: '你为什么认为校园音乐节应该举行？',
      purpose: '了解学生看法',
      sourceTitles: [],
      followUp: '为什么？',
      priority: 'must',
    }] }],
  }, '校园音乐节因为暴雨临时取消');

  assert.deepEqual(
    plan.subjects.map((subject) => subject.name),
    ['原定参加音乐节的学生', '音乐节主办方'],
  );
  const questions = plan.sections.flatMap((section) => section.questions);
  assert.equal(questions.length, 6);
  assert.equal(questions[0]?.target, '音乐节主办方');
  assert.doesNotMatch(JSON.stringify(questions), /学生代表|事件相关人员/u);
  assert.doesNotMatch(JSON.stringify(questions), /你(?:为什么)?认为.{0,20}应该/u);
  assert.ok(questions.filter((question) => /取消决定|通知|费用|延期|改期/u.test(question.question))
    .every((question) => question.target === '音乐节主办方'));
});

test('团队赛事的补充采访对象具体到队友或教练', () => {
  const plan = normalizeInterviewPlan({
    eventType: '人物赛事',
    subjects: [
      { name: '李明', role: '主要采访对象', reason: '赛事当事人' },
      { name: '赛事相关人员', role: '补充采访对象', reason: '补充背景' },
    ],
    sections: [],
  }, '校队队长李明带队夺得全国大学生篮球联赛冠军');

  assert.deepEqual(
    plan.subjects.map((subject) => subject.name),
    ['李明', '李明的队友或教练'],
  );
});

test('校医院延长夜间门诊识别为公共服务并把问题交给对应对象', () => {
  const result = normalizeInterviewPlan({
    eventType: '一般事件',
    subjects: [
      { name: '事件当事人', role: '主要采访对象', reason: '了解体验' },
      { name: '事件相关人员', role: '补充采访对象', reason: '补充背景' },
    ],
    sections: [{
      title: '核心事实',
      questions: [{
        target: '事件当事人',
        question: '学生代表如何看待校医院延长夜间门诊的时间？',
        purpose: '了解学生感受',
        sourceTitles: [],
        followUp: '最直接的变化是什么？',
        priority: 'must',
      }, {
        target: '事件相关人员',
        question: '延长夜间门诊的具体原因是什么？',
        purpose: '了解服务安排',
        sourceTitles: [],
        followUp: '如何安排医护人员？',
        priority: 'must',
      }],
    }],
  }, '校医院把夜间门诊延长到十点');

  assert.equal(result.eventType, '公共服务');
  assert.deepEqual(result.subjects.map((subject) => subject.name), ['就诊学生代表', '校医院负责人']);
  assert.equal(result.sections[0]?.questions[0]?.target, '就诊学生代表');
  assert.equal(result.sections[0]?.questions[1]?.target, '校医院负责人');
});

test('公共服务只返回学生对象时自动补足主要对象、执行方和六个问题', () => {
  const result = normalizeInterviewPlan({
    eventType: '公共服务',
    subjects: [
      { name: '学生代表', role: '补充采访对象', reason: '了解学生看法' },
    ],
    sections: [{ title: '核心事实', questions: [] }],
  }, '校医院把夜间门诊延长到十点');

  assert.deepEqual(result.subjects.map((subject) => [subject.name, subject.role]), [
    ['就诊学生代表', '主要采访对象'],
    ['校医院负责人', '补充采访对象'],
  ]);
  const questions = result.sections.flatMap((section) => section.questions);
  assert.equal(questions.length, 6);
  assert.ok(questions.some((question) => question.target === '校医院负责人'));
  assert.ok(questions.some((question) => question.target === '就诊学生代表'));
  assert.equal(questions.find((question) => /从何时开始实施/u.test(question.question))?.target, '校医院负责人');
  assert.equal(questions.find((question) => /收集和处理反馈/u.test(question.question))?.target, '校医院负责人');
});

test('纠正采访对象时同步清理问题和追问中的错误称谓', () => {
  const result = normalizeInterviewPlan({
    eventType: '公共服务',
    subjects: [
      { name: '学生代表', role: '主要采访对象', reason: '了解体验' },
      { name: '校医院负责人', role: '补充采访对象', reason: '说明安排' },
    ],
    sections: [{
      title: '调整原因',
      questions: [{
        target: '学生代表',
        question: '学生代表认为延长夜间门诊时间的原因是什么？',
        purpose: '了解原因',
        sourceTitles: [],
        followUp: '如果学生代表提到便利性，可以追问具体细节。',
        priority: 'must',
      }],
    }],
  }, '校医院把夜间门诊延长到十点');

  const question = result.sections[0]?.questions[0];
  assert.equal(question?.target, '校医院负责人');
  assert.doesNotMatch(question?.question || '', /学生代表/u);
  assert.doesNotMatch(question?.followUp || '', /学生代表/u);
});

test('休息学习等个人影响问题交给受影响者而不是执行部门', () => {
  const plan = normalizeInterviewPlan({
    eventType: '政策变化',
    subjects: [
      { name: '后勤部门', role: '主要采访对象', reason: '解释政策' },
      { name: '住宿生', role: '补充采访对象', reason: '说明影响' },
    ],
    sections: [{ title: '政策影响', questions: [
      { target: '后勤部门', question: '你认为宿舍夜间断电政策是否影响了你的休息和学习？', purpose: '了解实际影响', sourceTitles: [], followUp: '请举例。', priority: 'must' },
      { target: '住宿生', question: '这项政策的依据和执行规则是什么？', purpose: '了解政策依据', sourceTitles: [], followUp: '请提供文件。', priority: 'must' },
    ] }],
  }, '宿舍夜间断电政策引发争议，我想采访后勤部门和住宿生。');

  const questions = plan.sections.flatMap((section) => section.questions);
  assert.equal(questions.find((question) => /休息和学习/u.test(question.question))?.target, '住宿生');
  assert.equal(questions.find((question) => /依据和执行规则/u.test(question.question))?.target, '后勤部门');
});

test('受影响者名称不含学生时仍按角色分配影响问题', () => {
  const plan = normalizeInterviewPlan({
    eventType: '人物赛事',
    subjects: [
      { name: '柯洁', role: '主要采访对象', reason: '说明比赛经历' },
      { name: '围棋爱好者', role: '补充采访对象', reason: '说明外界影响' },
    ],
    sections: [{ title: '赛事影响', questions: [
      { target: '柯洁', question: '你认为柯洁夺冠对你有什么影响？', purpose: '了解影响', sourceTitles: [], followUp: '请举例。', priority: 'must' },
    ] }],
  }, '柯洁夺得围棋比赛冠军，我想采访柯洁和围棋爱好者。');

  assert.equal(plan.sections[0]?.questions[0]?.target, '围棋爱好者');
});

test('运营影响和受影响范围问题交给执行方', () => {
  const plan = normalizeInterviewPlan({
    eventType: '政策变化',
    subjects: [
      { name: '食堂负责人', role: '主要采访对象', reason: '说明运营和调整' },
      { name: '学生', role: '补充采访对象', reason: '说明个人体验' },
    ],
    sections: [{ title: '政策影响', questions: [
      { target: '学生', question: '菜价上涨对食堂运营有什么影响？', purpose: '了解运营影响', sourceTitles: [], followUp: '请举例。', priority: 'must' },
      { target: '学生', question: '哪些人会受到直接影响？', purpose: '确认影响范围', sourceTitles: [], followUp: '人数有多少？', priority: 'must' },
    ] }],
  }, '某高校食堂菜价上涨引发讨论，我想采访食堂负责人和学生。');

  for (const question of plan.sections[0]?.questions || []) assert.equal(question.target, '食堂负责人');
});

test('同时询问执行原因和个人影响的多问句应删除', () => {
  const plan = normalizeInterviewPlan({
    eventType: '突发事件',
    subjects: [
      { name: '组织者', role: '主要采访对象', reason: '说明取消决定' },
      { name: '参赛学生', role: '补充采访对象', reason: '说明个人影响' },
    ],
    sections: [{ title: '取消影响', questions: [
      { target: '参赛学生', question: '运动会取消的原因是什么？这对学生有什么影响？', purpose: '了解原因和影响', sourceTitles: [], followUp: '请说明。', priority: 'must' },
      { target: '组织者', question: '运动会何时决定取消？', purpose: '了解时间线', sourceTitles: [], followUp: '谁作出决定？', priority: 'must' },
    ] }],
  }, '学校运动会因暴雨临时取消，我想采访组织者和参赛学生。');

  assert.doesNotMatch(JSON.stringify(plan), /取消的原因是什么/u);
  assert.match(JSON.stringify(plan), /何时决定取消/u);
});

test('采访提纲删除身份确认式问题', () => {
  const plan = normalizeInterviewPlan({
    eventType: '突发事件',
    subjects: [
      { name: '组织者', role: '主要采访对象', reason: '说明决定' },
      { name: '参赛学生', role: '补充采访对象', reason: '说明影响' },
    ],
    sections: [{ title: '现场情况', questions: [
      { target: '组织者', question: '请问您是负责这次学校运动会的组织者吗？如果您不是，请介绍职责。', purpose: '确认身份', sourceTitles: [], followUp: '请说明。', priority: 'must' },
      { target: '组织者', question: '运动会何时决定取消？', purpose: '了解时间线', sourceTitles: [], followUp: '谁作出决定？', priority: 'must' },
    ] }],
  }, '学校运动会因暴雨临时取消，我想采访组织者和参赛学生。');

  assert.doesNotMatch(JSON.stringify(plan), /如果您不是/u);
});

test('采访提纲删除身份确认变体和采访流程元问题', () => {
  const plan = normalizeInterviewPlan({
    eventType: '公共服务',
    subjects: [
      { name: '馆长', role: '主要采访对象', reason: '说明安排' },
      { name: '学生', role: '补充采访对象', reason: '说明体验' },
    ],
    sections: [{ title: '对象确认', questions: [
      { target: '馆长', question: '馆长是你的主要负责人吗？你为什么想采访他？', purpose: '确认对象', sourceTitles: [], followUp: '请说明。', priority: 'must' },
      { target: '馆长', question: '馆长是你的老师吗？', purpose: '确认关系', sourceTitles: [], followUp: '请说明。', priority: 'must' },
      { target: '学生', question: '请问您是学生代表吗？如果不是，请简要介绍一下您的角色和身份。', purpose: '确认身份', sourceTitles: [], followUp: '请说明。', priority: 'must' },
      { target: '学生', question: '你是否愿意接受我们的采访？我们可以安排时间。', purpose: '预约采访', sourceTitles: [], followUp: '何时方便？', priority: 'must' },
      { target: '馆长', question: '延长开放时间的直接原因是什么？', purpose: '了解原因', sourceTitles: [], followUp: '何时决定？', priority: 'must' },
    ] }],
  }, '学校图书馆延长开放时间，我想采访馆长和学生。');

  const serialized = JSON.stringify(plan);
  assert.doesNotMatch(serialized, /为什么想采访|馆长是你的老师吗|如果不是|愿意接受我们的采访|安排时间/u);
  assert.match(serialized, /延长开放时间的直接原因/u);
});

test('普通角色名不会把一般校园事件误判为人物事件', () => {
  const plan = normalizeInterviewPlan({
    eventType: '人物事件',
    subjects: [
      { name: '发起者', role: '主要采访对象', reason: '说明起因' },
      { name: '购买者', role: '补充采访对象', reason: '说明体验' },
    ],
    sections: [{ title: '现象起因', questions: [
      { target: '发起者', question: '最初为什么开始摆摊？', purpose: '了解起因', sourceTitles: [], followUp: '最早是哪一天？', priority: 'must' },
    ] }],
  }, '毕业生在校园摆摊售卖二手物品走红，我想采访发起者和购买者。');

  assert.equal(plan.eventType, '一般事件');
});

test('一般事件补充问题不使用空泛角色模板', () => {
  const plan = normalizeInterviewPlan({
    eventType: '一般事件',
    subjects: [
      { name: '事件当事人', role: '主要采访对象', reason: '了解起因' },
      { name: '事件相关人员', role: '补充采访对象', reason: '了解体验' },
    ],
    sections: [{ title: '现象起因', questions: [
      { target: '事件当事人', question: '最初为什么开始摆摊？', purpose: '了解起因', sourceTitles: [], followUp: '最早是哪一天？', priority: 'must' },
    ] }],
  }, '毕业生在校园摆摊售卖二手物品走红，我想采访发起者和购买者。');

  assert.doesNotMatch(JSON.stringify(plan), /相关各方分别承担什么角色|目前还有哪些事实没有确认/u);
});
