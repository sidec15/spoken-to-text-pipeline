import type { PipelineConfig, StepAiConfig } from "../../../config/config.types.js";
import type { AiGenerateOptions, HandoutAiGenerateOptions } from "../ai.types.js";
import { AI_PROFILE_PRESETS } from "../../../config/profilePresets.js";
import { getStepPromptOverride } from "../aiServiceFactory.js";

export function resolveOllamaConfig(
  config: PipelineConfig,
  step: "cleaning" | "handout" | "summary",
  stepConfig: StepAiConfig,
): Omit<AiGenerateOptions, "userPrompt"> | Omit<HandoutAiGenerateOptions, "userPrompt"> {
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
  const langCode = (config.language?.output ?? "en").trim().toLowerCase();
  const languageInstruction = `\n\nIMPORTANT: Output language is specified by ISO 639-1 two-letter code "${langCode}". All output must be written in that language. Write all content, including headings, annotations, and any text, exclusively in the language identified by code "${langCode}".`;

  if (step === "handout") {
    const handoutPreset = preset as unknown as { systemPrompt: string; temperature?: number };
    const promptOverride = getStepPromptOverride(config, "handout");
    const basePrompt = promptOverride ?? handoutPreset.systemPrompt ?? "";
    const enhancedSystemPrompt = basePrompt + languageInstruction;

    return {
      ...preset,
      systemPrompt: enhancedSystemPrompt,
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
