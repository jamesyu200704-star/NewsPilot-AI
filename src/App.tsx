import { lazy, Suspense, useEffect, useRef, useState } from 'react';
import {
  ArrowDown,
  CheckCircle,
  CompassTool,
  FileMagnifyingGlass,
  Quotes,
} from '@phosphor-icons/react';
import { DeveloperSettings } from './components/开发者设置';
import { Header } from './components/Header';
import { LocalProjectBar } from './components/本地项目栏';
import { ManualBlindReviewTool } from './components/人工盲评工具';
import {
  ReportingBriefForm,
  type PlanningDepth,
} from './components/报道任务表单';
import { StudentReportingResults } from './components/学生报道结果';
import { NewsLeadComposer } from './components/新闻线索输入框';
import {
  WorkflowNavigation,
  type WorkflowStep,
} from './components/工作流导航';
import {
  clientGenerationMode,
  type ClientGenerationMode,
} from './services/generator';
import {
  checkingProviderStatus,
  detectGenerationProvider,
  getProviderPresentation,
  resolveGenerationMode,
  shouldDetectGenerationProvider,
  unavailableProviderStatus,
} from './services/providerStatus';
import { generateStudentReportingPlan } from './services/学生策划服务';
import {
  localProjectRepository,
  selectProjectAfterImport,
} from './services/本地项目仓库';
import { recordLocalProductEvent } from './services/本地研究仓库';
import { researchModeEnabled } from './services/研究模式';
import type { ReportingBrief, ReportingMode, StudentReportingPlan } from './types';
import type { LocalReportingProject } from '../shared/本地项目模型';
import type { EvidenceWorkspaceState } from '../shared/证据领域模型';
import type { ExecutionWorkspaceState } from '../shared/报道执行模型';
import { createEmptyEvidenceWorkspace } from '../shared/证据工作区';
import {
  createEmptyExecutionWorkspace,
  createExecutionWorkspaceFromPlan,
} from '../shared/报道执行工作区';
import { createClaimsFromBrief, createSearchPlan } from '../shared/证据工作流';
import { buildStudentPlanMarkdown } from './utils/学生策划案导出';

const EvidenceWorkbench = lazy(() =>
  import('./components/证据工作台').then((module) => ({ default: module.EvidenceWorkbench })),
);
const ReportingExecutionWorkbench = lazy(() =>
  import('./components/报道执行工作台').then((module) => ({ default: module.ReportingExecutionWorkbench })),
);
const ResearchAnalysisPanel = lazy(() =>
  import('./components/研究分析页').then((module) => ({ default: module.ResearchAnalysisPanel })),
);

const PROVIDER_HEALTH_ENDPOINT = '/api/health';
const PROVIDER_HEALTH_TIMEOUT_MS = 3_000;
const shouldDetectProvider = shouldDetectGenerationProvider(
  clientGenerationMode,
  import.meta.env.PROD,
);
const evidenceDemoMode = (import.meta.env.VITE_EVIDENCE_MODE || (import.meta.env.PROD ? 'mock' : 'live')) === 'mock';
const showResearchTools = import.meta.env.DEV || researchModeEnabled;

const dateAfter = (days: number) => {
  const date = new Date();
  date.setDate(date.getDate() + days);
  return date.toISOString().slice(0, 10);
};

const createInitialBrief = (mode: ReportingMode): ReportingBrief => ({
  mode,
  rawTopic: '',
  assignmentType: mode === 'course' ? '校园调查' : '消息',
  ...(mode === 'course'
    ? { courseName: '新闻采访与写作', deadline: `${dateAfter(7)}T23:59` }
    : { platform: '校园公众号', publishAt: `${dateAfter(3)}T18:00` }),
  targetLength: mode === 'course' ? 2000 : 1200,
  minimumInterviewees: 3,
  geographicScope: '本校校园',
  targetAudience: '本校学生与教师',
  availableInterviewees: ['学生', '任课教师'],
  existingMaterials: [],
  reportingResources: ['1 名学生记者', '手机录音'],
  ethicalConstraints: ['采访前说明用途并征得同意'],
  requiresDifferentSourceTypes: true,
  requiresHumanStory: true,
  requiresPlanningDocument: mode === 'course',
  requiresInterviewSummary: mode === 'course',
});

export default function App() {
  const [brief, setBrief] = useState<ReportingBrief>(() => createInitialBrief('course'));
  const [plan, setPlan] = useState<StudentReportingPlan | null>(null);
  const [evidenceWorkspace, setEvidenceWorkspace] = useState<EvidenceWorkspaceState>(() => createEmptyEvidenceWorkspace());
  const [executionWorkspace, setExecutionWorkspace] = useState<ExecutionWorkspaceState>(() => createEmptyExecutionWorkspace());
  const [step, setStep] = useState<WorkflowStep>(1);
  const [depth, setDepth] = useState<PlanningDepth>('full');
  const [selectedAngleId, setSelectedAngleId] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState('');
  const [generationError, setGenerationError] = useState('');
  const [generationMode, setGenerationMode] = useState<ClientGenerationMode>(
    clientGenerationMode,
  );
  const [providerStatus, setProviderStatus] = useState(
    shouldDetectProvider ? checkingProviderStatus : unavailableProviderStatus,
  );
  const [projects, setProjects] = useState<LocalReportingProject[]>([]);
  const [currentProjectId, setCurrentProjectId] = useState('');
  const [projectReady, setProjectReady] = useState(false);
  const [autosaveStatus, setAutosaveStatus] = useState('正在读取本地项目…');
  const [projectNotice, setProjectNotice] = useState('');
  const resultsRef = useRef<HTMLDivElement>(null);
  const planningResultsRef = useRef<HTMLDivElement>(null);
  const generationInFlightRef = useRef(false);
  const projectInitializedRef = useRef(false);
  const currentProjectRef = useRef<LocalReportingProject | null>(null);
  const suppressNextAutosaveRef = useRef(false);
  const providerPresentation = getProviderPresentation(providerStatus);

  useEffect(() => {
    if (!shouldDetectProvider) return;
    let active = true;
    void detectGenerationProvider({
      endpoint: PROVIDER_HEALTH_ENDPOINT,
      timeoutMs: PROVIDER_HEALTH_TIMEOUT_MS,
    }).then((status) => {
      if (!active) return;
      setProviderStatus(status);
      setGenerationMode((current) => resolveGenerationMode(current, status));
    });
    return () => {
      active = false;
    };
  }, []);

  const syncProjects = async () => {
    const nextProjects = await localProjectRepository.list();
    setProjects(nextProjects);
    return nextProjects;
  };

  const loadProject = (project: LocalReportingProject) => {
    suppressNextAutosaveRef.current = true;
    currentProjectRef.current = project;
    setCurrentProjectId(project.id);
    setBrief(project.brief);
    setPlan(project.plan);
    setEvidenceWorkspace(project.evidenceWorkspace);
    setExecutionWorkspace(project.executionWorkspace);
    setSelectedAngleId(project.selectedAngleId || project.plan?.recommendedAngleId || '');
    setStep(project.plan ? 2 : 1);
    setError('');
    setGenerationError('');
    setProjectNotice('');
    setAutosaveStatus('已载入本地项目');
  };

  const persistCurrentProject = async () => {
    const base = currentProjectRef.current;
    if (!base || base.id !== currentProjectId) return base;
    const saved = await localProjectRepository.save({
      ...base,
      brief,
      plan,
      selectedAngleId,
      evidenceWorkspace,
      executionWorkspace,
    });
    currentProjectRef.current = saved;
    setAutosaveStatus('已保存');
    return saved;
  };

  useEffect(() => {
    if (projectInitializedRef.current) return;
    projectInitializedRef.current = true;
    void (async () => {
      try {
        const existing = await localProjectRepository.list();
        if (existing.length) {
          setProjects(existing);
          loadProject(existing[0]);
        } else {
          const created = await localProjectRepository.create(
            '未命名报道项目',
            createInitialBrief('course'),
          );
          currentProjectRef.current = created;
          suppressNextAutosaveRef.current = true;
          setProjects([created]);
          setCurrentProjectId(created.id);
          setAutosaveStatus('已创建本地项目');
        }
      } catch (projectError) {
        setProjectNotice(
          projectError instanceof Error ? projectError.message : '本地项目初始化失败。',
        );
        setAutosaveStatus('本地保存不可用');
      } finally {
        setProjectReady(true);
      }
    })();
  }, []);

  useEffect(() => {
    if (!projectReady || !currentProjectId || !currentProjectRef.current) return;
    if (suppressNextAutosaveRef.current) {
      suppressNextAutosaveRef.current = false;
      return;
    }
    setAutosaveStatus('有更改，正在自动保存…');
    const timer = globalThis.setTimeout(() => {
      const base = currentProjectRef.current;
      if (!base || base.id !== currentProjectId) return;
      void localProjectRepository
        .save({ ...base, brief, plan, selectedAngleId, evidenceWorkspace, executionWorkspace })
        .then(async (saved) => {
          currentProjectRef.current = saved;
          await syncProjects();
          setAutosaveStatus('已自动保存');
          setProjectNotice('');
        })
        .catch((saveError: unknown) => {
          setAutosaveStatus('自动保存失败');
          setProjectNotice(
            saveError instanceof Error ? saveError.message : '浏览器拒绝写入本地项目。',
          );
        });
    }, 650);
    return () => globalThis.clearTimeout(timer);
  }, [brief, currentProjectId, evidenceWorkspace, executionWorkspace, plan, projectReady, selectedAngleId]);

  const createProject = async () => {
    try {
      await persistCurrentProject();
      const nextBrief = createInitialBrief(brief.mode);
      const created = await localProjectRepository.create('未命名报道项目', nextBrief);
      if (researchModeEnabled) void recordLocalProductEvent('project_created', 'project-bar');
      await syncProjects();
      loadProject(created);
      setProjectNotice('已新建项目。');
    } catch (projectError) {
      setProjectNotice(projectError instanceof Error ? projectError.message : '新建项目失败。');
    }
  };

  const renameProject = async (name: string) => {
    if (!currentProjectId) return;
    try {
      const renamed = await localProjectRepository.rename(currentProjectId, name);
      currentProjectRef.current = renamed;
      await syncProjects();
      setAutosaveStatus('名称已保存');
    } catch (projectError) {
      setProjectNotice(projectError instanceof Error ? projectError.message : '重命名失败。');
    }
  };

  const duplicateProject = async () => {
    if (!currentProjectId) return;
    try {
      await persistCurrentProject();
      const duplicated = await localProjectRepository.duplicate(currentProjectId);
      await syncProjects();
      loadProject(duplicated);
      setProjectNotice('已复制并打开项目副本。');
    } catch (projectError) {
      setProjectNotice(projectError instanceof Error ? projectError.message : '复制项目失败。');
    }
  };

  const deleteProject = async () => {
    if (!currentProjectId) return;
    try {
      await localProjectRepository.delete(currentProjectId);
      const remaining = await syncProjects();
      if (remaining.length) {
        loadProject(remaining[0]);
      } else {
        const nextBrief = createInitialBrief('course');
        const created = await localProjectRepository.create('未命名报道项目', nextBrief);
        setProjects([created]);
        loadProject(created);
      }
      setProjectNotice('项目已从当前浏览器删除。');
    } catch (projectError) {
      setProjectNotice(projectError instanceof Error ? projectError.message : '删除项目失败。');
    }
  };

  const deleteAllProjects = async () => {
    try {
      await localProjectRepository.deleteAll();
      const nextBrief = createInitialBrief('course');
      const created = await localProjectRepository.create('未命名报道项目', nextBrief);
      setProjects([created]);
      loadProject(created);
      setProjectNotice('全部本机项目数据已删除；当前是新的空白项目。');
    } catch (projectError) {
      setProjectNotice(projectError instanceof Error ? projectError.message : '清空本机项目失败。');
    }
  };

  const exportProjects = async () => {
    try {
      await persistCurrentProject();
      const serialized = await localProjectRepository.exportAll();
      const blob = new Blob([serialized], { type: 'application/json;charset=utf-8' });
      const url = URL.createObjectURL(blob);
      const anchor = document.createElement('a');
      anchor.href = url;
      anchor.download = `NewsPilot-本地项目备份-${new Date().toISOString().slice(0, 10)}.json`;
      anchor.click();
      URL.revokeObjectURL(url);
      setProjectNotice('本地项目备份已导出。');
    } catch (projectError) {
      setProjectNotice(projectError instanceof Error ? projectError.message : '导出项目失败。');
    }
  };

  const importProjects = async (file: File) => {
    try {
      await persistCurrentProject();
      const existingIds = new Set(projects.map(({ id }) => id));
      const count = await localProjectRepository.importAll(await file.text());
      const imported = await syncProjects();
      const importedProject = selectProjectAfterImport(imported, existingIds);
      if (importedProject) loadProject(importedProject);
      setProjectNotice(`已校验并导入 ${count} 个项目。`);
    } catch (projectError) {
      setProjectNotice(projectError instanceof Error ? projectError.message : '项目文件导入失败。');
    }
  };

  const changeMode = (mode: ReportingMode) => {
    if (mode === brief.mode) return;
    const nextBrief = createInitialBrief(mode);
    nextBrief.rawTopic = brief.rawTopic;
    setBrief(nextBrief);
    setPlan(null);
    setEvidenceWorkspace(createEmptyEvidenceWorkspace());
    setExecutionWorkspace(createEmptyExecutionWorkspace());
    setStep(1);
    setError('');
    setGenerationError('');
  };

  const handleBriefChange = (nextBrief: ReportingBrief) => {
    setBrief(nextBrief);
    if (nextBrief.rawTopic.trim()) setError('');
    setGenerationError('');
  };

  const handleExampleSelect = (topic: string) => {
    handleBriefChange({ ...brief, rawTopic: topic });
    document.querySelector<HTMLTextAreaElement>('#raw-topic')?.focus();
  };

  const generate = async () => {
    if (generationInFlightRef.current) return;
    if (!brief.rawTopic.trim()) {
      setError('先写下一个具体新闻线索或作业主题。');
      document.querySelector<HTMLTextAreaElement>('#raw-topic')?.focus();
      return;
    }
    setError('');
    setGenerationError('');
    generationInFlightRef.current = true;
    setIsLoading(true);
    try {
      const submittedBrief = {
        ...brief,
        rawTopic: brief.rawTopic.trim(),
      };
      const nextPlan = await generateStudentReportingPlan(submittedBrief, generationMode);
      setEvidenceWorkspace((current) => {
        if (current.claims.length && current.searchPlan) return current;
        const claims = createClaimsFromBrief(submittedBrief);
        return {
          ...current,
          claims,
          searchPlan: createSearchPlan(currentProjectId || 'local', submittedBrief, claims),
          updatedAt: new Date().toISOString(),
        };
      });
      setBrief(submittedBrief);
      setPlan(nextPlan);
      setExecutionWorkspace(createExecutionWorkspaceFromPlan(nextPlan));
      setSelectedAngleId(nextPlan.recommendedAngleId);
      setStep(2);
      if (researchModeEnabled) {
        void recordLocalProductEvent(
          depth === 'quick' ? 'quick_plan_viewed' : 'full_plan_opened',
          'planning-results',
          {
            reportingMode: submittedBrief.mode,
            verdict: nextPlan.verdict.status,
            candidateAngleCount: nextPlan.candidateAngles.length,
          },
        );
      }
      globalThis.requestAnimationFrame(() => {
        planningResultsRef.current?.scrollIntoView({
          behavior: 'smooth',
          block: 'start',
        });
        document.querySelector<HTMLTextAreaElement>('#raw-topic')?.focus({
          preventScroll: true,
        });
      });
    } catch {
      setGenerationError('策划生成失败，请稍后重试；你填写的内容仍保留在本页。');
      if (researchModeEnabled) void recordLocalProductEvent('error_shown', 'planning-form', { kind: 'generation_failed' });
    } finally {
      generationInFlightRef.current = false;
      setIsLoading(false);
    }
  };

  const changeStep = (nextStep: WorkflowStep) => {
    if (nextStep > 1 && !plan) return;
    if (nextStep > 2 && depth === 'quick') setDepth('full');
    setStep(nextStep);
    if (researchModeEnabled && nextStep === 3) {
      void recordLocalProductEvent('strategy_selected', 'planning-results', {
        hasSelectedAngle: Boolean(selectedAngleId),
      });
    }
    if (researchModeEnabled && nextStep === 4) {
      void recordLocalProductEvent('full_plan_opened', 'execution-workbench');
    }
  };

  return (
    <div className="np-shell" id="top">
      <Header reportingMode={brief.mode} />

      <main>
        <section className="np-hero" aria-labelledby="page-title">
          <div className="np-hero__copy">
            <span className="kicker">FROM TOPIC TO REPORTING PLAN</span>
            <h1 id="page-title">帮你把选题，变成一份真正能完成的采访计划。</h1>
            <p>面向新闻专业学生与校园媒体。先判断值不值得做，再找到角度、信源、问题与证据路径。</p>
            <a href="#workbench">开始策划<ArrowDown weight="bold" /></a>
          </div>
          <div className="np-hero__method" aria-label="NewsPilot 工作方法">
            <span className="method-card method-card--one"><CompassTool weight="duotone" /><b>拆题</b><small>从作业主题到新闻问题</small></span>
            <span className="method-card method-card--two"><Quotes weight="duotone" /><b>采访</b><small>从信源角色到问题阶梯</small></span>
            <span className="method-card method-card--three"><FileMagnifyingGlass weight="duotone" /><b>核查</b><small>从关键说法到证据矩阵</small></span>
            <div className="hero-stamp"><CheckCircle weight="fill" /><span>METHOD<br />BEFORE<br />MODEL</span></div>
          </div>
        </section>

        <LocalProjectBar
          projects={projects}
          currentProjectId={currentProjectId}
          autosaveStatus={autosaveStatus}
          notice={projectNotice}
          onOpen={(id) => void (async () => {
            try {
              await persistCurrentProject();
              const freshProjects = await syncProjects();
              const project = freshProjects.find((item) => item.id === id);
              if (project) loadProject(project);
            } catch (projectError) {
              setProjectNotice(
                projectError instanceof Error ? projectError.message : '切换项目前保存失败。',
              );
            }
          })()}
          onCreate={() => void createProject()}
          onRename={(name) => void renameProject(name)}
          onDuplicate={() => void duplicateProject()}
          onDelete={() => void deleteProject()}
          onDeleteAll={() => void deleteAllProjects()}
          onExport={() => void exportProjects()}
          onImport={(file) => void importProjects(file)}
        />

        <section className="workbench" id="workbench">
          <WorkflowNavigation current={step} hasPlan={Boolean(plan)} onChange={changeStep} />

          <div className="workbench__body" ref={resultsRef}>
            {step === 1 || !plan ? (
              <ReportingBriefForm
                value={brief}
                depth={depth}
                error={error}
                generationError={generationError}
                isLoading={isLoading}
                onChange={handleBriefChange}
                onModeChange={changeMode}
                onDepthChange={setDepth}
                onSubmit={() => void generate()}
                onExampleSelect={handleExampleSelect}
              />
            ) : step === 4 && depth === 'full' ? (
              <Suspense fallback={<div className="execution-loading" role="status">正在载入执行工作台…</div>}>
                <ReportingExecutionWorkbench
                  projectName={currentProjectRef.current?.name || '未命名报道项目'}
                  brief={brief}
                  plan={plan}
                  evidenceWorkspace={evidenceWorkspace}
                  value={executionWorkspace}
                  onChange={setExecutionWorkspace}
                  onEvidenceChange={setEvidenceWorkspace}
                  evidencePanel={(
                    <Suspense fallback={<div className="execution-loading" role="status">正在载入证据工作台…</div>}>
                      <EvidenceWorkbench
                        projectId={currentProjectId || 'local'}
                        projectName={currentProjectRef.current?.name || '未命名报道项目'}
                        brief={brief}
                        value={evidenceWorkspace}
                        demoMode={evidenceDemoMode}
                        onChange={setEvidenceWorkspace}
                      />
                    </Suspense>
                  )}
                />
              </Suspense>
            ) : (
              <div className="planning-result-stage" ref={planningResultsRef}>
                <section className="planning-result-composer" aria-label="继续调整新闻线索">
                  <NewsLeadComposer
                    value={brief.rawTopic}
                    onChange={(rawTopic) => handleBriefChange({ ...brief, rawTopic })}
                    onSubmit={() => void generate()}
                    loading={isLoading}
                    error={error || generationError}
                  />
                </section>
                <StudentReportingResults
                  plan={plan}
                  evidenceWorkspace={evidenceWorkspace}
                  step={step}
                  depth={depth}
                  selectedAngleId={selectedAngleId}
                  onSelectedAngleChange={setSelectedAngleId}
                  onStepChange={changeStep}
                  onDepthChange={setDepth}
                />
              </div>
            )}
          </div>
        </section>

        <aside className="principle-strip" aria-label="产品边界">
          <b>NewsPilot 不替你采访，也不替你编造。</b>
          <span>它把新闻生产方法转成可执行检查：已知 / 假设 / 未知、信源角色、证据状态与提交前自查。</span>
        </aside>

        {showResearchTools ? (
          <ManualBlindReviewTool
            newsPilotOutput={plan ? buildStudentPlanMarkdown(plan) : ''}
          />
        ) : null}

        {researchModeEnabled ? (
          <Suspense fallback={<div className="execution-loading" role="status">正在载入本地研究工具…</div>}>
            <ResearchAnalysisPanel />
          </Suspense>
        ) : null}

        <DeveloperSettings
          generationMode={generationMode}
          providerStatus={providerStatus}
          providerPresentation={providerPresentation}
          onGenerationModeChange={(mode) => {
            if (mode === 'local-ai' && providerPresentation.optionDisabled) return;
            setGenerationMode(mode);
            setGenerationError('');
          }}
        />
      </main>

      <footer className="np-footer">
        <div><b>NewsPilot</b><span>v1.1 Beta · 采访执行与课程提交工作流</span></div>
        <p>当前版本仍在进行真实用户测试。NewsPilot 不替代真实采访、编辑判断和事实核查。</p>
        <p>生成内容只作策划辅助。事实、数字、身份与引语必须由记者独立核实。</p>
      </footer>
    </div>
  );
}
