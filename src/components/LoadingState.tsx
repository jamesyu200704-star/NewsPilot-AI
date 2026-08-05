import { Check, SpinnerGap } from '@phosphor-icons/react';

const steps = [
  '解析线索与六维评分',
  '检索知识库与公开来源',
  '新闻策划 Agent 生成草案',
  '事实核查 Agent 审核证据',
  '新闻编辑 Agent 完成终审',
];

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

      <h2>让新闻方法先于模型工作。</h2>
      <p>正在执行方法论、检索增强、策划、事实核查与编辑终审。</p>

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
      <span className="sr-only">系统正在执行新闻策划工作流，请稍候。</span>
    </section>
  );
}
