/**
 * Public API for the spoken-to-text-pipeline library.
 *
 * This module exports the core functionality for programmatic use.
 * For CLI usage, see the CLI entrypoint.
 */

export { runPipeline } from "./pipeline/runPipeline.js";
export type {
  PipelineOptions,
  PipelineResult,
  PipelineConfig,
  SupportedProfile,
  SupportedAiProvider,
  SupportedAsrProvider,
  AiProviderPool,
  StepAiConfig,
  AiConfig,
  Logger,
  LoggerContext,
  ProgressReporter,
} from "./types.js";
