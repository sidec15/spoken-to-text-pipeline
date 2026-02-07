import type { PipelineConfig, StepAiConfig } from "../../config/config.types.js";
import type { AiService, AiGenerateOptions } from "./ai.types.js";
import { OpenAiService } from "./openai/openaiAiService.js";
import { DeepSeekAiService } from "./deepseek/deepseekAiService.js";
import { resolveOpenAiConfig } from "./openai/resolveOpenAiConfig.js";
import { resolveDeepSeekConfig } from "./deepseek/resolveDeepSeekConfig.js";

export type AiStepName = "cleaning" | "handout" | "summary";

/**
 * Checks if a step is enabled.
 * Steps are enabled by default unless explicitly disabled via config.
 */
export function isStepEnabled(config: PipelineConfig, step: AiStepName): boolean {
  const stepConfig = config.steps?.[step];
  // Default to true if not specified
  return stepConfig?.enabled !== false;
}

/**
 * Resolves the provider, model, and overrides for a specific step.
 * Merges default configuration with step-specific overrides.
 */
export function resolveStepConfig(
  config: PipelineConfig,
  step: AiStepName,
): StepAiConfig {
  // Safely access config.ai and set defaults if missing
  const defaultConfig: StepAiConfig = config.ai?.default ?? {
    provider: "openai",
    model: "gpt-5-mini",
  };
  const stepOverride = config.steps?.[step]?.aiConfig;

  // Merge default with step override
  const resolved: StepAiConfig = {
    provider: stepOverride?.provider ?? defaultConfig.provider,
    model: stepOverride?.model ?? defaultConfig.model,
    overrides: {
      ...defaultConfig.overrides,
      ...stepOverride?.overrides,
    },
  };

  return resolved;
}

/**
 * Gets the API key for a provider from the provider pool.
 */
function getApiKey(config: PipelineConfig, provider: string): string {
  if (provider === "openai") {
    const apiKey = config.ai?.providers?.openai?.apiKey ?? "";
    if (!apiKey) {
      throw new Error(`OpenAI provider not configured in provider pool`);
    }
    return apiKey;
  }

  if (provider === "deepseek") {
    const apiKey = config.ai?.providers?.deepseek?.apiKey ?? "";
    if (!apiKey) {
      throw new Error(`DeepSeek provider not configured in provider pool`);
    }
    return apiKey;
  }

  throw new Error(`Unsupported provider: ${provider}`);
}

/**
 * Creates an AI service instance for a specific step.
 * Resolves provider/model from step config and gets API key from provider pool.
 */
export function createAiService(config: PipelineConfig, step: AiStepName): AiService {
  const stepConfig = resolveStepConfig(config, step);
  const apiKey = getApiKey(config, stepConfig.provider);

  if (stepConfig.provider === "openai") {
    return new OpenAiService(apiKey, stepConfig.model);
  }

  if (stepConfig.provider === "deepseek") {
    return new DeepSeekAiService(apiKey, stepConfig.model);
  }

  throw new Error(`Unsupported AI provider: ${stepConfig.provider}`);
}

/**
 * Resolves AI configuration options for a specific step.
 * Returns preset-based config merged with step-specific overrides.
 */
export function resolveAiConfig(
  config: PipelineConfig,
  step: AiStepName,
): Omit<AiGenerateOptions, "userPrompt"> {
  const stepConfig = resolveStepConfig(config, step);

  if (stepConfig.provider === "openai") {
    return resolveOpenAiConfig(config, step, stepConfig);
  }

  if (stepConfig.provider === "deepseek") {
    return resolveDeepSeekConfig(config, step, stepConfig);
  }

  throw new Error(`Unsupported AI provider: ${stepConfig.provider}`);
}
