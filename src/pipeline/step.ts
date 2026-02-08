import type { PipelineConfig } from "../config/config.types.js";
import type { Logger } from "../services/logger.js";
import type { ProgressReporter } from "../services/progress.js";

export interface StepContext {
  config: PipelineConfig;
  baseDir?: string;
  outputDir: string;
  dryRun?: boolean;
  logger: Logger;
  progress: ProgressReporter;
}

export interface Step {
  readonly name: string;
  runAsync(ctx: StepContext): Promise<void>;
}
