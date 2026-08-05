import type {
  GenerationContent,
  GenerationMode,
  GenerationResult,
  AgentReview,
  PlanningContext,
} from './generation.js';

export const finalizePlanningResult = (
  context: PlanningContext,
  content: GenerationContent,
  mode: GenerationMode,
  agentReview: AgentReview,
  fallbackNotice?: string,
): GenerationResult => ({
  ...content,
  topicAnalysis: context.topicAnalysis,
  newsValueAssessment: context.newsValueAssessment,
  ruleDecision: context.ruleDecision,
  retrievalContext: context.retrievalContext,
  agentReview,
  generatedAt: new Date().toISOString(),
  mode,
  ...(fallbackNotice ? { fallbackNotice } : {}),
});
