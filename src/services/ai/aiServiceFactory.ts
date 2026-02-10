import type { PipelineConfig, StepAiConfig } from "../../config/config.types.js";
import type { AiService, AiGenerateOptions } from "./ai.types.js";
import { OpenAiService } from "./openai/openaiAiService.js";
import { DeepSeekAiService } from "./deepseek/deepseekAiService.js";
import { OllamaAiService } from "./ollama/ollamaAiService.js";
import { resolveOpenAiConfig } from "./openai/resolveOpenAiConfig.js";
import { resolveDeepSeekConfig } from "./deepseek/resolveDeepSeekConfig.js";
import { resolveOllamaConfig } from "./ollama/resolveOllamaConfig.js";

export type AiStepName = "cleaning" | "handout" | "summary";

/** All pipeline step names (ASR + AI steps). */
export type StepName = "asr" | AiStepName;

/**
 * Checks if a step is enabled.
 * Steps are enabled by default unless explicitly disabled via config.
 */
export function isStepEnabled(config: PipelineConfig, step: StepName): boolean {
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
 * Gets the API key for a provider from the provider pool or environment.
 * Environment variables: SPOKEN_TO_TEXT_OPENAI_API_KEY, SPOKEN_TO_TEXT_DEEPSEEK_API_KEY
 */
function getApiKey(config: PipelineConfig, provider: string): string {
  if (provider === "openai") {
    const fromConfig = (config.ai?.providers?.openai?.apiKey ?? "").trim();
    const apiKey = fromConfig || (process.env.SPOKEN_TO_TEXT_OPENAI_API_KEY ?? "").trim();
    if (!apiKey) {
      throw new Error(`OpenAI provider not configured in provider pool`);
    }
    return apiKey;
  }

  if (provider === "deepseek") {
    const fromConfig = (config.ai?.providers?.deepseek?.apiKey ?? "").trim();
    const apiKey = fromConfig || (process.env.SPOKEN_TO_TEXT_DEEPSEEK_API_KEY ?? "").trim();
    if (!apiKey) {
      throw new Error(`DeepSeek provider not configured in provider pool`);
    }
    return apiKey;
  }

  if (provider === "ollama") {
    // Ollama does not require an API key, but provider must be configured.
    if (!config.ai?.providers?.ollama) {
      throw new Error(`Ollama provider not configured in provider pool`);
    }
    // Return a dummy value since Ollama doesn't use API keys.
    return "ollama";
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

  if (stepConfig.provider === "ollama") {
    const baseUrl = config.ai?.providers?.ollama?.baseUrl;
    return new OllamaAiService(stepConfig.model, baseUrl);
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

  if (stepConfig.provider === "ollama") {
    return resolveOllamaConfig(config, step, stepConfig);
  }

  throw new Error(`Unsupported AI provider: ${stepConfig.provider}`);
}
