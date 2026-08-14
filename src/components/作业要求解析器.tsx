import { useEffect, useState } from 'react';
import {
  CaretDown,
  Check,
  ClipboardText,
  Info,
  Sparkle,
  WarningCircle,
} from '@phosphor-icons/react';
import {
  applyConfirmedAssignmentRequirements,
  parseAssignmentRequirements,
  type AssignmentRequirementValue,
  type ExtractedAssignmentRequirement,
} from '../../shared/作业要求解析.js';
import type { AssignmentType, ReportingBrief } from '../types';

interface AssignmentRequirementParserProps {
  brief: ReportingBrief;
  onApply: (brief: ReportingBrief) => void;
  onDraftChange?: (text: string) => void;
}

const confidenceLabel = {
  high: '高置信度',
  medium: '中置信度',
  low: '低置信度',
} as const;

const assignmentTypes: AssignmentType[] = [
  '消息',
  '人物特稿',
  '校园调查',
  '深度报道',
  '评论',
  '其他',
];

const displayValue = (value: AssignmentRequirementValue) => {
  if (value === undefined) return '';
  if (Array.isArray(value)) return value.join('\n');
  if (typeof value === 'boolean') return value ? '是' : '否';
  return String(value);
};

const updateValue = (
  field: ExtractedAssignmentRequirement,
  rawValue: string,
): AssignmentRequirementValue => {
  if (field.key === 'targetLength' || field.key === 'minimumInterviewees') {
    return rawValue ? Number(rawValue) : undefined;
  }
  if (
    field.key === 'requiresDifferentSourceTypes' ||
    field.key === 'requiresHumanStory' ||
    field.key === 'requiresInterviewOutline' ||
    field.key === 'requiresInterviewSummary'
  ) {
    return rawValue === 'true';
  }
  if (field.key === 'otherHardConstraints') {
    return rawValue.split(/\r?\n/u).map((item) => item.trim()).filter(Boolean);
  }
  return rawValue || undefined;
};

export function AssignmentRequirementParser({
  brief,
  onApply,
  onDraftChange,
}: AssignmentRequirementParserProps) {
  const [rawText, setRawText] = useState(brief.assignmentRequirementsText || '');
  const [fields, setFields] = useState<ExtractedAssignmentRequirement[]>([]);
  const [applied, setApplied] = useState(false);

  useEffect(() => {
    setRawText(brief.assignmentRequirementsText || '');
    setFields([]);
    setApplied(false);
  }, [brief.assignmentRequirementsText]);

  const updateField = (
    key: ExtractedAssignmentRequirement['key'],
    patch: Partial<ExtractedAssignmentRequirement>,
  ) => {
    setFields((current) =>
      current.map((field) => (field.key === key ? { ...field, ...patch } : field)),
    );
    setApplied(false);
  };

  return (
    <details className="assignment-parser">
      <summary>
        <span><ClipboardText weight="duotone" />粘贴课程作业要求</span>
        <span>可选 · 逐项确认<CaretDown /></span>
      </summary>
      <div className="assignment-parser__body">
        <div className="assignment-parser__intro">
          <div>
            <span className="section-label"><Sparkle />确定性文本解析</span>
            <h3>先提取，再由你确认</h3>
            <p>系统只读取你粘贴的文字。未确认的推测不会写入硬性作业要求。</p>
          </div>
          <p className="confirmation-legend"><WarningCircle />需要确认</p>
        </div>
        <label className="field">
          <span>课程作业要求原文</span>
          <textarea
            aria-label="课程作业要求原文"
            rows={6}
            value={rawText}
            placeholder="粘贴老师发布的作业要求。例如：完成一篇 2500 字人物特稿，至少采访 4 人……"
            onChange={(event) => {
              setRawText(event.target.value);
              onDraftChange?.(event.target.value);
              setApplied(false);
            }}
          />
        </label>
        <button
          className="secondary-action"
          type="button"
          disabled={!rawText.trim()}
          onClick={() => {
            setFields(parseAssignmentRequirements(rawText).fields);
            setApplied(false);
          }}
        >
          <Sparkle />解析要求
        </button>

        {fields.length ? (
          <div className="requirement-review" aria-label="解析结果确认表">
            <div className="requirement-review__head">
              <b>提取内容</b><b>原文依据</b><b>置信度</b><b>确认</b>
            </div>
            {fields.map((field) => {
              const booleanField =
                typeof field.value === 'boolean' ||
                field.key.startsWith('requires');
              return (
                <div className="requirement-review__row" key={field.key}>
                  <label>
                    <span>{field.label}</span>
                    {field.key === 'assignmentType' ? (
                      <select
                        aria-label={`${field.label}提取内容`}
                        value={displayValue(field.value)}
                        onChange={(event) =>
                          updateField(field.key, { value: event.target.value as AssignmentType })
                        }
                      >
                        <option value="">未提取</option>
                        {assignmentTypes.map((type) => <option key={type}>{type}</option>)}
                      </select>
                    ) : booleanField ? (
                      <select
                        aria-label={`${field.label}提取内容`}
                        value={field.value === undefined ? '' : String(field.value)}
                        onChange={(event) =>
                          updateField(field.key, {
                            value: updateValue(field, event.target.value),
                          })
                        }
                      >
                        <option value="">未提取</option>
                        <option value="true">是</option>
                        <option value="false">否</option>
                      </select>
                    ) : field.key === 'otherHardConstraints' ? (
                      <textarea
                        aria-label={`${field.label}提取内容`}
                        rows={2}
                        value={displayValue(field.value)}
                        onChange={(event) =>
                          updateField(field.key, {
                            value: updateValue(field, event.target.value),
                          })
                        }
                      />
                    ) : (
                      <input
                        aria-label={`${field.label}提取内容`}
                        type={
                          field.key === 'targetLength' ||
                          field.key === 'minimumInterviewees'
                            ? 'number'
                            : 'text'
                        }
                        value={displayValue(field.value)}
                        onChange={(event) =>
                          updateField(field.key, {
                            value: updateValue(field, event.target.value),
                          })
                        }
                      />
                    )}
                  </label>
                  <p>{field.evidence}</p>
                  <span className="confidence-badge" data-confidence={field.confidence}>
                    {confidenceLabel[field.confidence]}
                    <small>{field.needsConfirmation ? '原文含糊，必须人工判断' : '原文较明确，仍需确认采用'}</small>
                  </span>
                  <label className="confirm-requirement">
                    <input
                      aria-label={`${field.label}确认`}
                      type="checkbox"
                      checked={field.confirmed}
                      disabled={field.value === undefined || displayValue(field.value) === ''}
                      onChange={(event) =>
                        updateField(field.key, { confirmed: event.target.checked })
                      }
                    />
                    <span><Check />确认采用</span>
                  </label>
                </div>
              );
            })}
            <div className="requirement-review__actions">
              <p><Info />只应用勾选项；其余结果继续保留为待确认线索。</p>
              <button
                className="primary-action"
                type="button"
                disabled={!fields.some((field) => field.confirmed)}
                onClick={() => {
                  onApply({
                    ...applyConfirmedAssignmentRequirements(brief, fields),
                    assignmentRequirementsText: rawText,
                  });
                  setApplied(true);
                }}
              >
                <Check />应用已确认要求
              </button>
            </div>
            {applied ? <p className="assignment-parser__success" role="status">已应用勾选项；未确认项目没有写入任务。</p> : null}
          </div>
        ) : null}
      </div>
    </details>
  );
}
