import type {
  EditorialTaskRequest,
  EditorialTaskResult,
} from '../../shared/编辑任务模型.js';

export interface EditorialTaskProvider {
  runEditorialTask(input: EditorialTaskRequest): Promise<EditorialTaskResult>;
}
