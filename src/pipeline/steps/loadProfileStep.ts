import type { Step, StepContext } from "../step.js";

export class LoadProfileStep implements Step {
  readonly name = "load-profile";

  async runAsync(ctx: StepContext): Promise<void> {
    const { config, logger } = ctx;

    logger.debug(`Active profile: ${config.profile}`);

    if (!config.profiles[config.profile]) {
      throw new Error(`Profile not found in config: ${config.profile}`);
    }

    logger.info(`Profile '${config.profile}' loaded`);
  }
}
