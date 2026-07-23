import { Check, SpinnerGap } from '@phosphor-icons/react';

const steps = ['梳理人物线索', '对照制度机制', '检查数据路径'];

export function LoadingState() {
  return (
    <section className="loading-state" aria-live="polite" aria-busy="true">
      <div className="loading-state__top">
        <span>正在构建报道路径</span>
        <SpinnerGap className="spin" aria-hidden="true" weight="bold" />
      </div>

      <div className="loading-state__visual" aria-hidden="true">
        <span>NP</span>
      </div>

      <h2>拆解主题，建立采访计划。</h2>
      <p>正在分析新闻价值、采访路径与事实核查重点。</p>

      <ol className="loading-state__steps">
        {steps.map((step) => (
          <li key={step}>
            <Check aria-hidden="true" weight="bold" />
            <p>{step}</p>
          </li>
        ))}
      </ol>

      <div className="loading-state__progress" aria-hidden="true">
        <span />
      </div>
      <span className="sr-only">系统正在生成三个新闻报道角度，请稍候。</span>
    </section>
  );
}
