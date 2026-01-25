import path from "node:path";
import type { PipelineConfig } from "../config/config.types.js";

/**
 * Resolves the output directory path, optionally adding a timestamp suffix.
 * Returns the resolved absolute path (directory creation is handled by steps).
 */
export function resolveOutputDir(config: PipelineConfig): string {
  let outputDir = config.paths.outputDir;

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

  return path.resolve(process.cwd(), outputDir);
}
