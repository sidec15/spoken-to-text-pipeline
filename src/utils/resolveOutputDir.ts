import path from "node:path";
import type { PipelineConfig } from "../config/config.types.js";

/**
 * Resolves the output directory path, optionally adding a timestamp suffix.
 * Returns the resolved absolute path (directory creation is handled by steps).
 * Paths are resolved relative to baseDir if provided, otherwise relative to process.cwd().
 */
export function resolveOutputDir(config: PipelineConfig, baseDir?: string): string {
  let outputDir = config.paths?.outputDir ?? "./output";

  // Add timestamp suffix if requested
  if (config.output?.addTimestamp) {
    const timestamp = new Date()
      .toISOString()
      .replace(/[-:]/g, "")
      .replace(/\..+/, "")
      .replace("T", "");
    // Add timestamp as suffix: outputDir_20250125143000
    outputDir = `${outputDir}_${timestamp}`;
  }

  // Resolve relative to baseDir if provided, otherwise relative to process.cwd()
  const resolvedBaseDir = baseDir ?? process.cwd();
  return path.isAbsolute(outputDir) ? outputDir : path.resolve(resolvedBaseDir, outputDir);
}
