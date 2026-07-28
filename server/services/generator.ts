import type { BriefInput, GenerationResult } from '../../shared/generation.js';
import { assertGenerationResult } from '../validation.js';
import type { GenerationProvider } from '../providers/GenerationProvider.js';
import { getOllamaUserMessage } from './ollama.js';

interface ServiceLogger {
  warn(message: string): void;
}

export class GeneratorService {
  constructor(
    private readonly primaryProvider: GenerationProvider,
    private readonly fallbackProvider: GenerationProvider,
    private readonly logger: ServiceLogger = console,
  ) {}

  get providerName() {
    return this.primaryProvider.name;
  }

  get fallbackProviderName() {
    return this.fallbackProvider.name;
  }

  async generate(input: BriefInput): Promise<GenerationResult> {
    try {
      const result = await this.primaryProvider.generate(input);
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

      const fallbackResult = await this.fallbackProvider.generate(input);
      assertGenerationResult(fallbackResult);
      const providerUserMessage =
        this.primaryProvider.name === 'ollama'
          ? getOllamaUserMessage(error)
          : 'OpenAI 生成暂时不可用，';
      const finalResult: GenerationResult = {
        ...fallbackResult,
        fallbackNotice:
          providerUserMessage + '已自动切换到 Demo 模式。',
      };
      assertGenerationResult(finalResult);
      return finalResult;
    }
  }
}
