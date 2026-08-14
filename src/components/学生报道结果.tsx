import { useMemo, useState } from 'react';
import {
  ArrowLeft,
  ArrowRight,
  CaretDown,
  Check,
  Clipboard,
  DownloadSimple,
  FileMagnifyingGlass,
  Flag,
  Info,
  Lightbulb,
  ListMagnifyingGlass,
  MapTrifold,
  Quotes,
  ShieldWarning,
  Sparkle,
  Target,
  UsersThree,
  WarningCircle,
} from '@phosphor-icons/react';
import type {
  CandidateAngle,
  StudentReportingPlan,
  VerificationStatus,
} from '../types';
import type { PlanningDepth } from './报道任务表单';
import type { WorkflowStep } from './工作流导航';
import { copyText } from '../utils/copy';
import {
  buildStudentPlanMarkdown,
  exportStudentPlanMarkdown,
} from '../utils/学生策划案导出';
import { buildQuickReportingSummary } from '../../shared/快速策划摘要.js';
import type { EvidenceWorkspaceState } from '../../shared/证据领域模型.js';

interface StudentReportingResultsProps {
  plan: StudentReportingPlan;
  evidenceWorkspace?: EvidenceWorkspaceState;
  step: WorkflowStep;
  depth: PlanningDepth;
  selectedAngleId: string;
  onSelectedAngleChange: (id: string) => void;
  onStepChange: (step: WorkflowStep) => void;
  onDepthChange: (depth: PlanningDepth) => void;
}

const verdictCopy = {
  GO: ['可以推进', '当前题目具备进入正式采访的最低条件。'],
  REVISE: ['收窄后推进', '方向有价值，但范围或信源条件需要先调整。'],
  HOLD: ['先补条件', '暂不进入正式采访，先补充信源或原始材料。'],
  DROP: ['暂时放弃', '在当前截止期与资源下不建议继续投入。'],
} as const;

const verificationCopy: Record<VerificationStatus, string> = {
  verified: '已核实',
  partially_verified: '部分核实',
  unverified: '未核实',
  conflicted: '证据冲突',
};

const scoreLabels: Record<keyof CandidateAngle['score'], string> = {
  newsValue: '新闻价值',
  audienceRelevance: '读者相关',
  sourceAccessibility: '信源可达',
  evidenceAvailability: '证据可得',
  deadlineFeasibility: '周期可行',
  scenePotential: '现场潜力',
  ethicalSafety: '伦理安全',
};

function ResultHeader({ plan }: { plan: StudentReportingPlan }) {
  return (
    <div className="result-header">
      <div>
        <span className="kicker">REPORTING PLAN / {plan.mode.toUpperCase()}</span>
        <h2>{plan.topicFrame.newsQuestion}</h2>
        <p>{plan.assignmentSummary}</p>
      </div>
      <div className="result-header__scores" aria-label="策划评分">
        <span><b>{plan.newsValueAssessment.overallScore.toFixed(1)}</b><small>新闻价值</small></span>
        <span><b>{plan.feasibilityScore.toFixed(1)}</b><small>执行可行性</small></span>
      </div>
    </div>
  );
}

function VerdictPanel({ plan }: { plan: StudentReportingPlan }) {
  const copy = verdictCopy[plan.verdict.status];
  return (
    <section className="verdict-panel" data-verdict={plan.verdict.status}>
      <div className="verdict-stamp">
        <span>EDITOR'S</span>
        <strong>{plan.verdict.status}</strong>
        <small>{copy[0]}</small>
      </div>
      <div className="verdict-panel__copy">
        <span className="section-label"><Flag weight="fill" />是否值得继续做</span>
        <h3>{copy[1]}</h3>
        <ul>{plan.verdict.reasons.map((reason) => <li key={reason}>{reason}</li>)}</ul>
        <div className="verdict-grid">
          <p><b>最大优势</b>{plan.verdict.greatestStrength}</p>
          <p><b>最大风险</b>{plan.verdict.greatestRisk}</p>
        </div>
        <p className="minimum-version"><Target /> <span><b>最小可行版本</b>{plan.verdict.minimumViableVersion}</span></p>
      </div>
    </section>
  );
}

function AngleCard({
  angle,
  selected,
  recommended,
  onSelect,
}: {
  angle: CandidateAngle;
  selected: boolean;
  recommended: boolean;
  onSelect: () => void;
}) {
  return (
    <article className="angle-card" data-selected={selected}>
      <button className="angle-card__select" type="button" onClick={onSelect} aria-pressed={selected}>
        <span className="angle-card__topline">
          <span className="strategy-tag">{angle.strategyName}</span>
          {recommended ? <span className="recommended-tag"><Sparkle weight="fill" />系统推荐</span> : null}
        </span>
        <strong>{angle.title}</strong>
        <p>{angle.rationale}</p>
        <span className="angle-card__score"><b>{angle.totalScore.toFixed(1)}</b> / 10</span>
        <span className="radio-mark">{selected ? <Check weight="bold" /> : null}</span>
      </button>
      {selected ? (
        <div className="angle-card__details">
          <p><b>核心矛盾</b>{angle.coreConflict}</p>
          <div className="score-bars">
            {Object.entries(angle.score).map(([key, value]) => (
              <div key={key}>
                <span>{scoreLabels[key as keyof CandidateAngle['score']]}</span>
                <i><em style={{ width: `${value * 10}%` }} /></i>
                <b>{value.toFixed(1)}</b>
              </div>
            ))}
          </div>
          <p className="student-note"><Lightbulb weight="fill" />{angle.feasibilityNote}</p>
        </div>
      ) : null}
    </article>
  );
}

function StepTwo({
  plan,
  selectedAngleId,
  onSelectedAngleChange,
}: Pick<StudentReportingResultsProps, 'plan' | 'selectedAngleId' | 'onSelectedAngleChange'>) {
  return (
    <>
      <ResultHeader plan={plan} />
      <VerdictPanel plan={plan} />
      <section className="result-section">
        <div className="section-heading">
          <span className="section-number">02</span>
          <div><h3>比较可执行的报道角度</h3><p>推荐不是命令。选择更符合你采访条件的角度，后续信源与问题会围绕它执行。</p></div>
        </div>
        <div className="angle-list">
          {plan.candidateAngles.map((angle) => (
            <AngleCard
              key={angle.id}
              angle={angle}
              selected={angle.id === selectedAngleId}
              recommended={angle.id === plan.recommendedAngleId}
              onSelect={() => onSelectedAngleChange(angle.id)}
            />
          ))}
        </div>
      </section>
      <section className="result-section result-section--split">
        <div>
          <span className="section-label"><FileMagnifyingGlass />现在知道什么</span>
          <ul className="editorial-list">{plan.topicFrame.knownFacts.map((item) => <li key={item}>{item}</li>)}</ul>
        </div>
        <div>
          <span className="section-label"><WarningCircle />还不知道什么</span>
          <ul className="editorial-list">{plan.topicFrame.unknowns.map((item) => <li key={item}>{item}</li>)}</ul>
        </div>
      </section>
      <aside className="hypothesis-note">
        <Info weight="fill" />
        <span><b>工作假设，不是事实</b>{plan.topicFrame.workingHypothesis}</span>
      </aside>
    </>
  );
}

function StepThree({ plan }: { plan: StudentReportingPlan }) {
  return (
    <>
      <ResultHeader plan={plan} />
      <section className="result-section">
        <div className="section-heading">
          <span className="section-number">03</span>
          <div><h3>先做信源地图，再写采访问题</h3><p>每类信源承担不同的信息任务；低可达信源必须有替代方案。</p></div>
        </div>
        <div className="source-map">
          {plan.sourceMap.map((source) => (
            <article key={source.id} className="source-card">
              <div className="source-card__head">
                <span><UsersThree weight="duotone" /></span>
                <div><h4>{source.role}</h4><small data-access={source.accessibility}>可达性 · {source.accessibility === 'high' ? '较高' : source.accessibility === 'medium' ? '一般' : '较低'}</small></div>
              </div>
              <p>{source.informationValue}</p>
              <dl>
                <div><dt>可能偏差</dt><dd>{source.possibleBias}</dd></div>
                <div><dt>替代信源</dt><dd>{source.alternativeSources.join('、')}</dd></div>
                <div><dt>核实目标</dt><dd>{source.verificationTargets.join('、')}</dd></div>
              </dl>
            </article>
          ))}
        </div>
      </section>

      <section className="result-section">
        <div className="section-heading section-heading--compact">
          <span className="section-number">Q</span>
          <div><h3>采访问题阶梯</h3><p>从事实与经历进入原因和冲突，最后回到验证。每个问题都标注证据目的。</p></div>
        </div>
        <div className="interview-groups">
          {plan.interviewPlans.map((group, groupIndex) => (
            <details key={group.sourceId} open={groupIndex === 0}>
              <summary><span><Quotes weight="duotone" />采访：{group.sourceRole}</span><CaretDown /></summary>
              <ol className="question-ladder">
                {group.questions.map((question) => (
                  <li key={question.stage}>
                    <span>{question.stage}</span>
                    <div><h4>{question.question}</h4><p><b>为什么问：</b>{question.purpose}</p><p><b>要拿到：</b>{question.expectedEvidence}</p></div>
                  </li>
                ))}
              </ol>
            </details>
          ))}
        </div>
      </section>
    </>
  );
}

function StepFour({ plan }: { plan: StudentReportingPlan }) {
  return (
    <>
      <ResultHeader plan={plan} />
      <section className="result-section">
        <div className="section-heading">
          <span className="section-number">04</span>
          <div><h3>把关键说法放进证据矩阵</h3><p>原始来源可独立支撑；两条独立可靠来源可交叉验证；社交媒体只能提供线索。</p></div>
        </div>
        <div className="evidence-table-wrap">
          <table className="evidence-table">
            <thead><tr><th>待验证说法</th><th>证据状态</th><th>关联证据</th><th>剩余工作</th></tr></thead>
            <tbody>
              {plan.claimEvidenceMatrix.map((claim) => (
                <tr key={claim.claim}>
                  <td>{claim.claim}</td>
                  <td><span className="verification-status" data-status={claim.status}>{verificationCopy[claim.status]}</span></td>
                  <td>{claim.linkedEvidenceIds.join('、') || '尚无'}</td>
                  <td>{claim.remainingWork.join('；')}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>

      <section className="result-section">
        <div className="section-heading section-heading--compact">
          <span className="section-number"><ListMagnifyingGlass /></span>
          <div><h3>证据账本</h3><p>记录来源、发布时间、获取时间与 evidenceId。当前摘要不会被自动认定为事实。</p></div>
        </div>
        {plan.evidenceLedger.length ? (
          <div className="ledger-list">
            {plan.evidenceLedger.map((evidence) => (
              <article key={evidence.id}>
                <div><code>{evidence.id}</code><span data-tier={evidence.credibilityTier}>可信度 {evidence.credibilityTier}</span></div>
                <h4>{evidence.title}</h4>
                <p>{evidence.summary}</p>
                <small>{evidence.publisher} · 获取于 {new Date(evidence.retrievedAt).toLocaleString('zh-CN')}</small>
              </article>
            ))}
          </div>
        ) : <div className="empty-ledger"><MapTrifold weight="duotone" /><p><b>尚无证据记录</b>请从原始文件与真实采访开始，逐条补 evidenceId。</p></div>}
      </section>

      <section className="check-grid">
        <article className="check-card check-card--risk">
          <span className="section-label"><ShieldWarning weight="fill" />伦理与报道风险</span>
          <ul>{plan.ethicalRisks.map((risk) => <li key={risk}>{risk}</li>)}</ul>
        </article>
        <article className="check-card">
          <span className="section-label"><Check weight="bold" />提交前自查</span>
          <ul>{plan.submissionChecklist.map((item) => <li key={item}>{item}</li>)}</ul>
        </article>
      </section>
      <section className="action-plan">
        <div className="section-heading section-heading--compact">
          <span className="section-number">48h</span>
          <div><h3>下一步行动计划</h3><p>从现在开始，不等“想清楚全部”再行动。</p></div>
        </div>
        <ol>{plan.actionPlan.map((item) => <li key={item.order}><b>{item.when}</b><span>{item.action}<small>交付：{item.output}</small></span></li>)}</ol>
      </section>
    </>
  );
}

function QuickResult({
  plan,
  evidenceWorkspace,
  onExpand,
}: {
  plan: StudentReportingPlan;
  evidenceWorkspace?: EvidenceWorkspaceState;
  onExpand: () => void;
}) {
  const summary = buildQuickReportingSummary(plan);
  const criticalClaims = evidenceWorkspace?.claims.filter((claim) => claim.importance === 'critical').slice(0, 3) || [];
  const topSourceTypes = [...new Set(evidenceWorkspace?.searchPlan?.queries.flatMap((query) => query.targetSourceTypes) || [])].slice(0, 3);
  return (
    <div className="quick-decision">
      <div className="quick-decision__hero" data-verdict={summary.verdict}>
        <span><Flag weight="fill" />编辑判断</span>
        <strong>{summary.verdict}</strong>
        <p>{verdictCopy[summary.verdict][1]}</p>
      </div>
      <article className="quick-decision__question">
        <span className="section-label"><Target />推荐的新闻问题</span>
        <h2>{summary.newsQuestion}</h2>
      </article>
      <div className="quick-decision__grid">
        <article>
          <span className="section-label"><Sparkle />推荐角度</span>
          <small>{summary.recommendedAngle.strategy}</small>
          <h3>{summary.recommendedAngle.title}</h3>
          <p>{summary.recommendedAngle.rationale}</p>
        </article>
        <article>
          <span className="section-label"><UsersThree />最先联系的 3 类采访对象</span>
          <ol>{summary.firstSources.map((source) => <li key={source.role}><b>{source.role}</b><span>{source.why}</span></li>)}</ol>
        </article>
        <article>
          <span className="section-label"><FileMagnifyingGlass />最先查找的 3 项资料</span>
          <ol>{summary.firstMaterials.map((material) => <li key={material}>{material}</li>)}</ol>
        </article>
        <article className="quick-decision__risk">
          <span className="section-label"><ShieldWarning />最大风险</span>
          <p>{summary.biggestRisk}</p>
        </article>
        <article className="quick-decision__evidence">
          <span className="section-label"><FileMagnifyingGlass />关键证据缺口</span>
          <ul>{criticalClaims.length ? criticalClaims.map((claim) => <li key={claim.id}><b>{claim.id}</b> {claim.missingEvidence[0] || '待补原始来源'}</li>) : <li>尚未建立证据工作区；进入完整策划后拆分主张。</li>}</ul>
          <p><b>优先来源：</b>{topSourceTypes.join('、') || '原始文件、官方数据、直接采访'}</p>
          <p><b>来源冲突：</b>{evidenceWorkspace?.conflicts.length ? `存在 ${evidenceWorkspace.conflicts.length} 项，需人工核对` : '当前未发现（不等于已经核实）'}</p>
        </article>
        <article className="quick-decision__actions">
          <span className="section-label"><ArrowRight />接下来立即完成的 3 件事</span>
          <ol>{summary.immediateActions.map((action, index) => <li key={action}><b>0{index + 1}</b><span>{action}</span></li>)}</ol>
        </article>
      </div>
      <details className="quick-decision__details">
        <summary>查看评分、完整采访问题与证据矩阵说明<CaretDown /></summary>
        <p>详细评分、全部采访问题和证据矩阵默认收起。进入完整策划后可按“拆选题—做采访—核查提交”逐步查看。</p>
      </details>
      <button className="primary-action quick-decision__enter" type="button" onClick={onExpand}>进入完整策划<ArrowRight /></button>
    </div>
  );
}

export function StudentReportingResults(props: StudentReportingResultsProps) {
  const [copied, setCopied] = useState(false);
  const markdown = useMemo(() => buildStudentPlanMarkdown(props.plan), [props.plan]);

  const copyPlan = async () => {
    await copyText(markdown);
    setCopied(true);
    globalThis.setTimeout(() => setCopied(false), 1800);
  };

  return (
    <section className="reporting-results" aria-labelledby="results-title">
      <h2 className="visually-hidden" id="results-title" tabIndex={-1}>报道策划结果</h2>
      {props.plan.fallbackNotice ? <p className="fallback-notice"><WarningCircle />{props.plan.fallbackNotice}</p> : null}
      {props.depth === 'quick' ? (
        <QuickResult
          plan={props.plan}
          evidenceWorkspace={props.evidenceWorkspace}
          onExpand={() => props.onDepthChange('full')}
        />
      ) : props.step === 2 ? (
        <StepTwo plan={props.plan} selectedAngleId={props.selectedAngleId} onSelectedAngleChange={props.onSelectedAngleChange} />
      ) : props.step === 3 ? (
        <StepThree plan={props.plan} />
      ) : (
        <StepFour plan={props.plan} />
      )}

      {props.depth === 'full' ? <div className="result-actions">
        <button type="button" className="secondary-action" onClick={() => props.onStepChange(props.step === 2 ? 1 : (props.step - 1) as WorkflowStep)}>
          <ArrowLeft />{props.step === 2 ? '修改任务' : '上一步'}
        </button>
        <div>
          <button type="button" className="secondary-action" onClick={() => void copyPlan()}>
            {copied ? <Check /> : <Clipboard />}{copied ? '已复制' : '复制策划案'}
          </button>
          <button type="button" className="secondary-action" onClick={() => exportStudentPlanMarkdown(props.plan)}>
            <DownloadSimple />导出 Markdown
          </button>
          {props.depth === 'full' && props.step < 4 ? (
            <button type="button" className="primary-action" onClick={() => props.onStepChange((props.step + 1) as WorkflowStep)}>
              {props.step === 2 ? '进入采访规划' : '进入核查提交'}<ArrowRight />
            </button>
          ) : null}
        </div>
      </div> : null}
    </section>
  );
}
