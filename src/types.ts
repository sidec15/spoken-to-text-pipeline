/**
 * Public types exported by the spoken-to-text-pipeline library.
 */

import type { PipelineConfig } from "./config/config.types.js";
import type { Logger } from "./services/logger.js";
import type { ProgressReporter } from "./services/progress.js";

export type {
  PipelineConfig,
  SupportedProfile,
  SupportedAiProvider,
  SupportedAsrProvider,
  AiProviderPool,
  StepAiConfig,
  AiConfig,
} from "./config/config.types.js";

export type { Logger, LoggerContext } from "./services/logger.js";
export type { ProgressReporter } from "./services/progress.js";

/**
 * Options for running the pipeline programmatically.
 */
export interface PipelineOptions {
  /** Pipeline configuration */
  config: PipelineConfig;
  /** Optional base directory for resolving relative paths. If not provided, paths are resolved relative to the config file directory (config.configDir), or process.cwd() if config was not loaded from a file. */
  baseDir?: string;
  /** If true, run in dry-run mode (validate config and show plan without executing) */
  dryRun?: boolean;
  /** Optional logger instance. If not provided, a default logger will be created. */
  logger?: Logger;
  /** Optional progress reporter. If not provided, a no-op reporter will be used. */
  progress?: ProgressReporter;
}

/**
 * Result of running the pipeline.
 */
export interface PipelineResult {
  /** Whether the pipeline completed successfully */
  success: boolean;
  /** Error message if the pipeline failed */
  error?: string;
}
