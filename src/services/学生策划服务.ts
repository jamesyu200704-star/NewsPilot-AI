import type { ReportingBrief, StudentReportingPlan } from '../../shared/学生报道模型.js';
import {
  createStudentReportingPlan,
  createStudentReportingPlanWithGeneration,
  reportingBriefToLegacyInput,
} from '../../shared/学生报道工作流.js';
import { generateBrief, type ClientGenerationMode } from './generator';

const wait = (milliseconds: number) =>
  new Promise<void>((resolve) => globalThis.setTimeout(resolve, milliseconds));

export async function generateStudentReportingPlan(
  brief: ReportingBrief,
  mode: ClientGenerationMode,
): Promise<StudentReportingPlan> {
  if (mode === 'mock') {
    await wait(480);
    return createStudentReportingPlan(brief);
  }

  const generation = await generateBrief(reportingBriefToLegacyInput(brief), mode);
  return createStudentReportingPlanWithGeneration(brief, generation);
}
