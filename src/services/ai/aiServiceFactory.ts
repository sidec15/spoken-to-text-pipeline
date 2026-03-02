import type {
  PipelineConfig,
  StepAiConfig,
  StepConfig,
  SupportedProfile,
} from "../../config/config.types.js";
import type { AiService, AiGenerateOptions, HandoutAiGenerateOptions } from "./ai.types.js";
import { loadContextText } from "../../utils/loadContextText.js";
import { OpenAiService } from "./openai/openaiAiService.js";
import { DeepSeekAiService } from "./deepseek/deepseekAiService.js";
import { OllamaAiService } from "./ollama/ollamaAiService.js";
import { resolveOpenAiConfig } from "./openai/resolveOpenAiConfig.js";
import { resolveDeepSeekConfig } from "./deepseek/resolveDeepSeekConfig.js";
import { resolveOllamaConfig } from "./ollama/resolveOllamaConfig.js";

export type AiStepName = "cleaning" | "handout" | "summary";

export type HandoutStrategy = "incremental" | "single-pass";

/**
 * Returns the step system prompt override from config if set.
 * For cleaning/summary: steps[step].prompt (inline) > steps[step].promptFile (file content).
 * For handout: steps.handout[strategy].prompt > steps.handout[strategy].promptFile.
 * Otherwise null.
 */
export function getStepPromptOverride(
  config: PipelineConfig,
  step: "cleaning" | "summary",
): string | null;
export function getStepPromptOverride(
  config: PipelineConfig,
  step: "handout",
  strategy: HandoutStrategy,
): string | null;
export function getStepPromptOverride(
  config: PipelineConfig,
  step: AiStepName,
  strategy?: HandoutStrategy,
): string | null {
  if (step === "handout" && strategy) {
    const handoutCfg = config.steps?.handout;
    if (!handoutCfg) return null;
    const override = strategy === "incremental" ? handoutCfg.incremental : handoutCfg.singlePass;
    if (!override) return null;
    const prompt = override.prompt;
    if (typeof prompt === "string" && prompt.trim() !== "") {
      return prompt.trim();
    }
    const promptFile = override.promptFile;
    if (typeof promptFile === "string" && promptFile.trim() !== "") {
      const baseDir = config.configDir ?? process.cwd();
      return loadContextText([promptFile.trim()], baseDir);
    }
    return null;
  }

  if (step === "handout") return null;

  const stepCfg = config.steps?.[step] as StepConfig | undefined;
  if (!stepCfg) return null;
  const prompt = stepCfg.prompt;
  if (typeof prompt === "string" && prompt.trim() !== "") {
    return prompt.trim();
  }
  const promptFile = stepCfg.promptFile;
  if (typeof promptFile === "string" && promptFile.trim() !== "") {
    const baseDir = config.configDir ?? process.cwd();
    return loadContextText([promptFile.trim()], baseDir);
  }
  return null;
}

/** Localized labels for handout/summary header final line by profile and language. */
const LOCALIZED_LABELS: Record<
  string,
  Record<
    SupportedProfile,
    { handout: string; summary: string }
  >
> = {
  it: {
    lecture: { handout: "Dispense della lezione", summary: "Riassunto della lezione" },
    meeting: { handout: "Dispense della riunione", summary: "Riassunto della riunione" },
    other: { handout: "Dispense", summary: "Riassunto" },
  },
  italian: {
    lecture: { handout: "Dispense della lezione", summary: "Riassunto della lezione" },
    meeting: { handout: "Dispense della riunione", summary: "Riassunto della riunione" },
    other: { handout: "Dispense", summary: "Riassunto" },
  },
  en: {
    lecture: { handout: "Lecture Handout", summary: "Lecture Summary" },
    meeting: { handout: "Meeting Handout", summary: "Meeting Summary" },
    other: { handout: "Handout", summary: "Summary" },
  },
  english: {
    lecture: { handout: "Lecture Handout", summary: "Lecture Summary" },
    meeting: { handout: "Meeting Handout", summary: "Meeting Summary" },
    other: { handout: "Handout", summary: "Summary" },
  },
};

function getLocalizedLabel(
  outputLanguage: string,
  profile: SupportedProfile,
  type: "handout" | "summary",
): string {
  const key = (outputLanguage ?? "").toLowerCase().trim();
  const byLang = LOCALIZED_LABELS[key] ?? LOCALIZED_LABELS.en;
  const labels = byLang[profile];
  return labels[type];
}

/**
 * Formats metadata block for injection into handout/summary prompts.
 * Replaces {{METADATA_BLOCK}} placeholder in prompts.
 * When config provides title/authors/date, returns the values; otherwise returns fallback instruction.
 */
export function formatMetadataBlock(
  config: PipelineConfig,
  step: "handout" | "summary",
): string {
  const { title, authors, date } = config;
  const profile = config.profile ?? "lecture";
  const outputLanguage = config.language?.output ?? "en";
  const finalLine = getLocalizedLabel(outputLanguage, profile, step);

  if (title || authors?.length || date) {
    const parts: string[] = [];
    if (title) parts.push(`Title: ${title}`);
    if (authors?.length) parts.push(`Authors: ${authors.join(", ")}`);
    if (date)
      parts.push(
        `Date: ${typeof date === "string" ? date : (date as Date).toLocaleDateString()}`,
      );
    parts.push(`Final line (use exactly): ***${finalLine}***`);
    return `METADATA (use these values exactly):\n${parts.join("\n")}`;
  }

  return `No metadata provided. Infer title, authors, and date from the transcript. Use the localized final line appropriate for the output language (e.g. ***${finalLine}*** for current language).`;
}

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
 * For handout step, returns HandoutAiGenerateOptions with separate singlePass and incremental prompts.
 */
export function resolveAiConfig(
  config: PipelineConfig,
  step: AiStepName,
): Omit<AiGenerateOptions, "userPrompt"> | Omit<HandoutAiGenerateOptions, "userPrompt"> {
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
