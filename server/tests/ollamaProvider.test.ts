import assert from 'node:assert/strict';
import test from 'node:test';
import {
  editorialRevisionJsonSchema,
  generationContentJsonSchema,
  verificationReviewJsonSchema,
} from '../../shared/generation.js';
import {
  createMockEditorialRevision,
  createMockVerificationReview,
} from '../../shared/mockAgents.js';
import { createMockGenerationContent } from '../../shared/mockGeneration.js';
import { buildPlanningContext } from '../../shared/新闻方法论.js';
import { OllamaProvider } from '../providers/OllamaProvider.js';
import {
  OllamaConnectionError,
  OllamaModelNotFoundError,
  type OllamaFetchImplementation,
} from '../services/ollama.js';
import { sampleInput } from './fixtures.js';

const sampleContext = buildPlanningContext(sampleInput);
const generationContent = () => createMockGenerationContent(sampleContext);

const toOllamaResponse = (content: string, status = 200) =>
  new Response(
    JSON.stringify({
      model: 'qwen3:8b',
      message: {
        role: 'assistant',
        content,
      },
      done: true,
    }),
    {
      status,
      headers: { 'Content-Type': 'application/json' },
    },
  );

const hasSchemaKeyword = (value: unknown, keyword: string): boolean => {
  if (Array.isArray(value)) {
    return value.some((item) => hasSchemaKeyword(item, keyword));
  }

  if (typeof value !== 'object' || value === null) {
    return false;
  }

  return Object.entries(value).some(
    ([key, item]) => key === keyword || hasSchemaKeyword(item, keyword),
  );
};

test('OllamaProvider 调用本地 chat API 并解析结构化结果', async () => {
  let capturedUrl = '';
  let capturedInit: RequestInit | undefined;
  const fakeFetch: OllamaFetchImplementation = async (input, init) => {
    capturedUrl = String(input);
    capturedInit = init;
    return toOllamaResponse(JSON.stringify(generationContent()));
  };
  const provider = new OllamaProvider({
    baseUrl: 'http://localhost:11434/',
    model: 'qwen3:8b',
    fetchImplementation: fakeFetch,
  });

  const result = await provider.generate(sampleContext);
  const requestBody = JSON.parse(String(capturedInit?.body)) as {
    model: string;
    stream: boolean;
    think: boolean;
    options: { temperature: number; num_predict: number };
    format: unknown;
    messages: Array<{ role: string; content: string }>;
  };

  assert.equal(capturedUrl, 'http://localhost:11434/api/chat');
  assert.equal(requestBody.model, 'qwen3:8b');
  assert.equal(requestBody.stream, false);
  assert.equal(requestBody.think, false);
  assert.equal(requestBody.options.num_predict, 2048);
  assert.equal(hasSchemaKeyword(generationContentJsonSchema, 'pattern'), true);
  assert.equal(hasSchemaKeyword(requestBody.format, 'pattern'), false);
  assert.equal(hasSchemaKeyword(requestBody.format, 'minLength'), true);
  assert.equal(hasSchemaKeyword(requestBody.format, 'maxLength'), false);
  assert.equal(requestBody.messages[0]?.role, 'system');
  assert.match(requestBody.messages[0]?.content ?? '', /禁止编造事实/);
  assert.equal(result.angles.length, 3);
  assert.ok(result.dataNeeds.length >= 4);
});

test('OllamaProvider 遇到无效 JSON 时只重试一次', async () => {
  let calls = 0;
  const provider = new OllamaProvider({
    baseUrl: 'http://localhost:11434',
    model: 'qwen3:8b',
    fetchImplementation: async () => {
      calls += 1;
      return toOllamaResponse(
        calls === 1 ? '{ invalid json' : JSON.stringify(generationContent()),
      );
    },
  });

  const result = await provider.generate(sampleContext);

  assert.equal(calls, 2);
  assert.equal(result.angles.length, 3);
});

test('OllamaProvider 编辑任务使用精简结构化 Schema 并由服务端补充元数据', async () => {
  let capturedBody: { format?: unknown } = {};
  const provider = new OllamaProvider({
    baseUrl: 'http://localhost:11434',
    model: 'qwen2.5:1.5b',
    fetchImplementation: async (_input, init) => {
      capturedBody = JSON.parse(String(init?.body));
      return toOllamaResponse(
        JSON.stringify({
          eventType: '人物赛事',
          subjects: [
            { name: '柯洁', role: '主要采访对象', reason: '赛事当事人' },
            { name: '对手或教练', role: '补充采访对象', reason: '补充比赛视角' },
          ],
          sections: [
            { title: '赛前准备', questions: [{ target: '柯洁', question: '赛前如何准备？', purpose: '了解准备', sourceTitles: [], followUp: '具体做了什么？', priority: 'must' }] },
            { title: '关键过程', questions: [{ target: '柯洁', question: '关键转折是什么？', purpose: '还原过程', sourceTitles: [], followUp: '当时如何判断？', priority: 'must' }] },
            { title: '赛后影响', questions: [{ target: '对手或教练', question: '这次胜利有何影响？', purpose: '了解影响', sourceTitles: [], followUp: '下一步计划？', priority: 'optional' }] },
          ],
        }),
      );
    },
  });

  const result = await provider.runEditorialTask({
    taskType: 'interview',
    sourceText: '柯洁赢棋',
  });

  assert.equal(typeof capturedBody.format, 'object');
  assert.equal(hasSchemaKeyword(capturedBody.format, 'maxLength'), false);
  assert.equal(hasSchemaKeyword(capturedBody.format, 'pattern'), false);
  assert.equal(result.taskType, 'interview');
  assert.equal(result.mode, 'ollama');
  assert.match(result.generatedAt, /^\d{4}-\d{2}-\d{2}T/u);
  assert.equal(result.understanding?.interviewSubject, '柯洁');
  assert.equal(result.interviewPlan?.eventType, '人物赛事');
  assert.equal(hasSchemaKeyword(capturedBody.format, 'verification'), false);
  assert.ok(result.notes.length > 0);
  assert.ok(result.verificationNeeded.length > 0);
});

test('语言润色拒绝模型凭空换算日期并清理无意义确认项', async () => {
  let calls = 0;
  const sourceText = '9月17日下午，学校图书馆宣布下周一延长开放至晚上十点。';
  const provider = new OllamaProvider({
    baseUrl: 'http://localhost:11434',
    model: 'qwen2.5:1.5b',
    fetchImplementation: async () => {
      calls += 1;
      return toOllamaResponse(JSON.stringify({
        title: '图书馆延长晚间开放时间',
        output: calls === 1
          ? '学校图书馆宣布，9月24日起延长开放至晚上十点。'
          : '9月17日下午，学校图书馆宣布：从下周一开始，开放时间延长至晚上十点。',
        notes: ['9月24日开始实施。'],
        verificationNeeded: ['无'],
      }));
    },
  });

  const result = await provider.runEditorialTask({ taskType: 'news_edit', action: 'polish', sourceText });

  assert.equal(calls, 2);
  assert.match(result.output, /下周一/u);
  assert.doesNotMatch(result.output, /9月24日/u);
  assert.deepEqual(result.verificationNeeded, []);
  assert.ok(result.notes.every((note) => !/9月24日/u.test(note)));
});

test('语言润色允许中文数字时间改为阿拉伯数字写法', async () => {
  let calls = 0;
  const sourceText = '图书馆宣布下周一延长开放至晚上十点。';
  const provider = new OllamaProvider({
    baseUrl: 'http://localhost:11434',
    model: 'qwen2.5:1.5b',
    fetchImplementation: async () => {
      calls += 1;
      return toOllamaResponse(JSON.stringify({
        title: '图书馆延长晚间开放时间',
        output: '图书馆宣布，下周一晚间开放时间将延长至10点。',
        notes: ['统一时间写法。'],
        verificationNeeded: [],
      }));
    },
  });

  const result = await provider.runEditorialTask({ taskType: 'news_edit', action: 'polish', sourceText });

  assert.equal(calls, 1);
  assert.match(result.output, /10点/u);
  assert.match(result.output, /下周一/u);
});

test('语言润色允许比分中文数字改成阿拉伯数字', async () => {
  const sourceText = '昨天晚上，校队在比赛里面以三比二赢了对手，最终获得了冠军。';
  const provider = new OllamaProvider({
    baseUrl: 'http://localhost:11434',
    model: 'qwen2.5:1.5b',
    fetchImplementation: async () => toOllamaResponse(JSON.stringify({
      title: '校队三比二获胜夺冠',
      output: '昨天晚上，校队以3比2战胜对手，最终获得冠军。',
      notes: ['压缩口语表达。'],
      verificationNeeded: [],
    })),
  });

  const result = await provider.runEditorialTask({ taskType: 'news_edit', action: 'polish', sourceText });

  assert.equal(result.mode, 'ollama');
  assert.match(result.output, /3比2/u);
});

test('语言润色不得改变原稿数量判断和观点关系', async () => {
  const sourceText = '学校召开会议，大家认为校园安全重要。很多同学希望增加夜间班车，但也有学生反对。';
  const provider = new OllamaProvider({
    baseUrl: 'http://localhost:11434',
    model: 'qwen2.5:1.5b',
    fetchImplementation: async () => toOllamaResponse(JSON.stringify({
      title: '校园安全会议引发讨论',
      output: '学校召开会议，大家一致认为校园安全十分重要。部分学生希望增加夜间班车。',
      notes: ['压缩重复表达。'],
      verificationNeeded: [],
    })),
  });

  const result = await provider.runEditorialTask({ taskType: 'news_edit', action: 'polish', sourceText });

  assert.equal(result.mode, 'mock');
  assert.equal(result.output, sourceText);
  assert.equal(result.verificationNeeded.length, 0);
  assert.match(result.notes.join(''), /本地模型初稿未通过事实检查/u);
  assert.match(result.fallbackNotice || '', /没有通过事实检查/u);
});

test('语言润色把原稿中的受保护事实逐项写入模型指令', async () => {
  let capturedSystem = '';
  const sourceText = '9月17日下午，图书馆宣布下周一延长开放至晚上十点。';
  const provider = new OllamaProvider({
    baseUrl: 'http://localhost:11434',
    model: 'qwen2.5:1.5b',
    fetchImplementation: async (_input, init) => {
      const body = JSON.parse(String(init?.body)) as {
        messages: Array<{ role: string; content: string }>;
      };
      capturedSystem = body.messages[0]?.content ?? '';
      return toOllamaResponse(JSON.stringify({
        title: '图书馆延长晚间开放时间',
        output: '9月17日下午，图书馆宣布：从下周一起，开放时间延长至晚上十点。',
        notes: ['调整句式。'],
        verificationNeeded: [],
      }));
    },
  });

  await provider.runEditorialTask({ taskType: 'news_edit', action: 'polish', sourceText });

  assert.match(capturedSystem, /必须保留/u);
  assert.match(capturedSystem, /9月17日/u);
  assert.match(capturedSystem, /下周一/u);
  assert.match(capturedSystem, /十点/u);
});

test('语言润色正文原样照抄时自动重试', async () => {
  let calls = 0;
  const sourceText = '学校图书馆发布了新的开放安排。新的安排是下周一延长开放至晚上十点。';
  const provider = new OllamaProvider({
    baseUrl: 'http://localhost:11434',
    model: 'qwen2.5:1.5b',
    fetchImplementation: async () => {
      calls += 1;
      return toOllamaResponse(JSON.stringify({
        title: '图书馆延长晚间开放时间',
        output: calls === 1
          ? sourceText
          : '学校图书馆发布新开放安排：从下周一起，开放时间延长至晚上十点。',
        notes: ['调整句式。'],
        verificationNeeded: [],
      }));
    },
  });

  const result = await provider.runEditorialTask({ taskType: 'news_edit', action: 'polish', sourceText });

  assert.equal(calls, 2);
  assert.notEqual(result.output, sourceText);
});

test('结构修改拒绝把已宣布改成计划宣布', async () => {
  let calls = 0;
  const sourceText = '9月17日下午，学校图书馆宣布下周一延长开放至晚上十点。学生可以通过预约系统入馆。';
  const provider = new OllamaProvider({
    baseUrl: 'http://localhost:11434',
    model: 'qwen2.5:1.5b',
    fetchImplementation: async () => {
      calls += 1;
      return toOllamaResponse(JSON.stringify({
        title: '图书馆延长开放时间',
        output: calls === 1
          ? '学校图书馆计划于9月17日下午宣布，下周一延长开放至晚上十点。学生可以通过预约系统入馆。'
          : '9月17日下午，学校图书馆宣布延长开放时间：下周一起晚间开放至晚上十点，学生可通过预约系统入馆。',
        notes: ['调整导语和段落顺序。'],
        verificationNeeded: [],
      }));
    },
  });

  const result = await provider.runEditorialTask({ taskType: 'news_edit', action: 'structure', sourceText });

  assert.equal(calls, 2);
  assert.doesNotMatch(result.output, /计划.{0,12}宣布/u);
});

test('结构修改不从闭馆时间推断未提供的开放时段', async () => {
  const sourceText = '学校图书馆宣布，晚间闭馆时间由晚上九点调整至晚上十点。';
  const provider = new OllamaProvider({
    baseUrl: 'http://localhost:11434',
    model: 'qwen2.5:1.5b',
    fetchImplementation: async () => toOllamaResponse(JSON.stringify({
      title: '图书馆调整开放时间',
      output: '新的开放时间为晚上九点到晚上十点。',
      notes: ['调整结构。'],
      verificationNeeded: [],
    })),
  });

  const result = await provider.runEditorialTask({ taskType: 'news_edit', action: 'structure', sourceText });

  assert.equal(result.mode, 'mock');
  assert.equal(result.output, sourceText);
});

test('新闻评论拒绝新增原稿没有的行动和回应', async () => {
  let calls = 0;
  const sourceText = '学校图书馆宣布下周一延长开放至晚上十点。部分学生认为延长开放时间有助于备考。';
  const provider = new OllamaProvider({
    baseUrl: 'http://localhost:11434',
    model: 'qwen2.5:1.5b',
    fetchImplementation: async () => {
      calls += 1;
      return toOllamaResponse(JSON.stringify({
        title: '延长开放还需关注实际需求',
        output: calls === 1
          ? '学校相关部门正在收集反馈，并计划增设自习区。延长开放值得肯定。'
          : '学校图书馆宣布下周一延长开放至晚上十点。延长开放值得肯定，但公共服务不能只看时间长度，还应关注学生的实际需要。',
        notes: ['围绕原稿事实提炼评论观点。'],
        verificationNeeded: [],
      }));
    },
  });

  const result = await provider.runEditorialTask({ taskType: 'news_edit', action: 'commentary', sourceText });

  assert.equal(calls, 2);
  assert.doesNotMatch(result.output, /正在收集反馈|增设自习区/u);
});

test('新闻评论拒绝只有事实摘要或倒置原稿数字顺序', async () => {
  let calls = 0;
  const sourceText = '学校图书馆宣布，晚间闭馆时间由晚上九点调整至晚上十点。';
  const provider = new OllamaProvider({
    baseUrl: 'http://localhost:11434',
    model: 'qwen2.5:1.5b',
    fetchImplementation: async () => {
      calls += 1;
      return toOllamaResponse(JSON.stringify({
        title: '图书馆调整开放时间',
        output: calls === 1
          ? '学校图书馆宣布开放至晚上十点，调整后的晚间闭馆时间为晚上九点。'
          : '学校图书馆宣布，晚间闭馆时间由晚上九点调整至晚上十点。延长开放值得肯定，但公共服务不能只看开放时长，还应关注实际使用效果。',
        notes: ['围绕原稿事实提炼评论观点。'],
        verificationNeeded: [],
      }));
    },
  });

  const result = await provider.runEditorialTask({ taskType: 'news_edit', action: 'commentary', sourceText });

  assert.equal(calls, 2);
  assert.match(result.output, /值得|不能|应/u);
  assert.match(result.output, /九点.*十点/u);
});

test('新闻编辑质量校验连续失败时保留安全结果但不把模型错误当成原稿问题', async () => {
  const sourceText = '学校图书馆宣布下周一延长开放至晚上十点。';
  const provider = new OllamaProvider({
    baseUrl: 'http://localhost:11434',
    model: 'qwen2.5:1.5b',
    fetchImplementation: async () => toOllamaResponse(JSON.stringify({
      title: '图书馆计划宣布调整',
      output: '学校图书馆计划宣布调整开放安排。',
      notes: [],
      verificationNeeded: [],
    })),
  });

  const result = await provider.runEditorialTask({ taskType: 'news_edit', action: 'structure', sourceText });

  assert.equal(result.mode, 'mock');
  assert.equal(result.output, sourceText);
  assert.equal(result.verificationNeeded.length, 0);
  assert.match(result.notes.join(''), /本地模型初稿未通过事实检查/u);
});

test('新闻评论连续失败时生成基于原稿的保守评论', async () => {
  const sourceText = '学校宣布将图书馆闭馆时间从22时延长至23时。部分学生认为延时开放方便复习，也有人担心工作人员负担增加。';
  const provider = new OllamaProvider({
    baseUrl: 'http://localhost:11434',
    model: 'qwen2.5:1.5b',
    fetchImplementation: async () => toOllamaResponse(JSON.stringify({
      title: '图书馆调整引发师生争议',
      output: '教师和学生已经就延时开放发生争议。',
      notes: [],
      verificationNeeded: [],
    })),
  });

  const result = await provider.runEditorialTask({ taskType: 'news_edit', action: 'commentary', sourceText });

  assert.equal(result.verificationNeeded.length, 0);
  assert.match(result.output, /评价一项安排不能只看结果/u);
  assert.match(result.output, /事实、影响和执行/u);
  assert.doesNotMatch(result.output, /教师和学生已经/u);
});

test('OllamaProvider 结构校验失败后把具体错误反馈给第二次请求', async () => {
  const invalidContent = generationContent();
  invalidContent.angles[0].newsValueScore = 6;
  const capturedBodies: Array<{
    messages: Array<{ role: string; content: string }>;
  }> = [];
  const provider = new OllamaProvider({
    baseUrl: 'http://localhost:11434',
    model: 'qwen2.5:1.5b',
    fetchImplementation: async (_input, init) => {
      capturedBodies.push(JSON.parse(String(init?.body)));
      return toOllamaResponse(
        capturedBodies.length === 1
          ? JSON.stringify(invalidContent)
          : JSON.stringify(generationContent()),
      );
    },
  });

  const result = await provider.generate(sampleContext);

  assert.equal(capturedBodies.length, 2);
  assert.equal(result.angles.length, 3);
  assert.equal(capturedBodies[1]?.messages.length, 2);
  assert.match(
    capturedBodies[1]?.messages[0]?.content ?? '',
    /newsValueScore.*5/u,
  );
  assert.equal(
    capturedBodies[1]?.messages[1]?.content,
    capturedBodies[0]?.messages[1]?.content,
  );
});

test('OllamaProvider 为 Qwen 执行独立事实核查与编辑终审调用', async () => {
  const draft = generationContent();
  const verification = createMockVerificationReview(sampleContext, draft);
  const editorial = createMockEditorialRevision(
    sampleContext,
    draft,
    verification,
  );
  const capturedBodies: Array<{
    format: unknown;
    messages: Array<{ content: string }>;
  }> = [];
  const responses = [verification, editorial];
  const provider = new OllamaProvider({
    baseUrl: 'http://localhost:11434',
    model: 'qwen3:8b',
    fetchImplementation: async (_input, init) => {
      capturedBodies.push(JSON.parse(String(init?.body)));
      return toOllamaResponse(
        JSON.stringify(responses[capturedBodies.length - 1]),
      );
    },
  });

  const reviewed = await provider.verify(sampleContext, draft);
  const revised = await provider.edit(sampleContext, draft, reviewed);

  assert.equal(capturedBodies.length, 2);
  assert.equal(
    hasSchemaKeyword(verificationReviewJsonSchema, 'pattern'),
    true,
  );
  assert.equal(hasSchemaKeyword(capturedBodies[0]?.format, 'pattern'), false);
  assert.match(
    capturedBodies[0]?.messages[0]?.content ?? '',
    /事实核查 Agent/u,
  );
  assert.equal(hasSchemaKeyword(editorialRevisionJsonSchema, 'pattern'), true);
  assert.equal(hasSchemaKeyword(capturedBodies[1]?.format, 'pattern'), false);
  assert.match(
    capturedBodies[1]?.messages[0]?.content ?? '',
    /新闻编辑 Agent/u,
  );
  assert.equal(revised.content.angles.length, 3);
});

test('OllamaProvider 终审分数越界时保留已校验的策划分数', async () => {
  const draft = generationContent();
  const verification = createMockVerificationReview(sampleContext, draft);
  const editorial = createMockEditorialRevision(
    sampleContext,
    draft,
    verification,
  );
  editorial.content.angles = editorial.content.angles.map((angle, index) => ({
    ...angle,
    newsValueScore: 8 + index,
  }));
  let calls = 0;
  const provider = new OllamaProvider({
    baseUrl: 'http://localhost:11434',
    model: 'qwen2.5:1.5b',
    fetchImplementation: async () => {
      calls += 1;
      return toOllamaResponse(JSON.stringify(editorial));
    },
  });

  const revised = await provider.edit(sampleContext, draft, verification);

  assert.equal(calls, 1);
  assert.deepEqual(
    revised.content.angles.map((angle) => angle.newsValueScore),
    draft.angles.map((angle) => angle.newsValueScore),
  );
});

test('OllamaProvider 两次返回无效 JSON 后停止重试', async () => {
  let calls = 0;
  const provider = new OllamaProvider({
    baseUrl: 'http://localhost:11434',
    model: 'qwen3:8b',
    fetchImplementation: async () => {
      calls += 1;
      return toOllamaResponse('{ invalid json');
    },
  });

  await assert.rejects(() => provider.generate(sampleContext), /有效 JSON/);
  assert.equal(calls, 2);
});

test('OllamaProvider 将连接失败映射为可操作提示', async () => {
  const provider = new OllamaProvider({
    baseUrl: 'http://localhost:11434',
    model: 'qwen3:8b',
    fetchImplementation: async () => {
      throw new TypeError('fetch failed');
    },
  });

  await assert.rejects(
    () => provider.generate(sampleContext),
    (error) =>
      error instanceof OllamaConnectionError &&
      error.message === '请启动 Ollama 服务。',
  );
});

test('OllamaProvider 将模型缺失映射为可操作提示', async () => {
  const provider = new OllamaProvider({
    baseUrl: 'http://localhost:11434',
    model: 'qwen3:8b',
    fetchImplementation: async () =>
      new Response(JSON.stringify({ error: 'model not found' }), {
        status: 404,
        headers: { 'Content-Type': 'application/json' },
      }),
  });

  await assert.rejects(
    () => provider.generate(sampleContext),
    (error) =>
      error instanceof OllamaModelNotFoundError &&
      error.message === '请下载对应模型。',
  );
});
