import type { PipelineConfig, StepAiConfig } from "../../../config/config.types.js";
import type { AiGenerateOptions } from "../ai.types.js";
import { AI_PROFILE_PRESETS } from "../../../config/profilePresets.js";
import { getStepPromptOverride } from "../aiServiceFactory.js";

export function resolveOllamaConfig(
  config: PipelineConfig,
  step: "cleaning" | "handout" | "summary",
  stepConfig: StepAiConfig,
): Omit<AiGenerateOptions, "userPrompt"> {
  if (stepConfig.provider !== "ollama") {
    throw new Error("AI provider is not Ollama");
  }

  const preset = AI_PROFILE_PRESETS[config.profile]?.[step];

  if (!preset) {
    throw new Error(
      `No preset for profile '${config.profile}', step '${step}'. This step may not be supported for this profile.`,
    );
  }

  const overrides = stepConfig.overrides ?? {};
  const promptOverride = getStepPromptOverride(config, step);
  const basePrompt = promptOverride ?? preset.systemPrompt ?? "";

  // Enhance system prompt with language.output instruction
  const outputLanguage = config.language?.output ?? "English";
  const languageInstruction = `\n\nIMPORTANT: All output must be in ${outputLanguage}. Write all content, including headings, annotations, and any text, exclusively in ${outputLanguage}.`;
  const enhancedSystemPrompt = basePrompt + languageInstruction;

  return {
    ...preset,
    systemPrompt: enhancedSystemPrompt,
    ...overrides,
  };
}
