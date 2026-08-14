import type { Dispatch, ReactNode, SetStateAction } from 'react';
import type { ReportingBrief, StudentReportingPlan } from '../../../shared/学生报道模型.js';
import type { EvidenceWorkspaceState } from '../../../shared/证据领域模型.js';
import type { ExecutionWorkspaceState } from '../../../shared/报道执行模型.js';

export type ExecutionPage =
  | 'overview'
  | 'tasks'
  | 'sources'
  | 'guide'
  | 'records'
  | 'evidence'
  | 'outline'
  | 'check'
  | 'export';

export interface ExecutionPageProps {
  projectName: string;
  brief: ReportingBrief;
  plan: StudentReportingPlan;
  evidenceWorkspace: EvidenceWorkspaceState;
  value: ExecutionWorkspaceState;
  onChange: Dispatch<SetStateAction<ExecutionWorkspaceState>>;
  onEvidenceChange: Dispatch<SetStateAction<EvidenceWorkspaceState>>;
  onNavigate: (page: ExecutionPage) => void;
}

export interface ReportingExecutionWorkbenchProps extends Omit<ExecutionPageProps, 'onNavigate'> {
  evidencePanel: ReactNode;
}
