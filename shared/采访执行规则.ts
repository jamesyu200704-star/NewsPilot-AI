import type {
  InterviewQuestion,
  InterviewSourceStatus,
  OutreachAttempt,
  QuestionRiskFlag,
} from './报道执行模型.js';

const allowedSourceTransitions: Record<InterviewSourceStatus, InterviewSourceStatus[]> = {
  identified: ['contact_drafted', 'contacted', 'dropped'],
  contact_drafted: ['contacted', 'dropped'],
  contacted: ['responded', 'scheduled', 'declined', 'unreachable'],
  responded: ['scheduled', 'declined', 'follow_up_needed'],
  scheduled: ['interviewed', 'follow_up_needed', 'declined'],
  interviewed: ['follow_up_needed', 'completed'],
  follow_up_needed: ['contacted', 'scheduled', 'completed', 'unreachable'],
  completed: [],
  declined: ['contacted', 'dropped'],
  unreachable: ['contacted', 'dropped'],
  dropped: [],
};

export const transitionSourceStatus = (
  current: InterviewSourceStatus,
  next: InterviewSourceStatus,
) => {
  if (current === next) return next;
  if (!allowedSourceTransitions[current]?.includes(next)) {
    throw new Error(`信源状态不能直接切换：${current} → ${next}。`);
  }
  return next;
};

export function createOutreachAttempt(
  input: Omit<OutreachAttempt, 'delivery' | 'responseStatus'> & {
    delivery?: OutreachAttempt['delivery'];
    responseStatus?: OutreachAttempt['responseStatus'];
  },
): OutreachAttempt {
  if (!input.id.trim() || !input.sourceId.trim() || !input.message.trim()) {
    throw new Error('联系记录必须包含编号、信源和消息内容。');
  }
  return {
    ...input,
    delivery: input.delivery || 'manual_record',
    responseStatus: input.responseStatus || 'not_recorded',
  };
}

const hasDoubleConnector = (text: string) => /并且|以及|同时|而且|又.{0,12}又/u.test(text);

export const assessInterviewQuestion = (question: InterviewQuestion) => {
  const text = question.text.trim();
  const riskFlags = new Set<QuestionRiskFlag>(question.riskFlags);
  if (/是否认为|是不是|难道|显然|不合理|严重影响/u.test(text)) riskFlags.add('leading');
  if (hasDoubleConnector(text) || (text.match(/[？?]/gu)?.length || 0) > 1) riskFlags.add('double_barreled');
  if (/你猜|你觉得会不会|可能是因为/u.test(text)) riskFlags.add('speculation');
  if (/谈谈|怎么看|有何感想/u.test(text) && text.length < 30) riskFlags.add('too_broad');
  if (/怎么看|态度|支持还是反对/u.test(text) && !/具体|经历|时间|依据/u.test(text)) riskFlags.add('attitude_only');
  if (/身份证|住址|家庭收入|病史|手机号/u.test(text)) riskFlags.add('privacy');
  if (!question.claimIds.length && !question.evidenceGapIds.length) riskFlags.add('unbound');
  if (!question.sourceId.trim()) riskFlags.add('irrelevant');
  return {
    ...question,
    riskFlags: [...riskFlags],
    isReady:
      Boolean(text && question.purpose.trim() && question.expectedEvidence.trim()) &&
      !riskFlags.has('unbound') &&
      !riskFlags.has('irrelevant'),
  };
};

export interface OutreachTemplateVariables {
  reporterIdentity: string;
  contactReason: string;
  topic: string;
  purpose: string;
  durationMinutes: number;
  method: string;
  recordingPlan: string;
  usePlan: string;
  anonymityOption: string;
  returnContact: string;
}

export const buildOutreachTemplate = (variables: OutreachTemplateVariables) =>
  `您好，我是${variables.reporterIdentity}。因${variables.contactReason}，正在就“${variables.topic}”进行采访。` +
  `本次采访希望了解${variables.purpose}，预计 ${variables.durationMinutes} 分钟，可通过${variables.method}完成。` +
  `${variables.recordingPlan}；${variables.usePlan}；${variables.anonymityOption}。` +
  `如您不方便参与可以直接告知，也可以推荐更合适的采访对象。联系方式：${variables.returnContact}`;
