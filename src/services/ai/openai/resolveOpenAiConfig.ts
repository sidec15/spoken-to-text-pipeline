import type { PipelineConfig } from "../../../config/config.types.js";
import { OPENAI_PROFILE_PRESETS } from "./openai.presets.js";

export function resolveOpenAiConfig(config: PipelineConfig, step: "cleaning" | "handout" | "summary") {
  if (config.ai.provider !== "openai") {
    throw new Error("AI provider is not OpenAI");
  }

  const preset = OPENAI_PROFILE_PRESETS[config.profile]?.[step];

  if (!preset) {
    throw new Error(
      `No OpenAI preset for profile '${config.profile}', step '${step}'. This step may not be supported for this profile.`,
    );
  }

  const overrides =
    "openai" in config.ai.config ? config.ai.config.openai.overrides ?? {} : {};

  return {
    ...preset,
    ...overrides,
  };
}
