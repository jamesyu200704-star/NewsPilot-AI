import type { GenerationMode } from '../types/index.js';
import type { ClientGenerationMode } from './generationMode.js';

export type ClientFetchImplementation = (
  input: string | URL | Request,
  init?: RequestInit,
) => Promise<Response>;

export type ProviderStatus =
  | {
      state: 'checking';
      provider: null;
    }
  | {
      state: 'ready';
      provider: Exclude<GenerationMode, 'mock'>;
      searchProvider?: 'mock' | 'brave';
    }
  | {
      state: 'unavailable';
      provider: 'mock' | null;
    };

export interface ProviderPresentation {
  optionTitle: string;
  optionDescription: string;
  activeLabel: string;
  privacyNotice: string;
  footerNotice: string;
  optionDisabled: boolean;
}

interface ProviderDetectionOptions {
  endpoint: string;
  timeoutMs: number;
  fetchImplementation?: ClientFetchImplementation;
}

interface HealthResponse {
  ok: true;
  provider: GenerationMode;
  fallbackProvider: GenerationMode;
  searchProvider?: 'mock' | 'brave';
}

const isHealthResponse = (value: unknown): value is HealthResponse => {
  if (!value || typeof value !== 'object') {
    return false;
  }

  const response = value as Record<string, unknown>;
  return (
    response.ok === true &&
    ['mock', 'ollama', 'qwen', 'openai'].includes(String(response.provider)) &&
    ['mock', 'ollama', 'qwen', 'openai'].includes(
      String(response.fallbackProvider),
    ) &&
    (!Object.hasOwn(response, 'searchProvider') ||
      ['mock', 'brave'].includes(String(response.searchProvider)))
  );
};

export const checkingProviderStatus: ProviderStatus = {
  state: 'checking',
  provider: null,
};

export const unavailableProviderStatus: ProviderStatus = {
  state: 'unavailable',
  provider: null,
};

export const shouldDetectGenerationProvider = (
  requestedMode: ClientGenerationMode,
  isProduction: boolean,
) => !isProduction || requestedMode === 'local-ai';

export const getProviderPresentation = (
  status: ProviderStatus,
): ProviderPresentation => {
  const searchPrivacyNotice =
    status.state === 'ready' && status.searchProvider === 'brave'
      ? ' 自动生成的检索词会发送到 Brave Search API。'
      : '';
  if (status.state === 'checking') {
    return {
      optionTitle: '正在检测生成服务',
      optionDescription: '识别项目后端配置的 AI Provider',
      activeLabel: '正在检测',
      privacyNotice: '正在检测生成服务，完成前不会发送主题内容。',
      footerNotice: '正在检测生成服务，生成内容需独立核验',
      optionDisabled: true,
    };
  }

  if (status.state === 'ready' && status.provider === 'ollama') {
    return {
      optionTitle: 'Ollama AI',
      optionDescription: '通过项目后端调用已配置的 Ollama / Qwen',
      activeLabel: 'Ollama AI',
      privacyNotice:
        '输入会发送到项目后端与已配置的 Ollama 服务；请确认该地址可信，并勿填写敏感个人信息。' +
        searchPrivacyNotice,
      footerNotice: '输入由已配置的 Ollama 服务处理，生成内容需独立核验',
      optionDisabled: false,
    };
  }

  if (status.state === 'ready' && status.provider === 'openai') {
    return {
      optionTitle: 'OpenAI 模式',
      optionDescription: '通过项目后端调用 OpenAI 模型',
      activeLabel: 'OpenAI',
      privacyNotice:
        '输入会经项目后端发送到 OpenAI API；请勿填写敏感个人信息。' +
        searchPrivacyNotice,
      footerNotice: '输入会发送到 OpenAI API，生成内容需独立核验',
      optionDisabled: false,
    };
  }

  if (status.state === 'ready' && status.provider === 'qwen') {
    return {
      optionTitle: 'Qwen Agent',
      optionDescription: '通过本地 Ollama 运行策划、核查、编辑三个 Agent',
      activeLabel: 'Qwen Agent',
      privacyNotice:
        '输入会发送到项目后端与本机 Qwen 模型；请勿填写敏感个人信息。' +
        searchPrivacyNotice,
      footerNotice: '本机 Qwen 执行三 Agent 工作流，生成内容需独立核验',
      optionDisabled: false,
    };
  }

  if (status.provider === 'mock') {
    return {
      optionTitle: 'AI 服务未配置',
      optionDescription: '后端当前为 Mock，可继续使用 Demo',
      activeLabel: 'AI 未配置',
      privacyNotice: 'AI 服务尚未配置，不会发送主题内容。',
      footerNotice: 'AI 服务未配置，当前使用浏览器本地 Demo',
      optionDisabled: true,
    };
  }

  return {
    optionTitle: 'AI 服务未连接',
    optionDescription: '当前部署未连接生成后端，可继续使用 Demo',
    activeLabel: 'AI 未连接',
    privacyNotice: 'AI 服务未连接，不会发送主题内容。',
    footerNotice: 'AI 服务未连接，当前使用浏览器本地 Demo',
    optionDisabled: true,
  };
};

export const resolveGenerationMode = (
  requestedMode: ClientGenerationMode,
  status: ProviderStatus,
): ClientGenerationMode =>
  requestedMode === 'local-ai' && status.state !== 'ready'
    ? 'mock'
    : requestedMode;

export async function detectGenerationProvider(
  options: ProviderDetectionOptions,
): Promise<ProviderStatus> {
  const controller = new AbortController();
  const timeout = globalThis.setTimeout(() => controller.abort(), options.timeoutMs);

  try {
    const response = await (options.fetchImplementation ?? globalThis.fetch)(
      options.endpoint,
      {
        headers: {
          Accept: 'application/json',
        },
        signal: controller.signal,
      },
    );

    if (!response.ok) {
      return { state: 'unavailable', provider: null };
    }

    const payload: unknown = await response.json();
    if (!isHealthResponse(payload)) {
      return { state: 'unavailable', provider: null };
    }

    if (
      payload.provider === 'ollama' ||
      payload.provider === 'qwen' ||
      payload.provider === 'openai'
    ) {
      return {
        state: 'ready',
        provider: payload.provider,
        ...(payload.searchProvider
          ? { searchProvider: payload.searchProvider }
          : {}),
      };
    }

    return { state: 'unavailable', provider: 'mock' };
  } catch {
    return { state: 'unavailable', provider: null };
  } finally {
    globalThis.clearTimeout(timeout);
  }
}
