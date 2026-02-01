import type { PipelineConfig } from "../../config/config.types.js";
import type { AiService, AiGenerateOptions } from "./ai.types.js";
import { OpenAiService } from "./openai/openaiAiService.js";
import { DeepSeekAiService } from "./deepseek/deepseekAiService.js";
import { resolveOpenAiConfig } from "./openai/resolveOpenAiConfig.js";
import { resolveDeepSeekConfig } from "./deepseek/resolveDeepSeekConfig.js";

export type AiStepName = "cleaning" | "handout" | "summary";

/**
 * Creates an AI service instance based on the provider configuration.
 */
export function createAiService(config: PipelineConfig): AiService {
  if (config.ai.provider === "openai" && "openai" in config.ai.config) {
    return new OpenAiService(config.ai.config.openai.apiKey, config.ai.config.openai.model);
  }

  if (config.ai.provider === "deepseek" && "deepseek" in config.ai.config) {
    return new DeepSeekAiService(config.ai.config.deepseek.apiKey, config.ai.config.deepseek.model);
  }

  throw new Error(`Unsupported AI provider: ${config.ai.provider}`);
}

/**
 * Resolves AI configuration options for a specific step.
 */
export function resolveAiConfig(
  config: PipelineConfig,
  step: AiStepName,
): Omit<AiGenerateOptions, "userPrompt"> {
  if (config.ai.provider === "openai") {
    return resolveOpenAiConfig(config, step);
  }

  if (config.ai.provider === "deepseek") {
    return resolveDeepSeekConfig(config, step);
  }

  throw new Error(`Unsupported AI provider: ${config.ai.provider}`);
}
