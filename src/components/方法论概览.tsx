import {
  ChartBar,
  ShieldCheck,
  Target,
  UsersThree,
} from '@phosphor-icons/react';
import type { GenerationResult } from '../types';

interface MethodologyOverviewProps {
  result: GenerationResult;
}

const confidenceLabels = {
  low: '低置信度',
  medium: '中置信度',
  high: '高置信度',
} as const;

const categoryLabels = {
  education: '教育议题',
  policy: '政策议题',
  consumer: '消费议题',
  technology: '技术议题',
  general: '公共议题',
} as const;

const stars = (score: number) => {
  const filled = Math.max(0, Math.min(5, Math.round(score)));
  return '★'.repeat(filled) + '☆'.repeat(5 - filled);
};

export function MethodologyOverview({ result }: MethodologyOverviewProps) {
  const { newsValueAssessment, ruleDecision, topicAnalysis } = result;

  return (
    <section className="methodology" aria-labelledby="methodology-title">
      <header className="methodology__header">
        <div>
          <span className="section-kicker">Methodology / 01</span>
          <h3 id="methodology-title">新闻判断，不交给模型自由发挥。</h3>
        </div>
        <div className="methodology__score" aria-label={`综合新闻价值 ${newsValueAssessment.overallScore.toFixed(1)} 分，满分 10 分`}>
          <span>综合新闻价值</span>
          <strong>{newsValueAssessment.overallScore.toFixed(1)}</strong>
          <small>/ 10 · {confidenceLabels[newsValueAssessment.confidence]}</small>
        </div>
      </header>

      <div className="methodology__grid">
        <article className="methodology-card methodology-card--values">
          <div className="methodology-card__title">
            <ChartBar aria-hidden="true" weight="bold" />
            <div>
              <span>六维评分</span>
              <h4>新闻价值矩阵</h4>
            </div>
          </div>
          <div className="value-matrix">
            {newsValueAssessment.dimensions.map((dimension) => (
              <div className="value-dimension" key={dimension.id}>
                <div className="value-dimension__heading">
                  <strong>{dimension.label}</strong>
                  <span aria-hidden="true">{stars(dimension.score)}</span>
                  <b>{dimension.score.toFixed(1)}</b>
                </div>
                <div className="value-dimension__track" aria-hidden="true">
                  <span style={{ width: `${dimension.score * 20}%` }} />
                </div>
                <p>{dimension.rationale}</p>
              </div>
            ))}
          </div>
        </article>

        <div className="methodology__analysis-stack">
          <article className="methodology-card methodology-card--analysis">
            <div className="methodology-card__title">
              <Target aria-hidden="true" weight="bold" />
              <div>
                <span>{categoryLabels[topicAnalysis.category]}</span>
                <h4>主题分析</h4>
              </div>
            </div>
            <p>{topicAnalysis.summary}</p>
          </article>

          <article className="methodology-card methodology-card--conflict">
            <div className="methodology-card__title">
              <ShieldCheck aria-hidden="true" weight="bold" />
              <div>
                <span>Editorial tension</span>
                <h4>核心矛盾</h4>
              </div>
            </div>
            <p>{topicAnalysis.coreConflict}</p>
          </article>
        </div>
      </div>

      <div className="rule-trace">
        <div className="rule-trace__heading">
          <div>
            <span className="section-kicker">Rules / 02</span>
            <h4>规则引擎命中 {ruleDecision.matches.length} 条新闻方法</h4>
          </div>
          <UsersThree aria-hidden="true" weight="bold" />
        </div>

        <div className="rule-trace__matches">
          {ruleDecision.matches.map((match) => (
            <article key={match.id}>
              <span>{match.id}</span>
              <strong>{match.title}</strong>
              <p>{match.reason}</p>
            </article>
          ))}
        </div>

        <details className="rule-coverage">
          <summary>查看规则要求覆盖的采访对象</summary>
          <ul>
            {ruleDecision.requiredInterviewees.map((interviewee) => (
              <li key={interviewee}>{interviewee}</li>
            ))}
          </ul>
        </details>
      </div>
    </section>
  );
}
