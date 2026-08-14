import { useMemo, useState } from 'react';
import {
  blindReviewDimensions,
  createBlindComparison,
  finalizeBlindComparison,
  serializeAnonymousReviewCsv,
  serializeAnonymousReviewJson,
  type AnonymousVariantId,
  type BlindComparison,
  type BlindReviewDimension,
  type BlindReviewScore,
} from '../../shared/人工盲评';

interface ManualBlindReviewToolProps {
  newsPilotOutput: string;
}

type ScoreDraft = Record<
  AnonymousVariantId,
  Partial<Record<BlindReviewDimension, number>>
>;

const emptyScoreDraft = (): ScoreDraft => ({
  '方案 A': {},
  '方案 B': {},
  '方案 C': {},
});

const downloadText = (filename: string, text: string, mimeType: string) => {
  const blob = new Blob([text], { type: `${mimeType};charset=utf-8` });
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement('a');
  anchor.href = url;
  anchor.download = filename;
  anchor.click();
  URL.revokeObjectURL(url);
};

export function ManualBlindReviewTool({
  newsPilotOutput,
}: ManualBlindReviewToolProps) {
  const [caseId, setCaseId] = useState(`案例-${new Date().toISOString().slice(0, 10)}`);
  const [generalModelOutput, setGeneralModelOutput] = useState('');
  const [studentOutput, setStudentOutput] = useState('');
  const [comparison, setComparison] = useState<BlindComparison | null>(null);
  const [scoreDraft, setScoreDraft] = useState<ScoreDraft>(emptyScoreDraft);
  const [comments, setComments] = useState<Record<AnonymousVariantId, string>>({
    '方案 A': '',
    '方案 B': '',
    '方案 C': '',
  });
  const [message, setMessage] = useState('');
  const [submittedScores, setSubmittedScores] = useState<BlindReviewScore[] | null>(null);

  const readyToCreate = Boolean(
    newsPilotOutput.trim() && generalModelOutput.trim() && studentOutput.trim(),
  );

  const reviewComplete = useMemo(() => {
    if (!comparison) return false;
    return comparison.packet.variants.every(({ anonymousId }) =>
      blindReviewDimensions.every(({ key }) => {
        const value = scoreDraft[anonymousId][key];
        return Number.isInteger(value) && Number(value) >= 1 && Number(value) <= 5;
      }),
    );
  }, [comparison, scoreDraft]);

  const buildScores = (): BlindReviewScore[] => {
    if (!comparison || !reviewComplete) {
      throw new Error('请先完成全部 13 个维度的人工评分。');
    }
    return comparison.packet.variants.map(({ anonymousId }) => ({
      anonymousId,
      scores: scoreDraft[anonymousId] as Record<BlindReviewDimension, number>,
      comment: comments[anonymousId].trim(),
    }));
  };

  const createPacket = () => {
    if (!readyToCreate) return;
    setComparison(
      createBlindComparison({
        caseId: caseId.trim() || '未命名案例',
        outputs: [
          { source: 'newspilot', content: newsPilotOutput },
          { source: 'general_model', content: generalModelOutput },
          { source: 'student', content: studentOutput },
        ],
      }),
    );
    setScoreDraft(emptyScoreDraft());
    setSubmittedScores(null);
    setMessage('匿名盲评包已生成。评审区不会显示方案来源。');
  };

  const submitScores = () => {
    if (!comparison || !reviewComplete) return;
    const scores = buildScores();
    finalizeBlindComparison(comparison, scores);
    setSubmittedScores(scores);
    setMessage('评分已提交并锁定。现在可以导出匿名结果或揭示来源。');
  };

  const exportAnonymous = (format: 'json' | 'csv') => {
    if (!comparison || !submittedScores) return;
    const scores = submittedScores;
    if (format === 'json') {
      downloadText(
        `${comparison.packet.caseId}-匿名盲评.json`,
        serializeAnonymousReviewJson(comparison.packet, scores),
        'application/json',
      );
    } else {
      downloadText(
        `${comparison.packet.caseId}-匿名盲评.csv`,
        `\uFEFF${serializeAnonymousReviewCsv(comparison.packet, scores)}`,
        'text/csv',
      );
    }
  };

  return (
    <details className="research-tool">
      <summary>
        <span><b>人工匿名对照评测</b><small>研究工具 · 不调用额外 API</small></span>
        <span aria-hidden="true">＋</span>
      </summary>

      <div className="research-tool__body">
        <p className="research-tool__notice">
          由测试人员手动粘贴“通用聊天模型”和“学生自行策划”的结果，再与本次 NewsPilot
          方案随机匿名。系统只负责排版、评分记录与导出，不会把程序测试通过率当作产品质量。
        </p>

        <details className="blind-review-rubric">
          <summary>查看 13 项评分标准</summary>
          <div>
            {blindReviewDimensions.map(({ key, label, rubric }) => (
              <article key={key}>
                <b>{label}</b>
                <p>1 分：{rubric[1]}</p>
                <p>3 分：{rubric[3]}</p>
                <p>5 分：{rubric[5]}</p>
              </article>
            ))}
          </div>
        </details>

        {!comparison ? (
          <div className="blind-review-setup">
            <label>
              案例编号
              <input value={caseId} onChange={(event) => setCaseId(event.target.value)} />
            </label>
            <label>
              NewsPilot 输出
              <textarea
                aria-label="NewsPilot 输出"
                value={newsPilotOutput}
                readOnly
                placeholder="先生成一份 NewsPilot 策划案"
              />
            </label>
            <label>
              通用聊天模型输出
              <textarea
                aria-label="通用聊天模型输出"
                value={generalModelOutput}
                onChange={(event) => setGeneralModelOutput(event.target.value)}
                placeholder="由测试人员手动粘贴，不自动调用付费 API"
              />
            </label>
            <label>
              学生自行策划结果
              <textarea
                aria-label="学生自行策划结果"
                value={studentOutput}
                onChange={(event) => setStudentOutput(event.target.value)}
                placeholder="粘贴学生在不使用 NewsPilot 时完成的策划结果"
              />
            </label>
            <button type="button" disabled={!readyToCreate} onClick={createPacket}>
              生成匿名盲评包
            </button>
          </div>
        ) : (
          <div className="blind-review-workspace">
            <div className="blind-review-toolbar">
              <p role="status">{message}</p>
              <button type="button" onClick={() => { setComparison(null); setSubmittedScores(null); }}>重新准备材料</button>
            </div>

            <div className="blind-review-variants">
              {comparison.packet.variants.map((variant) => (
                <article className="blind-review-card" key={variant.anonymousId}>
                  <h4>{variant.anonymousId}</h4>
                  <details>
                    <summary>阅读匿名方案</summary>
                    <pre>{variant.content}</pre>
                  </details>
                  <div className="blind-review-scores">
                    {blindReviewDimensions.map(({ key, label }) => (
                      <label key={key}>
                        <span>{label}</span>
                        <select
                          aria-label={`${variant.anonymousId}：${label}`}
                          disabled={Boolean(submittedScores)}
                          value={scoreDraft[variant.anonymousId][key] ?? ''}
                          onChange={(event) => {
                            const score = Number(event.target.value);
                            setScoreDraft((current) => ({
                              ...current,
                              [variant.anonymousId]: {
                                ...current[variant.anonymousId],
                                [key]: score,
                              },
                            }));
                          }}
                        >
                          <option value="">未评分</option>
                          {[1, 2, 3, 4, 5].map((score) => (
                            <option key={score} value={score}>{score}</option>
                          ))}
                        </select>
                      </label>
                    ))}
                    <label className="blind-review-comment">
                      评语（可选）
                      <textarea
                        disabled={Boolean(submittedScores)}
                        value={comments[variant.anonymousId]}
                        onChange={(event) => setComments((current) => ({
                          ...current,
                          [variant.anonymousId]: event.target.value,
                        }))}
                      />
                    </label>
                  </div>
                </article>
              ))}
            </div>

            <div className="blind-review-exports">
              <p>{submittedScores ? '评分已锁定，可以匿名导出并揭示来源。' : reviewComplete ? '请先提交并锁定评分；揭盲在此之前不可用。' : '完成全部评分后才能提交，系统不会预填或伪造分数。'}</p>
              <button type="button" disabled={!reviewComplete || Boolean(submittedScores)} onClick={submitScores}>
                提交评分并锁定
              </button>
              <button type="button" disabled={!submittedScores} onClick={() => exportAnonymous('json')}>
                导出匿名 JSON
              </button>
              <button type="button" disabled={!submittedScores} onClick={() => exportAnonymous('csv')}>
                导出匿名 CSV
              </button>
              <button
                type="button"
                disabled={!submittedScores}
                onClick={() => downloadText(
                  `${comparison.packet.caseId}-揭盲密钥.json`,
                  JSON.stringify(comparison.revealKey, null, 2),
                  'application/json',
                )}
              >
                单独导出揭盲密钥
              </button>
            </div>
          </div>
        )}
      </div>
    </details>
  );
}
