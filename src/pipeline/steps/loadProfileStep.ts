import type { Step, StepContext } from "../step.js";

export class LoadProfileStep implements Step {
  readonly name = "load-profile";

  async runAsync(ctx: StepContext): Promise<void> {
    const { config, logger } = ctx;

    const profile = config.profile ?? undefined;
    if (profile === undefined) {
      throw new Error("Profile is not set");
    }
    logger.debug(`Active profile: ${profile}`);

    if (!config.profiles?.[profile]) {
      throw new Error(`Profile not found in config: ${profile}`);
    }

    logger.info(`Profile '${config.profile}' loaded`);
  }
}
