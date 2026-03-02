import type { PipelineConfig, StepAiConfig } from "../../../config/config.types.js";
import type { AiGenerateOptions, HandoutAiGenerateOptions } from "../ai.types.js";
import { AI_PROFILE_PRESETS } from "../../../config/profilePresets.js";
import { getStepPromptOverride } from "../aiServiceFactory.js";

export function resolveDeepSeekConfig(
  config: PipelineConfig,
  step: "cleaning" | "handout" | "summary",
  stepConfig: StepAiConfig,
): Omit<AiGenerateOptions, "userPrompt"> | Omit<HandoutAiGenerateOptions, "userPrompt"> {
  if (stepConfig.provider !== "deepseek") {
    throw new Error("AI provider is not DeepSeek");
  }

  const preset = AI_PROFILE_PRESETS[config.profile]?.[step];

  if (!preset) {
    throw new Error(
      `No preset for profile '${config.profile}', step '${step}'. This step may not be supported for this profile.`,
    );
  }

  const overrides = stepConfig.overrides ?? {};
  const outputLanguage = config.language?.output ?? "English";
  const languageInstruction = `\n\nIMPORTANT: All output must be in ${outputLanguage}. Write all content, including headings, annotations, and any text, exclusively in ${outputLanguage}.`;

  if (step === "handout") {
    const handoutPreset = preset as unknown as {
      systemPrompt: { singlePass: string; incremental: string };
      temperature?: number;
    };
    const singlePassOverride = getStepPromptOverride(config, "handout", "single-pass");
    const incrementalOverride = getStepPromptOverride(config, "handout", "incremental");
    const singlePass =
      (singlePassOverride ?? handoutPreset.systemPrompt?.singlePass ?? "") + languageInstruction;
    const incremental =
      (incrementalOverride ?? handoutPreset.systemPrompt?.incremental ?? "") + languageInstruction;

    return {
      ...preset,
      systemPrompt: { singlePass, incremental },
      ...overrides,
    } as Omit<HandoutAiGenerateOptions, "userPrompt">;
  }

  const promptOverride = getStepPromptOverride(config, step);
  const basePrompt = promptOverride ?? (preset.systemPrompt as string) ?? "";
  const enhancedSystemPrompt = basePrompt + languageInstruction;

  return {
    ...preset,
    systemPrompt: enhancedSystemPrompt,
    ...overrides,
  };
}
