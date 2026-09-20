import type {
  BriefInput,
  EditorialRevision,
  GenerationResult,
  RetrievalContext,
  SearchProviderName,
  VerificationReview,
} from '../../shared/generation.js';
import { buildPlanningContext } from '../../shared/新闻方法论.js';
import { finalizePlanningResult } from '../../shared/新闻工作流.js';
import {
  createAgentReview,
  createMockEditorialRevision,
  createMockVerificationReview,
} from '../../shared/mockAgents.js';
import {
  assertEditorialRevision,
  assertEditorialResolvesVerification,
  assertGenerationContent,
  assertGenerationResult,
  assertVerificationReview,
  assertVerificationEvidence,
} from '../validation.js';
import type { GenerationProvider } from '../providers/GenerationProvider.js';
import { getOllamaUserMessage } from './ollama.js';

interface ServiceLogger {
  warn(message: string): void;
}

interface RetrievalPipeline {
  readonly providerName?: SearchProviderName;
  retrieve(input: BriefInput): Promise<RetrievalContext>;
}

const mergeRequiredItems = (
  requiredItems: string[],
  existingItems: string[],
  maximum: number,
) => [...new Set([...requiredItems, ...existingItems])].slice(0, maximum);

const removeInventedEvidenceReferences = (
  verification: VerificationReview,
  retrievalContext: RetrievalContext,
): VerificationReview => {
  const validEvidenceIds = new Set(
    retrievalContext.evidence.map((item) => item.id),
  );

  return {
    ...verification,
    factCheck: {
      ...verification.factCheck,
      findings: verification.factCheck.findings.map((finding) => ({
        ...finding,
        evidenceIds: finding.evidenceIds.filter((id) =>
          validEvidenceIds.has(id),
        ),
      })),
    },
  };
};

const applyVerificationGuardrails = (
  editorial: EditorialRevision,
  verification: VerificationReview,
): EditorialRevision => {
  const highRiskActions = verification.factCheck.findings
    .filter((finding) => finding.severity === 'high')
    .map((finding) => finding.requiredAction);
  const highRisks = verification.riskReview.items.filter(
    (item) => item.severity === 'high',
  );

  return {
    content: {
      ...editorial.content,
      verificationChecklist: mergeRequiredItems(
        highRiskActions,
        editorial.content.verificationChecklist,
        12,
      ),
      risks: mergeRequiredItems(
        highRisks.map((item) => item.description),
        editorial.content.risks,
        10,
      ),
    },
    decision: {
      ...editorial.decision,
      finalChecklist: mergeRequiredItems(
        highRisks.map((item) => item.mitigation),
        editorial.decision.finalChecklist,
        12,
      ),
    },
  };
};

export class GeneratorService {
  constructor(
    private readonly primaryProvider: GenerationProvider,
    private readonly fallbackProvider: GenerationProvider,
    private readonly logger: ServiceLogger = console,
    private readonly retrievalPipeline?: RetrievalPipeline,
  ) {}

  get providerName() {
    return this.primaryProvider.name;
  }

  get fallbackProviderName() {
    return this.fallbackProvider.name;
  }

  get editorialPrimaryProvider() {
    return this.primaryProvider;
  }

  get editorialFallbackProvider() {
    return this.fallbackProvider;
  }

  get retrievalProviderName(): SearchProviderName {
    return this.retrievalPipeline?.providerName ?? 'mock';
  }

  async generate(input: BriefInput): Promise<GenerationResult> {
    const baseContext = buildPlanningContext(input);
    const context = this.retrievalPipeline
      ? {
          ...baseContext,
          retrievalContext: await this.retrievalPipeline.retrieve(
            baseContext.input,
          ),
        }
      : baseContext;

    const runProviderWorkflow = async (provider: GenerationProvider) => {
      const draft = await provider.generate(context);
      assertGenerationContent(draft);
      const usedVerificationFallback = !provider.verify;
      const providerVerification = provider.verify
        ? await provider.verify(context, draft)
        : createMockVerificationReview(context, draft);
      assertVerificationReview(providerVerification);
      const verification = removeInventedEvidenceReferences(
        providerVerification,
        context.retrievalContext,
      );
      assertVerificationReview(verification);
      assertVerificationEvidence(verification, context.retrievalContext);
      const usedEditorFallback = !provider.edit;
      const providerEditorial = provider.edit
        ? await provider.edit(context, draft, verification)
        : createMockEditorialRevision(context, draft, verification);
      assertEditorialRevision(providerEditorial);
      const editorial = applyVerificationGuardrails(
        providerEditorial,
        verification,
      );
      assertEditorialRevision(editorial);
      assertEditorialResolvesVerification(editorial, verification);

      return {
        editorial,
        agentReview: createAgentReview(
          provider.name,
          verification,
          editorial.decision,
          [
            'completed',
            usedVerificationFallback ? 'fallback' : 'completed',
            usedEditorFallback ? 'fallback' : 'completed',
          ],
        ),
      };
    };

    try {
      const workflow = await runProviderWorkflow(this.primaryProvider);
      const result = finalizePlanningResult(
        context,
        workflow.editorial.content,
        this.primaryProvider.name,
        workflow.agentReview,
      );
      assertGenerationResult(result);
      return result;
    } catch (error) {
      if (this.primaryProvider.name === this.fallbackProvider.name) {
        throw error;
      }

      const message = error instanceof Error ? error.message : '未知错误';
      this.logger.warn(
        '[NewsPilot] ' +
          this.primaryProvider.name +
          ' Provider 失败，已降级到 ' +
          this.fallbackProvider.name +
          '：' +
          message,
      );

      const fallbackWorkflow = await runProviderWorkflow(this.fallbackProvider);
      const providerUserMessage =
        this.primaryProvider.name === 'ollama' ||
        this.primaryProvider.name === 'qwen'
          ? getOllamaUserMessage(error)
          : 'OpenAI 生成暂时不可用，';
      const finalResult = finalizePlanningResult(
        context,
        fallbackWorkflow.editorial.content,
        this.fallbackProvider.name,
        fallbackWorkflow.agentReview,
        providerUserMessage + '已自动切换到 Demo 模式。',
      );
      assertGenerationResult(finalResult);
      return finalResult;
    }
  }
}
