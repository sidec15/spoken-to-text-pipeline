#!/usr/bin/env node

import { loadConfig } from "./config/loadConfig.js";
import { createLogger } from "./services/logger.js";
import { PipelineRunner } from "./pipeline/pipelineRunner.js";
import { LoadProfileStep } from "./pipeline/steps/loadProfileStep.js";
import { CliProgressReporter } from "./services/cliProgressReporter.js";
import { AsrStep } from "./pipeline/steps/asrStep.js";

async function main(): Promise<void> {
  const config = loadConfig("pipeline.config.json");

  const logger = createLogger(config.logging.level, config.logging.singleLine, {
    profile: config.profile,
  });

  logger.info("Starting pipeline");

  const runner = new PipelineRunner([
    new LoadProfileStep(),
    new AsrStep(),
    // next steps will go here
  ]);

  await runner.run({ config, logger, progress: new CliProgressReporter() });

  logger.info("Pipeline completed successfully");
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
