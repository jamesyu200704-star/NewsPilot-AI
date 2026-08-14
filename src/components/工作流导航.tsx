import {
  CheckCircle,
  ClipboardText,
  MagnifyingGlass,
  Path,
  PencilLine,
} from '@phosphor-icons/react';

export type WorkflowStep = 1 | 2 | 3 | 4;

interface WorkflowNavigationProps {
  current: WorkflowStep;
  hasPlan: boolean;
  onChange: (step: WorkflowStep) => void;
}

const steps = [
  { id: 1, label: '填写任务', caption: '课程或刊发约束', icon: ClipboardText },
  { id: 2, label: '拆选题', caption: '判断与角度', icon: Path },
  { id: 3, label: '做采访', caption: '信源与提纲', icon: MagnifyingGlass },
  { id: 4, label: '核查提交', caption: '证据与自查', icon: CheckCircle },
] as const;

export function WorkflowNavigation({
  current,
  hasPlan,
  onChange,
}: WorkflowNavigationProps) {
  return (
    <nav className="workflow-nav" aria-label="报道工作流步骤">
      {steps.map((step) => {
        const Icon = step.id === 1 && current > 1 ? PencilLine : step.icon;
        const disabled = step.id > 1 && !hasPlan;
        const state = current === step.id ? 'current' : current > step.id ? 'done' : 'next';
        return (
          <button
            key={step.id}
            className="workflow-nav__step"
            type="button"
            data-state={state}
            disabled={disabled}
            aria-current={current === step.id ? 'step' : undefined}
            onClick={() => onChange(step.id)}
          >
            <span className="workflow-nav__index">
              <Icon weight={state === 'current' ? 'fill' : 'regular'} />
              <b>0{step.id}</b>
            </span>
            <span>
              <strong>{step.label}</strong>
              <small>{step.caption}</small>
            </span>
          </button>
        );
      })}
    </nav>
  );
}
