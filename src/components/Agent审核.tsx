import {
  CheckCircle,
  MagnifyingGlass,
  PencilLine,
  ShieldWarning,
} from '@phosphor-icons/react';
import type { GenerationResult } from '../types';

interface AgentReviewPanelProps {
  result: GenerationResult;
}

const agentLabels = {
  planning: '新闻策划 Agent',
  'fact-check': '事实核查 Agent',
  editor: '新闻编辑 Agent',
} as const;

const severityLabels = {
  low: '低风险',
  medium: '中风险',
  high: '高风险',
} as const;

const claimStatusLabels = {
  supported: '已有支持',
  'partially-supported': '部分支持',
  unsupported: '缺少支持',
  'needs-verification': '待核验',
} as const;

export function AgentReviewPanel({ result }: AgentReviewPanelProps) {
  const { verification, editorial, trace } = result.agentReview;

  return (
    <section className="agent-review" aria-labelledby="agent-review-title">
      <header className="agent-review__header">
        <div>
          <span className="section-kicker">Agent desk / 05</span>
          <h3 id="agent-review-title">三个角色，不让一个模型直接定稿。</h3>
        </div>
        <span className="agent-review__version">{result.agentReview.workflowVersion}</span>
      </header>

      <ol className="agent-trace" aria-label="Agent 工作流轨迹">
        {trace.map((step, index) => (
          <li key={step.agent}>
            <span className="agent-trace__index">0{index + 1}</span>
            <div>
              <b>{agentLabels[step.agent]}</b>
              <p>{step.summary}</p>
            </div>
            <small className={'agent-trace__status agent-trace__status--' + step.status}>
              {step.mode} / {step.status}
            </small>
          </li>
        ))}
      </ol>

      <div className="agent-review__grid">
        <article className="fact-desk">
          <header>
            <MagnifyingGlass aria-hidden="true" weight="bold" />
            <div>
              <span>Fact-check</span>
              <h4>事实核查 Agent</h4>
            </div>
          </header>
          <p className="fact-desk__summary">{verification.factCheck.summary}</p>
          <div className="fact-findings">
            {verification.factCheck.findings.map((finding) => (
              <details key={finding.id} open={finding.severity === 'high'}>
                <summary>
                  <span className={'severity severity--' + finding.severity}>
                    {severityLabels[finding.severity]}
                  </span>
                  <strong>{finding.claim}</strong>
                  <b>{claimStatusLabels[finding.status]}</b>
                </summary>
                <p>{finding.assessment}</p>
                <div>
                  <span>必须行动</span>
                  {finding.requiredAction}
                </div>
                <code>
                  {finding.evidenceIds.length
                    ? finding.evidenceIds.join(' · ')
                    : '暂无证据 ID'}
                </code>
              </details>
            ))}
          </div>
        </article>

        <aside className="risk-gate">
          <header>
            <ShieldWarning aria-hidden="true" weight="fill" />
            <div>
              <span>Risk gate</span>
              <h4>风险审核</h4>
            </div>
          </header>
          <div className="risk-gate__decision">
            <span>总体风险</span>
            <strong>{severityLabels[verification.riskReview.overallRisk]}</strong>
            <code>{verification.riskReview.releaseGate}</code>
          </div>
          <ul>
            {verification.riskReview.items.map((item) => (
              <li key={item.id}>
                <b>{item.description}</b>
                <p>{item.mitigation}</p>
              </li>
            ))}
          </ul>
        </aside>
      </div>

      <article className="editor-decision">
        <header>
          <PencilLine aria-hidden="true" weight="bold" />
          <div>
            <span>Final editor</span>
            <h4>新闻编辑 Agent 终审</h4>
          </div>
          <strong>{editorial.disposition}</strong>
        </header>
        <div className="editor-decision__body">
          <div>
            <span>优先角度</span>
            <b>{editorial.priorityAngleId}</b>
            <p>{editorial.rationale}</p>
          </div>
          <ul>
            {editorial.changes.map((change) => (
              <li key={change}>
                <CheckCircle aria-hidden="true" weight="fill" />
                {change}
              </li>
            ))}
          </ul>
        </div>
      </article>
    </section>
  );
}
