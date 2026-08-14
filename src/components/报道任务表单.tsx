import {
  BookOpenText,
  Buildings,
  Check,
  Clock,
  Info,
  Lightning,
  ListChecks,
  Newspaper,
  Sparkle,
  UsersThree,
} from '@phosphor-icons/react';
import type { AssignmentType, ReportingBrief, ReportingMode } from '../types';
import { AssignmentRequirementParser } from './作业要求解析器';
import { NewsLeadComposer } from './新闻线索输入框';

export type PlanningDepth = 'quick' | 'full';

interface ReportingBriefFormProps {
  value: ReportingBrief;
  depth: PlanningDepth;
  error: string;
  generationError: string;
  isLoading: boolean;
  onChange: (brief: ReportingBrief) => void;
  onModeChange: (mode: ReportingMode) => void;
  onDepthChange: (depth: PlanningDepth) => void;
  onSubmit: () => void;
  onExampleSelect: (topic: string) => void;
}

const assignmentTypes: AssignmentType[] = [
  '消息',
  '人物特稿',
  '校园调查',
  '深度报道',
  '评论',
  '其他',
];

const examples = [
  '大学生使用生成式 AI 完成课程作业',
  '校园夜间摆渡车调整后，学生出行是否更方便',
  '毕业季实习焦虑如何影响新闻专业学生',
];

const linesToArray = (value: string) =>
  value
    .split(/\r?\n|[，,；;]/u)
    .map((item) => item.trim())
    .filter(Boolean);

export function ReportingBriefForm({
  value,
  depth,
  error,
  generationError,
  isLoading,
  onChange,
  onModeChange,
  onDepthChange,
  onSubmit,
  onExampleSelect,
}: ReportingBriefFormProps) {
  const update = <Key extends keyof ReportingBrief>(
    key: Key,
    nextValue: ReportingBrief[Key],
  ) => onChange({ ...value, [key]: nextValue });

  return (
    <section className="brief-card" aria-labelledby="brief-title">
      <div className="mode-switcher" aria-label="工作模式">
        <button
          type="button"
          data-active={value.mode === 'course'}
          onClick={() => onModeChange('course')}
        >
          <BookOpenText weight="duotone" />
          <span><b>课程作业</b><small>先满足老师与提交要求</small></span>
        </button>
        <button
          type="button"
          data-active={value.mode === 'campus_media'}
          onClick={() => onModeChange('campus_media')}
        >
          <Newspaper weight="duotone" />
          <span><b>校园媒体</b><small>先判断读者与时效窗口</small></span>
        </button>
      </div>

      <div className="brief-card__heading">
        <div>
          <span className="kicker">STEP 01 / REPORTING BRIEF</span>
          <h2 id="brief-title">先把任务说清楚，再拆选题</h2>
          <p>系统会把宽泛主题转成可验证的新闻问题，不会把假设冒充事实。</p>
        </div>
        <div className="depth-switch" aria-label="策划深度">
          <button type="button" data-active={depth === 'quick'} onClick={() => onDepthChange('quick')}>
            <Lightning weight="fill" />快速
          </button>
          <button type="button" data-active={depth === 'full'} onClick={() => onDepthChange('full')}>
            <ListChecks weight="fill" />完整
          </button>
        </div>
      </div>

      <form
        className="brief-form"
        onSubmit={(event) => {
          event.preventDefault();
          onSubmit();
        }}
      >
        {value.mode === 'course' ? (
          <div className="field--wide">
            <AssignmentRequirementParser
              brief={value}
              onApply={onChange}
              onDraftChange={(text) => update('assignmentRequirementsText', text)}
            />
          </div>
        ) : null}
        <div className="news-lead-stage field--wide">
          <NewsLeadComposer
            value={value.rawTopic}
            onChange={(rawTopic) => update('rawTopic', rawTopic)}
            onSubmit={onSubmit}
            loading={isLoading}
            error={error || generationError}
          />
          <p className="field__hint news-lead-stage__hint"><Info />写现象和范围即可，不用先想标题。</p>
          <div className="example-chips" aria-label="示例主题">
            {examples.map((example) => (
              <button key={example} type="button" onClick={() => onExampleSelect(example)}>
                {example}
              </button>
            ))}
          </div>
        </div>

        <div className="field">
          <label htmlFor="assignment-type">稿件类型</label>
          <select
            id="assignment-type"
            value={value.assignmentType}
            onChange={(event) => update('assignmentType', event.target.value as AssignmentType)}
          >
            {assignmentTypes.map((type) => <option key={type}>{type}</option>)}
          </select>
        </div>

        {value.mode === 'course' ? (
          <>
            <div className="field">
              <label htmlFor="course-name">课程名称</label>
              <input
                id="course-name"
                value={value.courseName || ''}
                placeholder="新闻采访与写作"
                onChange={(event) => update('courseName', event.target.value)}
              />
            </div>
            <div className="field">
              <label htmlFor="deadline"><Clock />截止时间</label>
              <input
                id="deadline"
                type="datetime-local"
                value={value.deadline || ''}
                onChange={(event) => update('deadline', event.target.value)}
              />
            </div>
          </>
        ) : (
          <>
            <div className="field">
              <label htmlFor="platform">发布平台</label>
              <input
                id="platform"
                value={value.platform || ''}
                placeholder="校报 / 公众号 / 视频号"
                onChange={(event) => update('platform', event.target.value)}
              />
            </div>
            <div className="field">
              <label htmlFor="publish-at"><Clock />计划发布时间</label>
              <input
                id="publish-at"
                type="datetime-local"
                value={value.publishAt || ''}
                onChange={(event) => update('publishAt', event.target.value)}
              />
            </div>
          </>
        )}

        <div className="field">
          <label htmlFor="minimum-interviewees"><UsersThree />最低采访人数</label>
          <input
            id="minimum-interviewees"
            type="number"
            min="1"
            max="30"
            value={value.minimumInterviewees || 1}
            onChange={(event) => update('minimumInterviewees', Number(event.target.value) || 1)}
          />
        </div>
        <div className="field">
          <label htmlFor="target-length">目标字数</label>
          <input
            id="target-length"
            type="number"
            min="200"
            step="100"
            value={value.targetLength || ''}
            placeholder="2000"
            onChange={(event) => update('targetLength', Number(event.target.value) || undefined)}
          />
        </div>
        <div className="field">
          <label htmlFor="geographic-scope">报道范围</label>
          <input
            id="geographic-scope"
            value={value.geographicScope || ''}
            placeholder="本校本科生课程"
            onChange={(event) => update('geographicScope', event.target.value)}
          />
        </div>
        <div className="field">
          <label htmlFor="target-audience">目标读者</label>
          <input
            id="target-audience"
            value={value.targetAudience || ''}
            placeholder="本校学生与教师"
            onChange={(event) => update('targetAudience', event.target.value)}
          />
        </div>

        <div className="field field--wide">
          <label htmlFor="available-interviewees">目前能联系到谁</label>
          <textarea
            id="available-interviewees"
            rows={2}
            value={value.availableInterviewees.join('\n')}
            placeholder={'每行一个角色，例如：\n使用过 AI 的学生\n任课教师\n教务老师'}
            onChange={(event) => update('availableInterviewees', linesToArray(event.target.value))}
          />
        </div>

        {depth === 'full' ? (
          <div className="full-fields field--wide">
            <div className="full-fields__heading">
              <Sparkle weight="duotone" />
              <span><b>完整策划补充项</b><small>信息越具体，Verdict 与采访路径越可靠。</small></span>
            </div>
            <div className="field-grid">
              <div className="field">
                <label htmlFor="existing-materials">已有材料</label>
                <textarea
                  id="existing-materials"
                  rows={3}
                  value={value.existingMaterials.join('\n')}
                  placeholder={'课程要求、通知、数据表……\n每行一项'}
                  onChange={(event) => update('existingMaterials', linesToArray(event.target.value))}
                />
              </div>
              <div className="field">
                <label htmlFor="reporting-resources">可用采编资源</label>
                <textarea
                  id="reporting-resources"
                  rows={3}
                  value={value.reportingResources.join('\n')}
                  placeholder={'1 名文字记者\n手机录音\n半天采访时间'}
                  onChange={(event) => update('reportingResources', linesToArray(event.target.value))}
                />
              </div>
              <div className="field">
                <label htmlFor="ethical-constraints">伦理与隐私约束</label>
                <textarea
                  id="ethical-constraints"
                  rows={3}
                  value={value.ethicalConstraints.join('\n')}
                  placeholder={'匿名保护学生身份\n不上传未公开材料'}
                  onChange={(event) => update('ethicalConstraints', linesToArray(event.target.value))}
                />
              </div>
              <div className="field">
                <label htmlFor="current-hook">{value.mode === 'course' ? '老师的具体要求' : '当前新闻钩子'}</label>
                <textarea
                  id="current-hook"
                  rows={3}
                  value={value.mode === 'course' ? value.teacherRequirements || '' : value.currentHook || ''}
                  placeholder={value.mode === 'course' ? '信源类型、提交格式、必须覆盖的内容……' : '为什么现在值得发？近期发生了什么？'}
                  onChange={(event) => update(value.mode === 'course' ? 'teacherRequirements' : 'currentHook', event.target.value)}
                />
              </div>
            </div>
            <div className="requirement-checks">
              {([
                ['requiresDifferentSourceTypes', '覆盖不同类型信源'],
                ['requiresHumanStory', '需要人物故事或现场'],
                ['requiresInterviewOutline', '需要提交采访提纲'],
                ['requiresPlanningDocument', '需要提交采访策划案'],
                ['requiresInterviewSummary', '需要提交采访总结'],
              ] as const).map(([key, label]) => (
                <label key={key}>
                  <input type="checkbox" checked={Boolean(value[key])} onChange={(event) => update(key, event.target.checked)} />
                  <span><Check weight="bold" />{label}</span>
                </label>
              ))}
            </div>
          </div>
        ) : null}

        <div className="brief-form__note field--wide">
          <div>
            <span><Buildings weight="duotone" />输出不是成稿，而是一份可执行的报道工作单。</span>
            <small>事实、数字和引语仍需你亲自采访与核实。</small>
          </div>
        </div>
      </form>
    </section>
  );
}
