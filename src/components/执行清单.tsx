import {
  CheckCircle,
  Files,
  WarningCircle,
} from '@phosphor-icons/react';
import type { GenerationResult } from '../types';

interface ExecutionChecklistProps {
  result: GenerationResult;
}

export function ExecutionChecklist({ result }: ExecutionChecklistProps) {
  return (
    <section className="execution" aria-labelledby="execution-title">
      <header className="execution__header">
        <div>
          <span className="section-kicker">Fieldwork / 06</span>
          <h3 id="execution-title">把方案推进到采访现场。</h3>
        </div>
        <p>以下内容是必须补齐的证据、核查与风险边界，不是已经成立的事实。</p>
      </header>

      <div className="execution__grid">
        <article className="execution-card execution-card--data">
          <div className="execution-card__heading">
            <Files aria-hidden="true" weight="bold" />
            <div>
              <span>{result.dataNeeds.length} 项</span>
              <h4>数据和资料需求</h4>
            </div>
          </div>
          <ul>
            {result.dataNeeds.map((item) => (
              <li key={item}>{item}</li>
            ))}
          </ul>
        </article>

        <article className="execution-card execution-card--check">
          <div className="execution-card__heading">
            <CheckCircle aria-hidden="true" weight="bold" />
            <div>
              <span>{result.verificationChecklist.length} 项</span>
              <h4>事实核查清单</h4>
            </div>
          </div>
          <ul>
            {result.verificationChecklist.map((item) => (
              <li key={item}>{item}</li>
            ))}
          </ul>
        </article>

        <article className="execution-card execution-card--risk">
          <div className="execution-card__heading">
            <WarningCircle aria-hidden="true" weight="bold" />
            <div>
              <span>{result.risks.length} 项</span>
              <h4>报道风险</h4>
            </div>
          </div>
          <ul>
            {result.risks.map((item) => (
              <li key={item}>{item}</li>
            ))}
          </ul>
        </article>
      </div>

      <section className="action-plan" aria-labelledby="action-plan-title">
        <header>
          <span>Next actions</span>
          <h4 id="action-plan-title">下一步行动计划</h4>
        </header>
        <ol>
          {result.nextActions.map((action, index) => (
            <li key={action}>
              <span>{String(index + 1).padStart(2, '0')}</span>
              <p>{action}</p>
            </li>
          ))}
        </ol>
      </section>
    </section>
  );
}
