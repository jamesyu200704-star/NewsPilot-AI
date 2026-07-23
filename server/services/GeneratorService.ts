import type { BriefInput, GenerationResult } from '../../shared/generation.js';
import { assertGenerationResult } from '../validation.js';
import type { GenerationProvider } from '../providers/GenerationProvider.js';

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
      return fallbackResult;
    }
  }
}
