import type { PipelineOptions, PipelineResult } from "../types.js";
import { createLogger } from "../services/logger.js";
import { PipelineRunner } from "./pipelineRunner.js";
import { LoadProfileStep } from "./steps/loadProfileStep.js";
import { AsrStep } from "./steps/asrStep.js";
import { CleaningStep } from "./steps/cleaningStep.js";
import { HandoutStep } from "./steps/handoutStep.js";
import { SummaryStep } from "./steps/summaryStep.js";
import type { ProgressReporter } from "../services/progress.js";
import { resolveOutputDir } from "../utils/resolveOutputDir.js";

/**
 * No-op progress reporter for programmatic usage when no progress reporter is provided.
 */
class NoOpProgressReporter implements ProgressReporter {
  start(): void {
    // No-op
  }
  increment(): void {
    // No-op
  }
  updateMessage(): void {
    // No-op
  }
  stop(): void {
    // No-op
  }
}

/**
 * Runs the spoken-to-text pipeline with the provided options.
 *
 * @param options - Pipeline options including config, logger, and progress reporter
 * @returns Promise that resolves when the pipeline completes successfully
 * @throws Error if the pipeline fails
 */
export async function runPipeline(options: PipelineOptions): Promise<PipelineResult> {
  const { config, baseDir, dryRun, logger: providedLogger, progress: providedProgress } = options;

  // Resolve all paths relative to: CLI baseDir if set, otherwise config file directory, otherwise cwd
  const effectiveBaseDir = baseDir ?? config.configDir ?? process.cwd();

  // Create logger if not provided
  const logger =
    providedLogger ??
    createLogger({
      level: config?.logging?.level ?? "info",
      singleLine: config?.logging?.singleLine ?? false,
      baseContext: {
        profile: config.profile,
      },
    });

  // Create no-op progress reporter if not provided
  const progress: ProgressReporter = providedProgress ?? new NoOpProgressReporter();

  if (dryRun) {
    logger.info("Running in DRY-RUN mode - no files will be modified or API calls made");
  }

  logger.info("Starting pipeline");

  // Add log for pipeline plan before running. Check for the enabled steps and list them with input/output paths.
  if (config.paths) {
    logger.info("Pipeline plan:");
    logger.info("> LoadProfileStep");
    logger.debug(`>> Input: ${config.paths.inputDir}`);
    logger.debug(`>> Output: ${config.paths.outputDir}`);
    logger.info("> AsrStep");
    logger.debug(`>> Input: ${config.paths.inputDir}`);
    logger.debug(`>> Output: ${config.paths.outputDir}`);
    logger.info("> CleaningStep");
    logger.debug(`>> Input: ${config.paths.inputDir}`);
    logger.debug(`>> Output: ${config.paths.outputDir}`);
    logger.info("> HandoutStep");
    logger.debug(`>> Input: ${config.paths.inputDir}`);
    logger.debug(`>> Output: ${config.paths.outputDir}`);
    logger.info("> SummaryStep");
    logger.debug(`>> Input: ${config.paths.inputDir}`);
    logger.debug(`>> Output: ${config.paths.outputDir}`);
  } else {
    logger.warn("No paths configured");
  }

  if (dryRun) {
    logger.info("Dry-run completed - configuration validated successfully");
    return { success: true };
  }

  // Resolve output directory once so all steps use the same path (important for timestamp suffix)
  const outputDir = resolveOutputDir(config, effectiveBaseDir);

  const runner = new PipelineRunner([
    new LoadProfileStep(),
    new AsrStep(),
    new CleaningStep(),
    new HandoutStep(),
    new SummaryStep(),
  ]);

  try {
    await runner.run({ config, baseDir: effectiveBaseDir, outputDir, dryRun, logger, progress });
    logger.info("Pipeline completed successfully");
    return { success: true };
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : String(error);
    logger.error("Pipeline failed", error);
    return {
      success: false,
      error: errorMessage,
    };
  }
}
