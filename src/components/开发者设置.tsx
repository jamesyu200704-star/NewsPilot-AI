import { CaretDown, Cpu, Database, ShieldCheck } from '@phosphor-icons/react';
import type { ClientGenerationMode } from '../services/generator';
import type { ProviderPresentation, ProviderStatus } from '../services/providerStatus';

interface DeveloperSettingsProps {
  generationMode: ClientGenerationMode;
  providerStatus: ProviderStatus;
  providerPresentation: ProviderPresentation;
  onGenerationModeChange: (mode: ClientGenerationMode) => void;
}

export function DeveloperSettings({
  generationMode,
  providerStatus,
  providerPresentation,
  onGenerationModeChange,
}: DeveloperSettingsProps) {
  const searchLabel =
    providerStatus.state === 'ready' && providerStatus.searchProvider === 'brave'
      ? 'Brave Search（兼容配置）'
      : 'Manual / Mock';

  return (
    <details className="developer-settings">
      <summary>
        <span><Cpu weight="duotone" />开发者设置</span>
        <span className="developer-settings__status">{providerPresentation.activeLabel}<CaretDown /></span>
      </summary>
      <div className="developer-settings__body">
        <div>
          <span className="eyebrow"><Cpu />生成层</span>
          <div className="segmented-control segmented-control--compact">
            <label>
              <input
                type="radio"
                name="generation-mode"
                checked={generationMode === 'mock'}
                onChange={() => onGenerationModeChange('mock')}
              />
              <span>浏览器 Mock</span>
            </label>
            <label>
              <input
                type="radio"
                name="generation-mode"
                checked={generationMode === 'local-ai'}
                disabled={providerPresentation.optionDisabled}
                onChange={() => onGenerationModeChange('local-ai')}
              />
              <span>{providerPresentation.optionTitle}</span>
            </label>
          </div>
          <p>{providerPresentation.optionDescription}</p>
        </div>
        <div className="developer-settings__fact">
          <Database weight="duotone" />
          <span><b>资料层</b><small>{searchLabel}；结果只作线索，不自动认定为事实</small></span>
        </div>
        <div className="developer-settings__fact">
          <ShieldCheck weight="duotone" />
          <span><b>隐私提示</b><small>{providerPresentation.privacyNotice}</small></span>
        </div>
      </div>
    </details>
  );
}
