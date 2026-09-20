import type { GenerationMode } from './generation.js';

export type EditorialTaskType = 'interview' | 'news_edit';
export type NewsEditAction = 'polish' | 'structure' | 'commentary';

export interface EditorialResearchSource {
  title: string;
  url?: string;
  snippet: string;
  sourceName: string;
  publishedAt?: string;
}

export interface EditorialResearch {
  status: 'live' | 'failed' | 'manual' | 'mock';
  notice: string;
  sources: EditorialResearchSource[];
}

export type InterviewSubjectRole = '主要采访对象' | '补充采访对象';

export interface InterviewPlan {
  eventType: string;
  subjects: Array<{
    name: string;
    role: InterviewSubjectRole;
    reason: string;
  }>;
  sections: Array<{
    title: string;
    questions: Array<{
      target: string;
      question: string;
      purpose: string;
      sourceTitles: string[];
      followUp: string;
      priority: 'must' | 'optional';
    }>;
  }>;
}

const domainSignals = [
  /赛前|比赛中|比赛|胜负|夺冠|联赛|决赛/u,
  /食堂|餐厅|餐饮|饭菜|后厨/u,
  /伤员|消防|救援|事故责任|火灾/u,
  /营收|股价|董事会|融资|财报/u,
] as const;

const genericSubject = /代表|负责人|工作人员|专家|学者|当事人|相关人员|参与者|目击者|居民|师生|学生|教师|教练|对手|部门|机构|团队|主办方|组织者|发起者|购买者/u;
const looksLikeUngroundedPersonName = (name: string, evidenceText: string) =>
  /^[\u4e00-\u9fff]{2,4}$/u.test(name) && !genericSubject.test(name) && !evidenceText.includes(name);

const fallbackSubjectsByType: Record<string, [string, string]> = {
  企业动态: ['企业负责人', '相关领域专家'],
  公共服务: ['受影响者代表', '服务运营负责人'],
  文化事件: ['创作者', '文化行业观察者'],
  重大会议: ['参会或关注者代表', '相关领域专家'],
  政策变化: ['受影响者代表', '政策执行部门负责人'],
  突发事件: ['事件相关人员', '处置部门负责人'],
  公共争议: ['争议当事人', '相关领域专家'],
  人物赛事: ['参赛者', '赛事相关人员'],
  人物事件: ['事件当事人', '事件相关人员'],
};

const eventTypeSignals: Record<string, RegExp> = {
  人物赛事: /比赛|夺冠|冠军|赢|输|棋|联赛|决赛/u,
  重大会议: /党代会|大会|全会|峰会|论坛|会议报告/u,
  政策变化: /政策|规定|办法|通知|调整|规则/u,
  突发事件: /事故|火灾|受伤|失踪|故障|预警|救援/u,
  公共争议: /争议|质疑|回应|道歉|投诉|举报/u,
  企业动态: /公司|企业|产品|手机|汽车|财报|营收|融资/u,
  公共服务: /班车|公交|地铁|公共服务|开放时间|运营|校医院|门诊|就诊|医疗服务/u,
  文化事件: /电影|导演|演员|展览|演出|音乐|小说|作家/u,
};

const subjectRoleSignals: Array<[RegExp, RegExp]> = [
  [/学生|教师|校方|食堂/u, /校园|学校|高校|大学|教育|学生|教师|青年|食堂|校医院|门诊|就诊/u],
  [/监管|市监|执法/u, /监管|市监|市场监督|调查|执法|通报/u],
  [/投资者|股东|债权人/u, /投资|股东|债务|债权|融资|股票|证券/u],
  [/医生|医护|患者/u, /医院|医疗|医生|患者|疾病|救治/u],
  [/消费者|用户代表/u, /消费|用户|产品|购买|服务/u],
];

const subjectRoleGrounded = (name: string, evidenceText: string) =>
  subjectRoleSignals.every(([subjectPattern, contextPattern]) => !subjectPattern.test(name) || contextPattern.test(evidenceText));

const extractRequestedSubjects = (topic: string) => {
  const segment = topic.match(/(?:我(?:想|要|准备)?|请(?:帮我)?|希望)?采访([^。！？?]+)/u)?.[1];
  if (!segment) return [];
  return segment
    .split(/、|和|以及|与/u)
    .map((name) => name.trim().replace(/^(?:一下|这次)/u, '').replace(/(?:等人|等对象)$/u, ''))
    .filter((name) => name.length >= 2 && name.length <= 20 && !/^(?:他|她|他们|她们|对方)$/u.test(name));
};

const equivalentSubject = (left: string, right: string) =>
  left === right || left.includes(right) || right.includes(left);

const questionMentionsSubject = (question: string, subject: string) => {
  const aliases = [subject];
  const stem = subject.replace(/(?:代表|负责人|部门)$/u, '');
  if (stem.length >= 2) aliases.push(stem);
  if (/学生|住宿生/u.test(subject)) aliases.push('学生', '学生代表');
  return aliases.some((alias) => question.includes(alias));
};

const subjectActionStem = (subject: string) => {
  const stem = subject.replace(/(?:学生|参与者|购买者|发起者|住宿生)$/u, '');
  if (/购买者$/u.test(subject)) return '购买';
  if (/发起者$/u.test(subject)) return '发起';
  if (/住宿生$/u.test(subject)) return '住宿';
  return stem.length >= 2 ? stem : undefined;
};

const replaceSelfReference = (question: string, target: string) => {
  const escapedTarget = target.replace(/[.*+?^${}()|[\]\\]/gu, '\\$&');
  let normalized = question
    .replace(
      new RegExp(`[你您]认为${escapedTarget}(?:赢棋|获胜|夺冠|取胜)的原因是什么[？?]?`, 'u'),
      '你认为这场胜利的关键是什么？',
    )
    .replace(new RegExp(`([你您]如何评价)${escapedTarget}`, 'u'), '$1自己');
  if (!genericSubject.test(target)) {
    normalized = normalized
      .replace(new RegExp(`^${escapedTarget}(?=在|因|从|对)`, 'u'), '你')
      .replace(/([你您]认为)[他她](?=的|会|能|夺|获|是)/gu, '$1自己');
  }
  return normalized;
};

const normalizeQuestionPurpose = (purpose: string) => {
  const normalized = purpose
    .replace(/^为什么问[，,:：]?\s*(?:因为)?/u, '')
    .replace(/^用户想了解/u, '了解')
    .trim();
  return normalized && normalized !== '为什么问'
    ? normalized
    : '了解该问题对应的具体事实、过程和判断依据。';
};

const splitCompoundQuestion = (question: string, followUp: string) => {
  const firstQuestionEnd = question.search(/[？?]/u);
  if (firstQuestionEnd < 0 || firstQuestionEnd === question.length - 1) return { question, followUp };
  const primary = question.slice(0, firstQuestionEnd + 1).trim();
  const remainder = question.slice(firstQuestionEnd + 1).trim();
  if (!remainder) return { question, followUp };
  return {
    question: primary,
    followUp: `${remainder}${/[。！？?]$/u.test(remainder) ? '' : '？'} ${followUp}`.trim(),
  };
};

const affectedSubjectSignal = /学生|住宿生|参赛者|购买者|捐款者|居民|消费者|用户|乘客|患者|受影响/u;
const executorSubjectSignal = /部门|负责人|组织者|馆长|校方|主办方|运营方|管理方|执行方|发起者/u;
const affectedQuestionSignal = /休息|学习|生活品质|日常生活|体验|感受|担忧|为什么选择|购买|捐款|参与|有(?:什么|何)影响|受到.{0,6}影响|带来.{0,6}影响|造成.{0,6}影响/u;
const executorQuestionSignal = /(?:直接|具体|取消|调整)?原因是什么|政策依据|制定依据|执行规则|如何制定|如何确定|如何执行|执行过程中|从何时.{0,6}实施|开始实施|收集.{0,6}反馈|处理.{0,6}反馈|谁.{0,6}决定|监督|复议|时间线|核验|官方回应|具体安排|执行标准|处置措施/u;
const unusableInterviewQuestion = /为什么想采访|愿意接受.{0,8}采访|安排.{0,6}(?:采访)?时间|(?:请问)?[你您](?:是|是否是).{0,30}(?:吗|么)|.{2,12}是[你您]的.{0,16}(?:吗|么)|如果(?:[你您])?不是.{0,24}(?:角色|身份|职责)/u;

const resolveQuestionTarget = (
  question: string,
  subjects: InterviewPlan['subjects'],
  fallbackTarget: string,
) => {
  const musicOrganizer = subjects.find((subject) => /音乐节主办方/u.test(subject.name));
  if (musicOrganizer && /主办方|取消.{0,8}原因|作出.{0,8}决定|通知|票务|报名|费用|延期|改期/u.test(question)) {
    return musicOrganizer.name;
  }
  const executorSubject = subjects.find((subject) => executorSubjectSignal.test(subject.name));
  if (/哪些人会受到.{0,6}影响/u.test(question)) {
    return executorSubject?.name || subjects.find((subject) => subject.role === '主要采访对象')?.name || fallbackTarget;
  }
  if (executorSubject) {
    const executorStem = executorSubject.name.replace(/(?:负责人|部门|组织者|运营方|管理方|执行方)$/u, '');
    if (executorStem.length >= 2 && new RegExp(`${executorStem}.{0,12}(?:运营|工作|管理)?.{0,6}影响`, 'u').test(question)) {
      return executorSubject.name;
    }
  }
  if (executorQuestionSignal.test(question) && !affectedQuestionSignal.test(question)) {
    if (executorSubject) return executorSubject.name;
  }
  if (affectedQuestionSignal.test(question)) {
    const affectedSubject = subjects.find((subject) => affectedSubjectSignal.test(subject.name));
    if (affectedSubject) return affectedSubject.name;
    const mentionsKnownSubject = subjects.some((subject) => questionMentionsSubject(question, subject.name));
    if (!mentionsKnownSubject) {
      return subjects.find((subject) => subject.role === '主要采访对象')?.name || fallbackTarget;
    }
    const supplementalSubject = subjects.find((subject) => subject.role === '补充采访对象');
    if (supplementalSubject) return supplementalSubject.name;
  }
  const actionSubjects = subjects.filter((subject) => {
    const actionStem = subjectActionStem(subject.name);
    return actionStem ? question.includes(actionStem) : false;
  });
  if (actionSubjects.length === 1) return actionSubjects[0].name;
  if (executorQuestionSignal.test(question)) {
    if (executorSubject) return executorSubject.name;
  }
  const mentionedSubjects = subjects.filter((subject) => questionMentionsSubject(question, subject.name));
  if (mentionedSubjects.length === 1) return mentionedSubjects[0].name;
  return fallbackTarget;
};

const alignQuestionWordingWithTarget = (
  question: string,
  followUp: string,
  target: string,
) => {
  if (!executorSubjectSignal.test(target)) return { question, followUp };
  return {
    question: question.replace(/^(?:原定参加音乐节的学生|就诊学生代表|学生代表|受影响者代表)(?:认为|如何看待|想了解)?/u, ''),
    followUp: followUp
      .replace(/如果(?:原定参加音乐节的学生|就诊学生代表|学生代表|受影响者代表)(?:回答不明确|提到|认为|表示)/gu, '如果回答不明确或提到相关情况'),
  };
};

const replaceSubjectReferences = (text: string, replacements: Map<string, string>) => {
  let result = text;
  for (const [from, to] of replacements) {
    if (!from || from === to) continue;
    result = result.replaceAll(from, to);
  }
  return result;
};

export const normalizeInterviewPlan = (plan: InterviewPlan, topic = '', evidenceText = topic): InterviewPlan => {
  const subjectNames = new Set(plan.subjects.map((subject) => subject.name));
  const primarySubject = plan.subjects.find((subject) => subject.role === '主要采访对象')?.name || plan.subjects[0]?.name || '主要采访对象';
  const sections = new Map<string, InterviewPlan['sections'][number]>();
  const seenQuestions = new Set<string>();
  let remainingQuestions = 8;
  for (const section of plan.sections) {
    if (remainingQuestions <= 0) break;
    const title = section.title === '按事件类型生成的采访阶段' ? '核心事实' : section.title;
    const existing = sections.get(title);
    const sectionSubject = plan.subjects.find((subject) => section.title.includes(subject.name))?.name;
    const available = section.questions.slice(0, remainingQuestions).filter((question) => {
      if (unusableInterviewQuestion.test(question.question)) return false;
      const key = question.question.replace(/[？?，,。\s]/gu, '');
      if (seenQuestions.has(key)) return false;
      seenQuestions.add(key);
      return true;
    }).map((question) => ({
        ...question,
        target: sectionSubject || (subjectNames.has(question.target) ? question.target : primarySubject),
        purpose: normalizeQuestionPurpose(question.purpose),
        followUp: question.followUp === '回答含糊时追问' ? '能否用一个具体时间、动作或现场细节说明？' : question.followUp,
      }));
    if (existing) {
      const capacity = Math.max(0, 3 - existing.questions.length);
      existing.questions.push(...available.slice(0, capacity));
      remainingQuestions -= Math.min(capacity, available.length);
    } else {
      const questions = available.slice(0, 3);
      sections.set(title, { ...section, title, questions });
      remainingQuestions -= questions.length;
    }
  }
  const placeholderType = /人物赛事、政策变化、突发事件|其他具体类型/u.test(plan.eventType);
  const inferredType = inferEventType(topic);
  const proposedTypeSupported = eventTypeSignals[plan.eventType]?.test(evidenceText);
  const groundedPerson = evidenceText.includes(primarySubject) && !genericSubject.test(primarySubject);
  const eventType = inferredType || (proposedTypeSupported && !placeholderType
    ? plan.eventType
    : groundedPerson ? '人物事件' : '一般事件');
  const foodTopic = /食堂|餐厅|餐饮|饭菜|食品安全/u.test(topic);
  const fallbackSubjects: [string, string] = eventType === '公共服务' && /校医院|门诊|就诊|医疗/u.test(topic)
    ? ['就诊学生代表', '校医院负责人']
    : eventType === '公共服务' && /图书馆|开放时间|闭馆/u.test(topic)
      ? ['学生代表', '图书馆负责人']
      : eventType === '公共服务' && /班车|公交|地铁/u.test(topic)
        ? ['乘客代表', '服务运营负责人']
        : fallbackSubjectsByType[eventType] || ['事件当事人', '事件相关人员'];
  const genericPlanSubject = /^(?:事件当事人|事件相关人员|受影响者代表|服务运营负责人|主要采访对象|补充采访对象)$/u;
  const seenSubjects = new Set<string>();
  let subjects = plan.subjects.map((subject) => {
    if (/^(?:主要|补充)采访对象\d*$/u.test(subject.name) || (eventType !== '人物事件' && genericPlanSubject.test(subject.name))) {
      return { ...subject, name: subject.role === '主要采访对象' ? fallbackSubjects[0] : fallbackSubjects[1] };
    }
    if (eventType === '人物赛事' && subject.role === '补充采访对象') {
      return {
        ...subject,
        name: /学生|食堂|学校|教育厅/u.test(subject.name) ? '赛事相关人员' : subject.name,
        reason: '补充比赛背景、现场观察和不同视角。',
      };
    }
    return subject;
  }
  ).filter((subject) =>
    !looksLikeUngroundedPersonName(subject.name, evidenceText) &&
    subjectRoleGrounded(subject.name, evidenceText) &&
    (foodTopic || !/食堂|餐厅|餐饮|厨师/u.test(`${subject.name}${subject.reason}`)),
  ).filter((subject) => {
    if (seenSubjects.has(subject.name)) return false;
    seenSubjects.add(subject.name);
    return true;
  });
  if (!subjects.some((subject) => subject.role === '主要采访对象')) {
    const affectedIndex = subjects.findIndex((subject) => affectedSubjectSignal.test(subject.name));
    if (affectedIndex >= 0) {
      subjects[affectedIndex] = { ...subjects[affectedIndex], role: '主要采访对象' };
    } else if (subjects[0]) {
      subjects[0] = { ...subjects[0], role: '主要采访对象' };
    }
  }
  if (eventType === '公共服务' && /校医院|门诊|就诊|医疗/u.test(topic)) {
    subjects = subjects.map((subject) =>
      /学生/u.test(subject.name) && !/就诊/u.test(subject.name)
        ? { ...subject, name: '就诊学生代表' }
        : subject,
    );
  }
  const requestedSubjects = extractRequestedSubjects(topic);
  const subjectTargetReplacements = new Map<string, string>();
  if (requestedSubjects.length > 0) {
    const explicitSubjects = requestedSubjects.map((name, index) => {
      const matchingSubject = subjects.find((subject) => equivalentSubject(subject.name, name));
      return {
        name,
        role: (index === 0 ? '主要采访对象' : '补充采访对象') as InterviewSubjectRole,
        reason: matchingSubject?.reason || '用户在采访需求中明确指定。',
      };
    });
    for (const [index, subject] of plan.subjects.entries()) {
      const sameRole = explicitSubjects.find((item) => item.role === subject.role);
      const replacement = sameRole || explicitSubjects[index];
      if (replacement) subjectTargetReplacements.set(subject.name, replacement.name);
    }
    const remainingSubjects = requestedSubjects.length >= 2
      ? []
      : subjects.filter((subject) => !requestedSubjects.some((name) => equivalentSubject(subject.name, name)));
    subjects = [...explicitSubjects, ...remainingSubjects].slice(0, 4);
  }
  const musicCancellationTopic = eventType === '突发事件' &&
    /音乐节|演出|文艺活动/u.test(topic) && /取消|延期|中止|暴雨|天气/u.test(topic);
  if (requestedSubjects.length === 0 && musicCancellationTopic) {
    const concreteSubjects: InterviewPlan['subjects'] = [
      { name: '原定参加音乐节的学生', role: '主要采访对象', reason: '说明临时取消带来的实际影响和现场体验。' },
      { name: '音乐节主办方', role: '补充采访对象', reason: '说明取消决定、通知过程和后续安排。' },
    ];
    for (const subject of subjects) {
      const replacement = concreteSubjects.find((item) => item.role === subject.role);
      if (replacement) subjectTargetReplacements.set(subject.name, replacement.name);
    }
    subjects = concreteSubjects;
  }
  const teamSportTopic = eventType === '人物赛事' && /篮球|足球|排球|校队|球队/u.test(topic);
  if (requestedSubjects.length === 0 && teamSportTopic) {
    const namedPrimary = subjects.find((subject) =>
      subject.role === '主要采访对象' && !genericSubject.test(subject.name),
    )?.name;
    subjects = subjects.map((subject) => {
      if (subject.role === '补充采访对象' && /赛事相关人员|事件相关人员|相关人员/u.test(subject.name)) {
        const replacementName = namedPrimary ? `${namedPrimary}的队友或教练` : '队友或教练';
        subjectTargetReplacements.set(subject.name, replacementName);
        return {
            ...subject,
            name: replacementName,
            reason: '补充备战过程、团队配合和比赛现场观察。',
          };
      }
      return subject;
    });
  }
  const replacementNames = eventType === '重大会议'
    ? ['参会或关注者代表', '相关领域专家']
    : [fallbackSubjects[0], fallbackSubjects[1], '事件相关人员'];
  for (const name of replacementNames) {
    if (subjects.length >= 2) break;
    if (subjects.some((subject) => subject.name === name)) continue;
    subjects.push({
      name,
      role: subjects.some((subject) => subject.role === '主要采访对象') ? '补充采访对象' : '主要采访对象',
      reason: '补充事件背景、事实经过和不同视角。',
    });
  }
  if (eventType === '公共服务' && !subjects.some((subject) => executorSubjectSignal.test(subject.name))) {
    const executorName = fallbackSubjects[1];
    if (!subjects.some((subject) => subject.name === executorName)) {
      subjects.push({ name: executorName, role: '补充采访对象', reason: '说明服务调整的原因、安排和执行情况。' });
    }
  }
  subjects = subjects.slice(0, 4);
  const effectivePrimarySubject = subjects.find((subject) => subject.role === '主要采访对象')?.name || subjects[0].name;
  let normalizedSections = [...sections.values()];
  const normalizedSubjectNames = new Set(subjects.map((subject) => subject.name));
  for (const section of normalizedSections) {
    section.questions = section.questions.filter((question) => {
      const content = `${question.question}${question.purpose}${question.followUp}`;
      if (domainSignals.some((signal) => signal.test(content) && !signal.test(evidenceText))) return false;
      if (unusableInterviewQuestion.test(question.question)) return false;
      if (musicCancellationTopic && /你(?:为什么)?认为.{0,20}应该|应该怎样恢复/u.test(question.question)) return false;
      const mentionedSubjects = subjects.filter((subject) => questionMentionsSubject(question.question, subject.name));
      const questionMarks = question.question.match(/[？?]/gu)?.length || 0;
      if (mentionedSubjects.length > 1 && questionMarks > 1) return false;
      if (questionMarks > 1 && affectedQuestionSignal.test(question.question) && executorQuestionSignal.test(question.question)) return false;
      if (/如果[你您]是/u.test(question.question) && subjects.some((subject) => question.question.includes(subject.name))) return false;
      return true;
    }).map((question) => {
      const replacedQuestion = replaceSubjectReferences(question.question, subjectTargetReplacements);
      const replacedPurpose = replaceSubjectReferences(question.purpose, subjectTargetReplacements);
      const replacedFollowUp = replaceSubjectReferences(question.followUp, subjectTargetReplacements);
      const matchingTarget = subjects.find((subject) => equivalentSubject(subject.name, question.target));
      const fallbackTarget = subjectTargetReplacements.get(question.target) || matchingTarget?.name ||
        (normalizedSubjectNames.has(question.target) ? question.target : effectivePrimarySubject);
      const target = resolveQuestionTarget(replacedQuestion, subjects, fallbackTarget);
      const normalizedQuestion = splitCompoundQuestion(
        replaceSelfReference(replacedQuestion, target),
        replacedFollowUp,
      );
      const alignedQuestion = alignQuestionWordingWithTarget(
        normalizedQuestion.question,
        normalizedQuestion.followUp,
        target,
      );
      return {
        ...question,
        target,
        purpose: replacedPurpose,
        ...alignedQuestion,
      };
    });
  }
  normalizedSections = normalizedSections.filter((section) => section.questions.length > 0).slice(0, 6);
  let currentCount = normalizedSections.flatMap((section) => section.questions).length;
  if (currentCount < 6) {
    const supplementalByType: Record<string, string[]> = {
      人物赛事: ['赛前针对这场比赛做了哪些具体准备？', '比赛中哪个时刻最考验你的判断？', '当时你的心态发生了什么变化？', '赛后复盘，胜负的关键是什么？', '这次经历对下一阶段有什么影响？'],
      重大会议: ['你最关注会议报告中的哪些内容？', '这些内容与你所在的群体有什么关系？', '哪些表述给你留下了最深印象？', '你如何理解会议提出的发展方向？', '你希望哪些内容进一步落实？'],
      人物事件: ['这件事最初是怎样开始的？', '事情发展过程中有哪些关键变化？', '外界关注给你带来了什么影响？', '有哪些公开说法需要你补充说明？', '接下来你准备怎么做？'],
      政策变化: ['这次调整的直接原因是什么？', '具体内容和规则是如何确定的？', '哪些人会受到直接影响？', '执行过程中如何听取反馈？', '是否设置监督和复议渠道？'],
      突发事件: ['事件最早在什么时间被发现？', '现场采取了哪些处置措施？', '受影响人员目前情况如何？', '责任和原因将如何调查？', '后续如何避免类似事件？'],
      公共争议: ['争议涉及的核心事实是什么？', '目前有哪些可以公开核验的证据？', '你如何回应主要质疑？', '相关各方是否有过直接沟通？', '下一步准备如何处理？'],
      公共服务: ['这次服务调整从何时开始实施？', '调整服务安排的具体原因是什么？', '使用者的实际体验发生了哪些变化？', '执行过程中如何收集和处理反馈？', '后续是否还会调整服务安排？'],
      一般事件: ['这件事最初是怎样开始的？', '哪些具体经历促使你参与其中？', '这件事为什么会受到关注？', '目前带来了哪些具体影响？', '接下来是否还会继续？'],
    };
    const supplements = musicCancellationTopic
      ? ['主办方在什么时间作出取消决定？', '取消决定通过哪些方式通知原定参与者？', '原定安排受到的最直接影响是什么？', '票务、报名或相关费用准备如何处理？', '后续是否考虑延期或改期举办？']
      : supplementalByType[eventType] || ['这件事最初是怎样开始的？', '过程中发生了哪些关键变化？', '目前带来了哪些具体影响？', '外界最关注的问题是什么？', '接下来准备如何推进？'];
    const questions = supplements.filter((question) => {
      const key = question.replace(/[？?，,。\s]/gu, '');
      if (seenQuestions.has(key)) return false;
      seenQuestions.add(key);
      return true;
    }).slice(0, 6 - currentCount).map((question) => ({
      target: resolveQuestionTarget(question, subjects, effectivePrimarySubject),
      question,
      purpose: '补充事件事实、过程和当事人的判断依据。',
      sourceTitles: [],
      followUp: '能否用一个具体时间、动作或现场细节说明？',
      priority: 'must' as const,
    }));
    for (let index = 0; index < questions.length && normalizedSections.length < 6; index += 3) {
      normalizedSections.push({
        title: index === 0 ? '补充必问' : '延伸问题',
        questions: questions.slice(index, index + 3),
      });
    }
    currentCount = normalizedSections.flatMap((section) => section.questions).length;
  }
  if (currentCount < 6) {
    const lastSection = normalizedSections.at(-1) || { title: '补充必问', questions: [] };
    if (!normalizedSections.length) normalizedSections.push(lastSection);
    while (currentCount < 6) {
      const question = `关于“${topic || '这件事'}”，还有哪个具体事实最需要向你确认？`;
      lastSection.questions.push({
        target: effectivePrimarySubject,
        question,
        purpose: '补充仍未覆盖的关键信息。',
        sourceTitles: [],
        followUp: '能否用一个具体时间、动作或现场细节说明？',
        priority: 'must' as const,
      });
      currentCount += 1;
    }
  }
  if (requestedSubjects.length > 0) {
    const usedTargets = new Set(normalizedSections.flatMap((section) => section.questions.map((question) => question.target)));
    const missingSubjects = subjects.filter((subject) =>
      requestedSubjects.some((name) => equivalentSubject(name, subject.name)) && !usedTargets.has(subject.name),
    );
    for (const subject of missingSubjects) {
      const missingSubjectQuestion = eventType === '政策变化' || eventType === '公共服务'
        ? '这项安排对你的实际生活或学习产生了什么影响？最直接的变化是什么？'
        : eventType === '突发事件'
          ? '这件事对你原来的准备和安排造成了什么影响？'
          : eventType === '公共争议'
            ? '你与这件事有哪些直接联系？对争议中的哪些问题最关心？'
            : `作为${subject.name}，你参与这件事的具体经过和感受是什么？`;
      const question = {
        target: subject.name,
        question: missingSubjectQuestion,
        purpose: '补充该采访对象的直接经历和判断。',
        sourceTitles: [],
        followUp: '能否用一个具体时间、动作或现场细节说明？',
        priority: 'must' as const,
      };
      const total = normalizedSections.flatMap((section) => section.questions).length;
      if (total >= 8) {
        const replaceable = [...normalizedSections].reverse()
          .flatMap((section) => [...section.questions].reverse())
          .find((item) => item.target === effectivePrimarySubject);
        if (replaceable) Object.assign(replaceable, question);
        continue;
      }
      let section = normalizedSections.find((item) => item.title === '补充对象问题' && item.questions.length < 3);
      if (!section && normalizedSections.length < 6) {
        section = { title: '补充对象问题', questions: [] };
        normalizedSections.push(section);
      }
      (section || normalizedSections.at(-1))?.questions.push(question);
    }
  }
  return {
    ...plan,
    eventType,
    subjects,
    sections: normalizedSections,
  };
};

export interface EditorialTaskRequest {
  taskType: EditorialTaskType;
  sourceText: string;
  action?: NewsEditAction;
  /** 服务端搜索后附加；浏览器请求不应自行提供。 */
  research?: EditorialResearch;
}

export interface EditorialTaskResult {
  taskType: EditorialTaskType;
  title: string;
  output: string;
  notes: string[];
  verificationNeeded: string[];
  generatedAt: string;
  mode: GenerationMode;
  fallbackNotice?: string;
  understanding?: {
    interviewSubject: string;
    event: string;
    interviewNeed: string;
  };
  research?: EditorialResearch;
  interviewPlan?: InterviewPlan;
}

const nonBlankPattern = '^[\\s\\S]*\\S[\\s\\S]*$';

export const editorialTaskRequestJsonSchema = {
  type: 'object',
  additionalProperties: false,
  properties: {
    taskType: { type: 'string', enum: ['interview', 'news_edit'] },
    sourceText: {
      type: 'string',
      minLength: 1,
      maxLength: 30000,
      pattern: nonBlankPattern,
    },
    action: { type: 'string', enum: ['polish', 'structure', 'commentary'] },
  },
  required: ['taskType', 'sourceText'],
  allOf: [
    {
      if: {
        properties: { taskType: { const: 'news_edit' } },
        required: ['taskType'],
      },
      then: {
        properties: {
          action: { type: 'string' },
          sourceText: { type: 'string', minLength: 20 },
        },
        required: ['action'],
      },
    },
    {
      if: {
        properties: { taskType: { const: 'interview' } },
        required: ['taskType'],
      },
      then: { not: { required: ['action'] } },
    },
  ],
} as const;

const nonEmptyString = {
  type: 'string',
  minLength: 1,
  maxLength: 30000,
  pattern: nonBlankPattern,
} as const;

export const interviewPlanJsonSchema = {
  type: 'object',
  additionalProperties: false,
  properties: {
    eventType: { ...nonEmptyString, maxLength: 80 },
    subjects: {
      type: 'array', minItems: 2, maxItems: 4,
      items: {
        type: 'object', additionalProperties: false,
        properties: {
          name: { ...nonEmptyString, maxLength: 120 },
          role: { type: 'string', enum: ['主要采访对象', '补充采访对象'] },
          reason: { ...nonEmptyString, maxLength: 300 },
        },
        required: ['name', 'role', 'reason'],
      },
    },
    sections: {
      type: 'array', minItems: 2, maxItems: 6,
      items: {
        type: 'object', additionalProperties: false,
        properties: {
          title: { ...nonEmptyString, maxLength: 80 },
          questions: {
            type: 'array', minItems: 1, maxItems: 3,
            items: {
              type: 'object', additionalProperties: false,
              properties: {
                target: { ...nonEmptyString, maxLength: 120 },
                question: { ...nonEmptyString, maxLength: 500 },
                purpose: { ...nonEmptyString, maxLength: 500 },
                sourceTitles: { type: 'array', items: { ...nonEmptyString, maxLength: 300 }, maxItems: 2 },
                followUp: { ...nonEmptyString, maxLength: 500 },
                priority: { type: 'string', enum: ['must', 'optional'] },
              },
              required: ['target', 'question', 'purpose', 'sourceTitles', 'followUp', 'priority'],
            },
          },
        },
        required: ['title', 'questions'],
      },
    },
  },
  required: ['eventType', 'subjects', 'sections'],
} as const;

export const editorialTaskResultJsonSchema = {
  type: 'object',
  additionalProperties: false,
  properties: {
    taskType: { type: 'string', enum: ['interview', 'news_edit'] },
    title: { ...nonEmptyString, maxLength: 160 },
    output: nonEmptyString,
    notes: { type: 'array', items: nonEmptyString, minItems: 1, maxItems: 8 },
    verificationNeeded: {
      type: 'array',
      items: nonEmptyString,
      minItems: 0,
      maxItems: 8,
    },
    generatedAt: { type: 'string', minLength: 1 },
    mode: { type: 'string', enum: ['mock', 'ollama', 'qwen', 'openai'] },
    fallbackNotice: { ...nonEmptyString, maxLength: 240 },
    understanding: {
      type: 'object',
      additionalProperties: false,
      properties: {
        interviewSubject: { ...nonEmptyString, maxLength: 240 },
        event: { ...nonEmptyString, maxLength: 500 },
        interviewNeed: { ...nonEmptyString, maxLength: 800 },
      },
      required: ['interviewSubject', 'event', 'interviewNeed'],
    },
    research: {
      type: 'object',
      additionalProperties: false,
      properties: {
        status: { type: 'string', enum: ['live', 'failed', 'manual', 'mock'] },
        notice: { ...nonEmptyString, maxLength: 500 },
        sources: {
          type: 'array',
          maxItems: 8,
          items: {
            type: 'object',
            additionalProperties: false,
            properties: {
              title: { ...nonEmptyString, maxLength: 300 },
              url: { ...nonEmptyString, maxLength: 2000 },
              snippet: { ...nonEmptyString, maxLength: 1000 },
              sourceName: { ...nonEmptyString, maxLength: 300 },
              publishedAt: { ...nonEmptyString, maxLength: 100 },
            },
            required: ['title', 'snippet', 'sourceName'],
          },
        },
      },
      required: ['status', 'notice', 'sources'],
    },
    interviewPlan: interviewPlanJsonSchema,
  },
  required: [
    'taskType',
    'title',
    'output',
    'notes',
    'verificationNeeded',
    'generatedAt',
    'mode',
  ],
} as const;

const firstExcerpt = (sourceText: string) =>
  sourceText.trim().replace(/\s+/gu, ' ').slice(0, 240);

const inferInterviewUnderstanding = (sourceText: string) => {
  const excerpt = firstExcerpt(sourceText);
  const event = excerpt.split(/[，。！？]/u)[0] || excerpt;
  const subjectMatch = event.match(/^([\u4e00-\u9fff]{2,4})(?=(?:赢|获|夺|参加|宣布|回应|因|在))/u);
  const interviewSubject = extractRequestedSubjects(excerpt)[0] || subjectMatch?.[1] || event.match(/^([\u4e00-\u9fff]{2,4})/u)?.[1] || '用户提到的当事人';
  const eventType = inferEventType(excerpt);
  const interviewNeed = eventType === '人物赛事'
    ? '了解赛前准备、关键过程与判断、比赛中的心理变化、赛后复盘和后续计划。'
    : eventType === '公共服务'
      ? '了解服务调整原因、具体安排、受影响者的实际体验、执行方式和反馈渠道。'
      : eventType === '政策变化'
        ? '了解规则变化的原因、具体内容、影响对象、执行办法和可能争议。'
        : eventType === '突发事件'
          ? '还原事件时间线、现场情况、处置过程、人员影响、责任调查和后续安排。'
          : eventType === '公共争议'
            ? '核实争议事实、各方依据与回应、实际影响和下一步处理。'
            : '了解事件起因、关键经过、当事人体验、实际影响和后续进展。';
  return {
    interviewSubject,
    event,
    interviewNeed,
  };
};

const inferEventType = (text: string): string | undefined =>
  /二十大|党代会|大会|全会|峰会|论坛/u.test(text) ? '重大会议'
    : /比赛|夺冠|冠军|赢|输|棋|联赛|决赛/u.test(text) ? '人物赛事'
    : /暴雨|台风|地震|洪水|事故|火灾|受伤|失踪|故障|紧急取消|临时取消/u.test(text) ? '突发事件'
      : /图书馆|班车|公交|地铁|公共服务|开放时间|延长开放|服务时间|运营时间|校医院|门诊|就诊|医疗服务/u.test(text) ? '公共服务'
        : /政策|规定|规范|办法|通知|调整|涨价|价格上涨|菜价上涨|限制/u.test(text) ? '政策变化'
        : /争议|质疑|回应|道歉|投诉/u.test(text) ? '公共争议'
          : /公司|企业|发布新|产品|手机|汽车|财报/u.test(text) ? '企业动态'
            : /电影|导演|演员|展览|演出|音乐/u.test(text) ? '文化事件'
          : /阿姨|大叔|先生|女士|老师|博主|演员|歌手|作家/u.test(text) ? '人物事件'
            : undefined;

export const createMockEditorialTaskResult = (
  input: EditorialTaskRequest,
): EditorialTaskResult => {
  const excerpt = firstExcerpt(input.sourceText);
  const interview = input.taskType === 'interview';
  const understanding = interview ? inferInterviewUnderstanding(excerpt) : undefined;
  const interviewSubject = understanding?.interviewSubject || '当事人';
  const event = understanding?.event || excerpt;
  const sourceTitle = input.research?.sources[0]?.title;
  const actionLabel =
    input.action === 'commentary'
      ? '评论配发'
      : input.action === 'structure'
        ? '结构修改'
        : '语言润色';

  return {
    taskType: input.taskType,
    title: interview ? '采访提纲' : `${actionLabel}建议`,
    output: interview
      ? `【采访目的】\n围绕“${event}”了解${interviewSubject}的真实经历和判断。\n\n【核心问题】\n【事件确认】\n1. 这次事件中最需要确认的事实是什么？\n提问目的：确认事件经过和关键节点。\n\n【赛前准备】\n2. 事件发生前，你做了哪些准备？\n提问目的：了解准备过程。\n\n【关键过程】\n3. 过程中哪个时刻最关键？\n提问目的：还原现场细节。\n\n【心理变化】\n4. 当时你的判断和情绪发生了什么变化？\n提问目的：了解决策依据和心理状态。\n\n【赛后感受】\n5. 现在回看这件事，你认为结果的关键原因是什么？\n提问目的：获得当事人的复盘。\n\n【人物经历】\n6. 这次经历和你过去的成长经历有什么联系？\n提问目的：补充人物背景。\n\n【追问方向】\n- 能否具体讲一个当时的细节？\n- 这是当时的判断，还是事后的复盘？\n- 有没有不同于外界解读的地方？\n\n【采访边界】\n以上是待向${interviewSubject}求证的问题，不代表${interviewSubject}已经作出任何回答。`
      : input.action === 'commentary'
        ? `【评论题目】从材料事实出发\n\n【中心论点】评论应围绕材料中已呈现的问题展开，不补充未提供的事实。\n\n【配发位置】置于新闻正文之后。\n\n【依据材料】${excerpt}`
        : `【${actionLabel}稿】\n${excerpt}`,
    notes: ['以下内容基于用户提供材料整理。'],
    verificationNeeded: interview ? ['核对人物身份、时间和可引用原话。'] : [],
    generatedAt: new Date().toISOString(),
    mode: 'mock',
    ...(interview ? { understanding } : {}),
    ...(interview ? {
      interviewPlan: {
        eventType: inferEventType(event) || '人物事件',
        subjects: [
          { name: interviewSubject, role: '主要采访对象' as const, reason: '事件当事人，负责确认经历、判断和感受。' },
          { name: '事件相关人员', role: '补充采访对象' as const, reason: '补充背景、现场细节和不同视角。' },
        ],
        sections: [
          { title: '事实与背景', questions: [{ target: interviewSubject, question: `请确认“${event}”的关键经过和时间节点。`, purpose: '建立可靠的事件时间线。', sourceTitles: sourceTitle ? [sourceTitle] : [], followUp: '哪些公开说法需要纠正或补充？', priority: 'must' as const }] },
          { title: '关键过程', questions: [{ target: interviewSubject, question: '过程中最关键的时刻是什么？你当时如何判断？', purpose: '还原决定结果的具体过程。', sourceTitles: sourceTitle ? [sourceTitle] : [], followUp: '能否讲一个当时发生的具体细节？', priority: 'must' as const }] },
          { title: '影响与后续', questions: [{ target: interviewSubject, question: '这件事对你和相关人员带来了什么影响？接下来有什么计划？', purpose: '了解事件意义和后续进展。', sourceTitles: [], followUp: '最希望外界准确理解的是什么？', priority: 'optional' as const }] },
        ],
      },
    } : {}),
  };
};
