#!/usr/bin/env node

import path from "node:path";
import { runPipeline } from "./pipeline/runPipeline.js";
import { parseArgs, loadPipelineConfig } from "./cli/args.js";
import { CliProgressReporter } from "./services/cliProgressReporter.js";

async function main(): Promise<void> {
  try {
    const args = parseArgs(process.argv.slice(2));
    const config = loadPipelineConfig(args.configPath, args.baseDir);

    // Resolve baseDir to absolute path if provided
    const resolvedBaseDir = args.baseDir
      ? (path.isAbsolute(args.baseDir) ? args.baseDir : path.resolve(process.cwd(), args.baseDir))
      : undefined;

    const result = await runPipeline({
      config,
      baseDir: resolvedBaseDir,
      dryRun: args.dryRun,
      progress: new CliProgressReporter(),
    });

    if (!result.success) {
      console.error(result.error ?? "Pipeline failed");
      process.exit(1);
    }
  } catch (error) {
    console.error(error instanceof Error ? error.message : String(error));
    process.exit(1);
  }
}

main();
