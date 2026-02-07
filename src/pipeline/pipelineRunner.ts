import type { Step, StepContext } from "./step.js";
import { isStepEnabled, type AiStepName } from "../services/ai/aiServiceFactory.js";

export class PipelineRunner {
  private readonly steps: Step[];

  constructor(steps: Step[]) {
    this.steps = steps;
  }

  async run(ctx: StepContext): Promise<void> {
    for (const step of this.steps) {
      const stepLogger = ctx.logger.withContext({ step: step.name });

      // Check if this is an AI step and if it's disabled
      const aiStepNames: AiStepName[] = ["cleaning", "handout", "summary"];
      if (aiStepNames.includes(step.name as AiStepName)) {
        if (!isStepEnabled(ctx.config, step.name as AiStepName)) {
          stepLogger.info(`Step disabled via configuration, skipping`);
          continue;
        }
      }

      stepLogger.info("Step started");

      try {
        await step.runAsync({ ...ctx, logger: stepLogger });
        stepLogger.info("Step completed");
      } catch (err) {
        stepLogger.error("Step failed", err);
        throw err; // fail fast
      }
    }
  }
}
