import type { Step, StepContext } from "../step.js";
import type { SupportedProfile } from "../../config/config.types.js";

export class LoadProfileStep implements Step {
  readonly name = "load-profile";

  async runAsync(ctx: StepContext): Promise<void> {
    const { config, logger } = ctx;

    const profile = config.profile ?? undefined;
    if (profile === undefined) {
      throw new Error("Profile is not set");
    }
    logger.debug(`Active profile: ${profile}`);

    // Validate that the profile is one of the supported profiles
    const validProfiles: SupportedProfile[] = ["lecture", "meeting", "other"];
    if (!validProfiles.includes(profile as SupportedProfile)) {
      throw new Error(`Invalid profile: ${profile} (must be one of: ${validProfiles.join(", ")})`);
    }

    logger.info(`Profile '${config.profile}' loaded`);
  }
}
