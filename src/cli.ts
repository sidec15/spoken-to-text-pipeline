#!/usr/bin/env node

import { runPipeline } from "./pipeline/runPipeline.js";
import { parseArgs, loadPipelineConfig } from "./cli/args.js";
import { CliProgressReporter } from "./services/cliProgressReporter.js";

async function main(): Promise<void> {
  try {
    const args = parseArgs(process.argv.slice(2));
    const config = loadPipelineConfig(args.configPath, args.baseDir);

    const result = await runPipeline({
      config,
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
