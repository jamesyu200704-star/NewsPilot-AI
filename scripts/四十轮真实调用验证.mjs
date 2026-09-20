const apiBase = process.env.NEWSPILOT_API_BASE || 'http://127.0.0.1:8787';

const interviewCases = [
  {
    id: 'I01',
    sourceText: '学校要取消校园夜间班车，我想采访经常坐车的学生和后勤负责人',
    required: ['学生', '后勤负责人'],
    forbidden: ['柯洁', '鹅腿阿姨', '比赛'],
  },
  {
    id: 'I02',
    sourceText: '校医院把夜间门诊延长到十点',
    required: ['校医院'],
    forbidden: ['比赛', '食堂', '鹅腿阿姨'],
  },
  {
    id: 'I03',
    sourceText: '校园音乐节因为暴雨临时取消',
    required: ['音乐节'],
    forbidden: ['比赛', '菜价', '柯洁'],
  },
  {
    id: 'I04',
    sourceText: '鹅腿阿姨重新回到清华校园摆摊',
    required: ['鹅腿阿姨'],
    forbidden: ['比赛', '冠军', '党毅飞'],
  },
  {
    id: 'I05',
    sourceText: '学校发布学生使用生成式AI写作的新规定',
    required: ['AI'],
    forbidden: ['比赛', '食堂', '鹅腿阿姨'],
  },
  {
    id: 'I06',
    sourceText: '校队队长李明带队夺得全国大学生篮球联赛冠军',
    required: ['李明'],
    forbidden: ['鹅腿阿姨', '食堂', '图书馆'],
  },
];

const newsCases = [
  {
    id: 'N01',
    action: 'polish',
    sourceText: '9月18日，学校图书馆宣布晚间开放时间延长至22时。馆长王明说：“我们希望给学生更多安静学习的时间。”新安排从9月21日起实行。',
    required: ['9月18日', '22', '9月21日', '我们希望给学生更多安静学习的时间'],
  },
  {
    id: 'N02',
    action: 'structure',
    sourceText: '学校已于9月10日启用新的校园夜间班车。班车每天21时和22时各发一班，线路连接图书馆、宿舍区和东门。后勤处表示，试运行将持续30天。',
    required: ['9月10日', '21', '22', '图书馆', '宿舍区', '东门', '30'],
  },
  {
    id: 'N03',
    action: 'commentary',
    sourceText: '学校宣布将图书馆闭馆时间从22时延长至23时。校方表示，此举回应了学生晚间学习空间不足的问题。部分学生认为延时开放方便复习，也有人担心工作人员负担增加。',
    required: ['22', '23'],
  },
  {
    id: 'N04',
    action: 'polish',
    sourceText: '校队在决赛中以3比1战胜对手。队长李明表示：“第三局落后时，大家没有慌。”这是校队5年来首次夺冠。',
    required: ['3比1', '第三局落后时，大家没有慌', '5年'],
  },
];

const selectedCaseIds = new Set(
  (process.env.NEWSPILOT_CASES || '')
    .split(',')
    .map((item) => item.trim())
    .filter(Boolean),
);
const selectCases = (cases) => selectedCaseIds.size
  ? cases.filter((item) => selectedCaseIds.has(item.id))
  : cases;

const post = async (body) => {
  const response = await fetch(`${apiBase}/api/editor`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });
  const payload = await response.json();
  if (!response.ok) throw new Error(`${response.status}: ${payload.error || '请求失败'}`);
  return payload;
};

const runInterview = async (testCase) => {
  const startedAt = Date.now();
  const result = await post({ taskType: 'interview', sourceText: testCase.sourceText });
  const questions = result.interviewPlan?.sections?.flatMap((section) => section.questions || []) || [];
  const subjects = result.interviewPlan?.subjects || [];
  const allText = JSON.stringify({ understanding: result.understanding, subjects, questions });
  const checks = {
    localQwen: result.mode === 'qwen',
    hasUnderstanding: Boolean(result.understanding?.event && result.understanding?.interviewNeed),
    subjectCount: subjects.length >= 2 && subjects.length <= 4,
    questionCount: questions.length >= 6 && questions.length <= 8,
    targetsExist: questions.every((question) => subjects.some((subject) => subject.name === question.target)),
    noCompoundQuestion: questions.every((question) => (question.question.match(/[？?]/gu) || []).length <= 1),
    requiredTerms: testCase.required.every((term) => allText.toLowerCase().includes(term.toLowerCase())),
    noCrossTopic: testCase.forbidden.every((term) => !allText.includes(term)),
  };
  return {
    id: testCase.id,
    type: 'interview',
    sourceText: testCase.sourceText,
    elapsedMs: Date.now() - startedAt,
    passed: Object.values(checks).every(Boolean),
    checks,
    eventType: result.interviewPlan?.eventType,
    subjects: subjects.map((subject) => subject.name),
    questionCount: questions.length,
  };
};

const numbers = (text) => text.match(/\d+(?:\.\d+)?/gu) || [];

const runNews = async (testCase) => {
  const startedAt = Date.now();
  const result = await post({ taskType: 'news_edit', action: testCase.action, sourceText: testCase.sourceText });
  const inputNumbers = new Set(numbers(testCase.sourceText));
  const outputNumbers = numbers(result.output);
  const checks = {
    localQwen: result.mode === 'qwen',
    completeOutput: typeof result.output === 'string' && result.output.trim().length >= 20,
    requiredFacts: testCase.required.every((term) => result.output.includes(term)),
    noInventedNumbers: outputNumbers.every((number) => inputNumbers.has(number)),
    noMockLabel: !/mock|模拟/iu.test(JSON.stringify(result)),
  };
  return {
    id: testCase.id,
    type: 'news_edit',
    action: testCase.action,
    elapsedMs: Date.now() - startedAt,
    passed: Object.values(checks).every(Boolean),
    checks,
    missingRequiredFacts: testCase.required.filter((term) => !result.output.includes(term)),
    outputLength: result.output.length,
    notes: result.notes,
    verificationNeeded: result.verificationNeeded,
  };
};

const runPair = async (cases, runner) => {
  const results = [];
  for (let index = 0; index < cases.length; index += 2) {
    results.push(...await Promise.all(cases.slice(index, index + 2).map(runner)));
  }
  return results;
};

const interviewResults = await runPair(selectCases(interviewCases), runInterview);
const newsResults = await runPair(selectCases(newsCases), runNews);
const results = [...interviewResults, ...newsResults];
process.stdout.write(JSON.stringify({
  generatedAt: new Date().toISOString(),
  passed: results.filter((item) => item.passed).length,
  total: results.length,
  results,
}, null, 2));

if (results.some((item) => !item.passed)) process.exitCode = 1;
