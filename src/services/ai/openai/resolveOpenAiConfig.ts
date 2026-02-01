import type { PipelineConfig, StepAiConfig } from "../../../config/config.types.js";
import type { AiGenerateOptions } from "../ai.types.js";
import { AI_PROFILE_PRESETS } from "../../../config/profilePresets.js";

export function resolveOpenAiConfig(
  config: PipelineConfig,
  step: "cleaning" | "handout" | "summary",
  stepConfig: StepAiConfig,
): Omit<AiGenerateOptions, "userPrompt"> {
  if (stepConfig.provider !== "openai") {
    throw new Error("AI provider is not OpenAI");
  }

  const preset = AI_PROFILE_PRESETS[config.profile]?.[step];

  if (!preset) {
    throw new Error(
      `No preset for profile '${config.profile}', step '${step}'. This step may not be supported for this profile.`,
    );
  }

  const overrides = stepConfig.overrides ?? {};

  // Enhance system prompt with language.output instruction
  const languageInstruction = `\n\nIMPORTANT: All output must be in ${config.language.output}. Write all content, including headings, annotations, and any text, exclusively in ${config.language.output}.`;
  const enhancedSystemPrompt = (preset.systemPrompt ?? "") + languageInstruction;

  return {
    ...preset,
    systemPrompt: enhancedSystemPrompt,
    ...overrides,
  };
}
