import {
  CaretDown,
  Check,
  CheckCircle,
  Copy,
  ShieldCheck,
  Target,
  UsersThree,
  WarningCircle,
} from '@phosphor-icons/react';
import type { StoryAngle } from '../types';

interface StoryAngleCardProps {
  angle: StoryAngle;
  index: number;
  copied: boolean;
  onCopy: () => void;
}

const angleMeta = [
  { label: '人物故事' },
  { label: '制度观察' },
  { label: '趋势分析' },
];

const splitNewsValue = (value: string) => {
  const separator = value.indexOf('：');
  if (separator === -1) return { label: '价值', copy: value };
  return {
    label: value.slice(0, separator),
    copy: value.slice(separator + 1),
  };
};

export function StoryAngleCard({
  angle,
  index,
  copied,
  onCopy,
}: StoryAngleCardProps) {
  const meta = angleMeta[index];

  return (
    <article className={'angle-card angle-card--' + angle.id}>
      <header className="angle-card__header">
        <div className="angle-card__label-row">
          <span className="angle-badge">{meta.label}</span>

          <div className="value-score" aria-label={'报道角度潜力评分：' + angle.newsValueScore.toFixed(1) + ' 分，满分 5 分'}>
            <span>角度潜力</span>
            <strong>{angle.newsValueScore.toFixed(1)}</strong>
            <small>/ 5</small>
          </div>

          <button
            className="text-button"
            type="button"
            onClick={onCopy}
            aria-label={'复制角度' + ['一', '二', '三'][index] + '的完整方案'}
          >
            {copied ? (
              <Check aria-hidden="true" weight="bold" />
            ) : (
              <Copy aria-hidden="true" weight="bold" />
            )}
            {copied ? '复制成功' : '复制此角度'}
          </button>
        </div>

        <h3>{angle.title}</h3>
        <div className="angle-card__perspective">
          <span>
            <Target aria-hidden="true" weight="bold" />
            核心切口
          </span>
          <p>{angle.perspective}</p>
        </div>
      </header>

      <div className="angle-card__insight-grid">
        <section className="why-report">
          <div className="card-section-title">
            <ShieldCheck aria-hidden="true" weight="bold" />
            <h4>为什么值得报道</h4>
          </div>
          <p className="why-report__summary">{angle.whyWorthReporting}</p>
          <ul className="news-values">
            {angle.newsValue.map((value) => {
              const item = splitNewsValue(value);
              return (
                <li key={value}>
                  <strong>{item.label}</strong>
                  <p>{item.copy}</p>
                </li>
              );
            })}
          </ul>
        </section>

        <section className="next-actions">
          <div className="card-section-title">
            <CheckCircle aria-hidden="true" weight="bold" />
            <h4>下一步行动</h4>
          </div>
          <ol>
            {angle.nextActions.map((action, actionIndex) => (
              <li key={action}>
                <span>{actionIndex + 1}</span>
                {action}
              </li>
            ))}
          </ol>
        </section>
      </div>

      <section className="interviewee-strip">
        <div className="interviewee-strip__heading">
          <UsersThree aria-hidden="true" weight="bold" />
          <span className="interviewee-strip__label">推荐采访对象</span>
        </div>
        <ul className="interviewee-list">
          {angle.interviewees.map((interviewee) => (
            <li key={interviewee}>{interviewee}</li>
          ))}
        </ul>
      </section>

      <div className="angle-card__details">
        <details open={index === 0}>
          <summary>
            <span>采访问题</span>
            <small>{angle.interviewQuestions.length} 个问题</small>
            <CaretDown aria-hidden="true" weight="bold" />
          </summary>
          <ol className="questions">
            {angle.interviewQuestions.map((question, questionIndex) => (
              <li key={question}>
                <span>{String(questionIndex + 1).padStart(2, '0')}</span>
                <p>{question}</p>
              </li>
            ))}
          </ol>
        </details>

        <details open={index === 0}>
          <summary>
            <span>核查与风险</span>
            <small>{angle.verificationChecklist.length + angle.risks.length} 项提醒</small>
            <CaretDown aria-hidden="true" weight="bold" />
          </summary>

          <div className="verification-grid">
            <section className="checklist">
              <h4>事实核查清单</h4>
              <ul>
                {angle.verificationChecklist.map((item) => (
                  <li key={item}>
                    <CheckCircle aria-hidden="true" weight="bold" />
                    <p>{item}</p>
                  </li>
                ))}
              </ul>
            </section>

            <section className="risk-note">
              <div className="risk-note__heading">
                <WarningCircle className="risk-note__mark" aria-hidden="true" weight="fill" />
                <h4>编辑提醒</h4>
              </div>
              <ul>
                {angle.risks.map((risk) => (
                  <li key={risk}>{risk}</li>
                ))}
              </ul>
            </section>
          </div>
        </details>
      </div>
    </article>
  );
}
