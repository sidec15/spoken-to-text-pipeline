import type { Step, StepContext } from "./step.js";

export class PipelineRunner {
  private readonly steps: Step[];

  constructor(steps: Step[]) {
    this.steps = steps;
  }

  async run(ctx: StepContext): Promise<void> {
    for (const step of this.steps) {
      const stepLogger = ctx.logger.withContext({ step: step.name });

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
