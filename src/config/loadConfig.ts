import fs from "node:fs";
import path from "node:path";
import type { PipelineConfig, SupportedProfile, SupportedAiProvider, SupportedAsrProvider } from "./config.types.js";
import { CONFIG_DEFAULTS, getAsrDefaults } from "./config.defaults.js";

/**
 * Deep merge utility function
 */
function deepMerge<T extends Record<string, any>>(target: T, source: Partial<T>): T {
  const result = { ...target };
  for (const key in source) {
    if (source[key] !== undefined) {
      if (
        typeof source[key] === "object" &&
        source[key] !== null &&
        !Array.isArray(source[key]) &&
        typeof target[key] === "object" &&
        target[key] !== null &&
        !Array.isArray(target[key])
      ) {
        result[key] = deepMerge(
          (target[key] || {}) as T[Extract<keyof T, string>],
          (source[key] || {}) as Partial<T[Extract<keyof T, string>]>
        ) as T[Extract<keyof T, string>];
      } else {
        result[key] = source[key] as T[Extract<keyof T, string>];
      }
    }
  }
  return result;
}

export function loadConfig(configPath: string, baseDir?: string): PipelineConfig {
  // Resolve baseDir - if provided, use it; otherwise use process.cwd()
  const resolvedBaseDir = baseDir ? (path.isAbsolute(baseDir) ? baseDir : path.resolve(process.cwd(), baseDir)) : process.cwd();

  // Resolve config path relative to baseDir
  const absolutePath = path.isAbsolute(configPath)
    ? configPath
    : path.resolve(resolvedBaseDir, configPath);

  if (!fs.existsSync(absolutePath)) {
    throw new Error(`Config file not found: ${absolutePath}`);
  }

  const raw = fs.readFileSync(absolutePath, "utf-8");

  let userConfig: unknown;
  try {
    userConfig = JSON.parse(raw);
  } catch {
    throw new Error(`Invalid JSON in config file: ${absolutePath}`);
  }

  // Validate that profile exists (it's the only required field)
  if (typeof userConfig !== "object" || userConfig === null) {
    throw new Error(`Config must be an object: ${absolutePath}`);
  }

  const userConfigObj = userConfig as Record<string, unknown>;
  if (!("profile" in userConfigObj) || typeof userConfigObj.profile !== "string") {
    throw new Error(`Missing or invalid 'profile' field (must be: lecture, meeting, or other): ${absolutePath}`);
  }

  const profile = userConfigObj.profile as SupportedProfile;
  if (!["lecture", "meeting", "other"].includes(profile)) {
    throw new Error(`Invalid 'profile' value: ${profile} (must be: lecture, meeting, or other): ${absolutePath}`);
  }

  // Validate user-provided fields
  validateUserConfig(userConfigObj, absolutePath);

  // Start with defaults
  const mergedConfig = deepMerge(CONFIG_DEFAULTS as any, userConfigObj) as any;

  // Apply profile-specific ASR defaults
  const asrDefaults = getAsrDefaults(profile);
  if (!mergedConfig.asr) {
    mergedConfig.asr = {};
  }
  if (!mergedConfig.asr.whisper) {
    mergedConfig.asr.whisper = {};
  }
  mergedConfig.asr.provider = mergedConfig.asr.provider || "whisper";
  mergedConfig.asr.whisper = {
    ...asrDefaults,
    ...mergedConfig.asr.whisper,
    vad: mergedConfig.asr.whisper.vad
      ? {
          ...asrDefaults.vad,
          ...mergedConfig.asr.whisper.vad,
        }
      : asrDefaults.vad,
  };

  // Ensure required fields are present after merge
  if (!mergedConfig.language) {
    mergedConfig.language = CONFIG_DEFAULTS.language;
  }
  if (!mergedConfig.logging) {
    mergedConfig.logging = CONFIG_DEFAULTS.logging;
  }
  if (!mergedConfig.paths) {
    mergedConfig.paths = CONFIG_DEFAULTS.paths;
  }
  if (!mergedConfig.output) {
    mergedConfig.output = CONFIG_DEFAULTS.output;
  }
  if (!mergedConfig.asr) {
    mergedConfig.asr = CONFIG_DEFAULTS.asr;
  }
  if (!mergedConfig.ai) {
    mergedConfig.ai = CONFIG_DEFAULTS.ai;
  }

  injectApiKeysFromEnv(mergedConfig);

  // Set config file directory for resolving relative paths (e.g. steps.*.promptFile)
  mergedConfig.configDir = path.dirname(absolutePath);

  // Validate final merged config
  validateFinalConfig(mergedConfig, absolutePath);

  return mergedConfig as PipelineConfig;
}

/**
 * Validates user-provided config fields (only validates what's present)
 */
function validateUserConfig(config: Record<string, unknown>, configPath: string): void {
  const errors: string[] = [];

  // Validate profile (already checked, but double-check)
  if ("profile" in config && typeof config.profile === "string") {
    if (!["lecture", "meeting", "other"].includes(config.profile)) {
      errors.push(`Invalid 'profile' value: ${config.profile} (must be: lecture, meeting, or other)`);
    }
  }

  // Validate language (if provided)
  if ("language" in config && config.language !== undefined) {
    if (typeof config.language !== "object" || config.language === null) {
      errors.push("Invalid 'language' field (must be an object)");
    } else {
      const lang = config.language as Record<string, unknown>;
      if ("input" in lang && typeof lang.input !== "string") {
        errors.push("Invalid 'language.input' field (must be a string)");
      }
      if ("output" in lang && typeof lang.output !== "string") {
        errors.push("Invalid 'language.output' field (must be a string)");
      }
    }
  }

  // Validate logging (if provided)
  if ("logging" in config && config.logging !== undefined) {
    if (typeof config.logging !== "object" || config.logging === null) {
      errors.push("Invalid 'logging' field (must be an object)");
    } else {
      const log = config.logging as Record<string, unknown>;
      if ("level" in log && (typeof log.level !== "string" || !["error", "warn", "info", "debug"].includes(log.level))) {
        errors.push("Invalid 'logging.level' field (must be: error, warn, info, or debug)");
      }
      if ("singleLine" in log && typeof log.singleLine !== "boolean") {
        errors.push("Invalid 'logging.singleLine' field (must be boolean)");
      }
    }
  }

  // Validate paths (if provided)
  if ("paths" in config && config.paths !== undefined) {
    if (typeof config.paths !== "object" || config.paths === null) {
      errors.push("Invalid 'paths' field (must be an object)");
    } else {
      const paths = config.paths as Record<string, unknown>;
      if ("inputDir" in paths && typeof paths.inputDir !== "string") {
        errors.push("Invalid 'paths.inputDir' field (must be a string)");
      }
      if ("outputDir" in paths && typeof paths.outputDir !== "string") {
        errors.push("Invalid 'paths.outputDir' field (must be a string)");
      }
    }
  }

  // Validate output (if provided)
  if ("output" in config && config.output !== undefined) {
    if (typeof config.output !== "object" || config.output === null) {
      errors.push("Invalid 'output' field (must be an object)");
    } else {
      const output = config.output as Record<string, unknown>;
      if ("addTimestamp" in output && typeof output.addTimestamp !== "boolean") {
        errors.push("Invalid 'output.addTimestamp' field (must be boolean)");
      }
      if ("summaryWordCount" in output) {
        if (typeof output.summaryWordCount !== "number" || output.summaryWordCount <= 0) {
          errors.push("Invalid 'output.summaryWordCount' field (must be a positive number)");
        }
      }
    }
  }

  // Validate ASR (if provided)
  if ("asr" in config && config.asr !== undefined) {
    if (typeof config.asr !== "object" || config.asr === null) {
      errors.push("Invalid 'asr' field (must be an object)");
    } else {
      const asr = config.asr as Record<string, unknown>;
      if ("provider" in asr && asr.provider !== undefined && asr.provider !== "whisper") {
        errors.push("Invalid 'asr.provider' field (must be: whisper)");
      }
      if ("whisper" in asr && asr.whisper !== undefined) {
        if (typeof asr.whisper !== "object" || asr.whisper === null) {
          errors.push("Invalid 'asr.whisper' field (must be an object)");
        } else {
          const whisper = asr.whisper as Record<string, unknown>;
          if ("serverUrl" in whisper && typeof whisper.serverUrl !== "string") {
            errors.push("Invalid 'asr.whisper.serverUrl' field (must be a string)");
          }
          if ("task" in whisper && whisper.task !== undefined && !["transcribe", "translate"].includes(whisper.task as string)) {
            errors.push("Invalid 'asr.whisper.task' field (must be: transcribe or translate)");
          }
          if (
            "outputFormat" in whisper &&
            whisper.outputFormat !== undefined &&
            !["txt", "json", "srt", "vtt", "tsv"].includes(whisper.outputFormat as string)
          ) {
            errors.push("Invalid 'asr.whisper.outputFormat' field (must be: txt, json, srt, vtt, or tsv)");
          }
          if ("temperature" in whisper && typeof whisper.temperature !== "number") {
            errors.push("Invalid 'asr.whisper.temperature' field (must be a number)");
          }
          if ("beamSize" in whisper && typeof whisper.beamSize !== "number") {
            errors.push("Invalid 'asr.whisper.beamSize' field (must be a number)");
          }
          if ("bestOf" in whisper && typeof whisper.bestOf !== "number") {
            errors.push("Invalid 'asr.whisper.bestOf' field (must be a number)");
          }
          if ("vad" in whisper && whisper.vad !== undefined) {
            if (typeof whisper.vad !== "object" || whisper.vad === null) {
              errors.push("Invalid 'asr.whisper.vad' field (must be an object)");
            } else {
              const vad = whisper.vad as Record<string, unknown>;
              if ("enabled" in vad && typeof vad.enabled !== "boolean") {
                errors.push("Invalid 'asr.whisper.vad.enabled' field (must be boolean)");
              }
              if ("threshold" in vad && typeof vad.threshold !== "number") {
                errors.push("Invalid 'asr.whisper.vad.threshold' field (must be a number)");
              }
              if ("minSilenceMs" in vad && typeof vad.minSilenceMs !== "number") {
                errors.push("Invalid 'asr.whisper.vad.minSilenceMs' field (must be a number)");
              }
              if ("maxSpeechS" in vad && typeof vad.maxSpeechS !== "number") {
                errors.push("Invalid 'asr.whisper.vad.maxSpeechS' field (must be a number)");
              }
            }
          }
        }
      }
    }
  }

  // Validate AI (if provided)
  if ("ai" in config && config.ai !== undefined) {
    if (typeof config.ai !== "object" || config.ai === null) {
      errors.push("Invalid 'ai' field (must be an object)");
    } else {
      const ai = config.ai as Record<string, unknown>;

      // Validate providers pool (if provided)
      if ("providers" in ai && ai.providers !== undefined) {
        if (typeof ai.providers !== "object" || ai.providers === null) {
          errors.push("Invalid 'ai.providers' field (must be an object)");
        } else {
          const providers = ai.providers as Record<string, unknown>;

          if ("openai" in providers && providers.openai !== undefined) {
            if (typeof providers.openai !== "object" || providers.openai === null) {
              errors.push("Invalid 'ai.providers.openai' field (must be an object)");
            } else {
              const openai = providers.openai as Record<string, unknown>;
              if ("apiKey" in openai && typeof openai.apiKey !== "string") {
                errors.push("Invalid 'ai.providers.openai.apiKey' field (must be a string)");
              }
            }
          }

          if ("deepseek" in providers && providers.deepseek !== undefined) {
            if (typeof providers.deepseek !== "object" || providers.deepseek === null) {
              errors.push("Invalid 'ai.providers.deepseek' field (must be an object)");
            } else {
              const deepseek = providers.deepseek as Record<string, unknown>;
              if ("apiKey" in deepseek && typeof deepseek.apiKey !== "string") {
                errors.push("Invalid 'ai.providers.deepseek.apiKey' field (must be a string)");
              }
            }
          }

          if ("ollama" in providers && providers.ollama !== undefined) {
            if (typeof providers.ollama !== "object" || providers.ollama === null) {
              errors.push("Invalid 'ai.providers.ollama' field (must be an object)");
            } else {
              const ollama = providers.ollama as Record<string, unknown>;
              if ("baseUrl" in ollama && typeof ollama.baseUrl !== "string") {
                errors.push("Invalid 'ai.providers.ollama.baseUrl' field (must be a string)");
              }
            }
          }
        }
      }

      // Validate default configuration (if provided)
      if ("default" in ai && ai.default !== undefined) {
        if (typeof ai.default !== "object" || ai.default === null) {
          errors.push("Invalid 'ai.default' field (must be an object)");
        } else {
          const defaultConfig = ai.default as Record<string, unknown>;
          if ("provider" in defaultConfig) {
            if (typeof defaultConfig.provider !== "string" || !["openai", "deepseek", "ollama"].includes(defaultConfig.provider)) {
              errors.push("Invalid 'ai.default.provider' field (must be: openai, deepseek, or ollama)");
            }
          }
          if ("model" in defaultConfig && typeof defaultConfig.model !== "string") {
            errors.push("Invalid 'ai.default.model' field (must be a string)");
          }
          if ("overrides" in defaultConfig && defaultConfig.overrides !== undefined) {
            if (typeof defaultConfig.overrides !== "object" || defaultConfig.overrides === null) {
              errors.push("Invalid 'ai.default.overrides' field (must be an object)");
            } else {
              const overrides = defaultConfig.overrides as Record<string, unknown>;
              if ("temperature" in overrides && typeof overrides.temperature !== "number") {
                errors.push("Invalid 'ai.default.overrides.temperature' field (must be a number)");
              }
              if ("maxTokens" in overrides && typeof overrides.maxTokens !== "number") {
                errors.push("Invalid 'ai.default.overrides.maxTokens' field (must be a number)");
              }
            }
          }
        }
      }

    }
  }

  // Validate steps (if provided)
  if ("steps" in config && config.steps !== undefined) {
    if (typeof config.steps !== "object" || config.steps === null) {
      errors.push("Invalid 'steps' field (must be an object)");
    } else {
      const steps = config.steps as Record<string, unknown>;
      const validStepNames = ["asr", "cleaning", "handout", "summary"];

      for (const stepName of validStepNames) {
        if (stepName in steps && steps[stepName] !== undefined) {
          const stepConfig = steps[stepName] as Record<string, unknown>;

          // Validate enabled field
          if ("enabled" in stepConfig && typeof stepConfig.enabled !== "boolean") {
            errors.push(`Invalid 'steps.${stepName}.enabled' field (must be a boolean)`);
          }

          // ASR step has no aiConfig, prompt, or promptFile
          if (stepName === "asr") {
            continue;
          }

          // Validate prompt and promptFile (cleaning, handout, summary)
          if ("prompt" in stepConfig && stepConfig.prompt !== undefined && typeof stepConfig.prompt !== "string") {
            errors.push(`Invalid 'steps.${stepName}.prompt' field (must be a string)`);
          }
          if ("promptFile" in stepConfig && stepConfig.promptFile !== undefined && typeof stepConfig.promptFile !== "string") {
            errors.push(`Invalid 'steps.${stepName}.promptFile' field (must be a string)`);
          }

          // Validate aiConfig field (cleaning, handout, summary)
          if ("aiConfig" in stepConfig && stepConfig.aiConfig !== undefined) {
            if (typeof stepConfig.aiConfig !== "object" || stepConfig.aiConfig === null) {
              errors.push(`Invalid 'steps.${stepName}.aiConfig' field (must be an object)`);
            } else {
              const aiConfig = stepConfig.aiConfig as Record<string, unknown>;

              if ("provider" in aiConfig) {
                if (typeof aiConfig.provider !== "string" || !["openai", "deepseek", "ollama"].includes(aiConfig.provider)) {
                  errors.push(`Invalid 'steps.${stepName}.aiConfig.provider' field (must be: openai, deepseek, or ollama)`);
                }
              }

              if ("model" in aiConfig && typeof aiConfig.model !== "string") {
                errors.push(`Invalid 'steps.${stepName}.aiConfig.model' field (must be a string)`);
              }

              if ("overrides" in aiConfig && aiConfig.overrides !== undefined) {
                if (typeof aiConfig.overrides !== "object" || aiConfig.overrides === null) {
                  errors.push(`Invalid 'steps.${stepName}.aiConfig.overrides' field (must be an object)`);
                } else {
                  const overrides = aiConfig.overrides as Record<string, unknown>;
                  if ("temperature" in overrides && typeof overrides.temperature !== "number") {
                    errors.push(`Invalid 'steps.${stepName}.aiConfig.overrides.temperature' field (must be a number)`);
                  }
                  if ("maxTokens" in overrides && typeof overrides.maxTokens !== "number") {
                    errors.push(`Invalid 'steps.${stepName}.aiConfig.overrides.maxTokens' field (must be a number)`);
                  }
                }
              }
            }
          }
        }
      }
    }
  }

  // Validate context (if provided)
  if ("context" in config && config.context !== undefined) {
    if (typeof config.context !== "object" || config.context === null) {
      errors.push("Invalid 'context' field (must be an object)");
    } else {
      const context = config.context as Record<string, unknown>;
      if ("textSources" in context && context.textSources !== undefined) {
        if (!Array.isArray(context.textSources)) {
          errors.push("Invalid 'context.textSources' field (must be an array)");
        } else {
          for (let i = 0; i < context.textSources.length; i++) {
            if (typeof context.textSources[i] !== "string") {
              errors.push(`Invalid 'context.textSources[${i}]' field (must be a string)`);
            }
          }
        }
      }
    }
  }

  if (errors.length > 0) {
    throw new Error(`Config validation failed (${configPath}):\n${errors.map((e) => `  - ${e}`).join("\n")}`);
  }
}

/**
 * Injects OpenAI and DeepSeek API keys from environment when not specified in config.
 * Env vars: SPOKEN_TO_TEXT_OPENAI_API_KEY, SPOKEN_TO_TEXT_DEEPSEEK_API_KEY
 */
function injectApiKeysFromEnv(config: any): void {
  const prov = config.ai?.providers;
  if (!prov || typeof prov !== "object") return;
  if (prov.openai && typeof prov.openai === "object") {
    const fromConfig = (typeof prov.openai.apiKey === "string" && prov.openai.apiKey.trim()) || "";
    prov.openai.apiKey = fromConfig || (process.env.SPOKEN_TO_TEXT_OPENAI_API_KEY ?? "").trim();
  }
  if (prov.deepseek && typeof prov.deepseek === "object") {
    const fromConfig = (typeof prov.deepseek.apiKey === "string" && prov.deepseek.apiKey.trim()) || "";
    prov.deepseek.apiKey = fromConfig || (process.env.SPOKEN_TO_TEXT_DEEPSEEK_API_KEY ?? "").trim();
  }
}

/**
 * Validates the final merged config to ensure all required fields are present
 */
function validateFinalConfig(config: any, configPath: string): void {
  const errors: string[] = [];

  // Ensure profile is present
  if (!config.profile || typeof config.profile !== "string") {
    errors.push("Missing 'profile' field");
  }

  // Ensure language is present
  if (!config.language || typeof config.language !== "object") {
    errors.push("Missing 'language' field");
  } else {
    if (typeof config.language.input !== "string") {
      errors.push("Missing or invalid 'language.input' field");
    }
    if (typeof config.language.output !== "string") {
      errors.push("Missing or invalid 'language.output' field");
    }
  }

  // Ensure logging is present
  if (!config.logging || typeof config.logging !== "object") {
    errors.push("Missing 'logging' field");
  } else {
    if (typeof config.logging.level !== "string" || !["error", "warn", "info", "debug"].includes(config.logging.level)) {
      errors.push("Missing or invalid 'logging.level' field");
    }
    if (typeof config.logging.singleLine !== "boolean") {
      errors.push("Missing or invalid 'logging.singleLine' field");
    }
  }

  // Ensure paths is present
  if (!config.paths || typeof config.paths !== "object") {
    errors.push("Missing 'paths' field");
  } else {
    if (typeof config.paths.inputDir !== "string") {
      errors.push("Missing or invalid 'paths.inputDir' field");
    }
    if (typeof config.paths.outputDir !== "string") {
      errors.push("Missing or invalid 'paths.outputDir' field");
    }
  }

  // Ensure asr is present
  if (!config.asr || typeof config.asr !== "object") {
    errors.push("Missing 'asr' field");
  } else {
    if (config.asr.provider !== "whisper") {
      errors.push("Missing or invalid 'asr.provider' field (must be: whisper)");
    }
    if (!config.asr.whisper || typeof config.asr.whisper !== "object") {
      errors.push("Missing 'asr.whisper' field");
    } else {
      if (typeof config.asr.whisper.serverUrl !== "string") {
        errors.push("Missing or invalid 'asr.whisper.serverUrl' field");
      }
    }
  }

  // Ensure ai is present and has at least one provider
  if (!config.ai || typeof config.ai !== "object") {
    errors.push("Missing 'ai' field");
  } else {
    if (!config.ai.providers || typeof config.ai.providers !== "object") {
      errors.push("Missing 'ai.providers' field");
    } else {
      const providers = config.ai.providers as Record<string, unknown>;
      const hasOpenai = providers.openai && typeof providers.openai === "object" && (providers.openai as any).apiKey;
      const hasDeepseek = providers.deepseek && typeof providers.deepseek === "object" && (providers.deepseek as any).apiKey;
      const hasOllama = providers.ollama && typeof providers.ollama === "object";
      if (!hasOpenai && !hasDeepseek && !hasOllama) {
        errors.push("At least one provider must be configured in 'ai.providers'");
      }

      // Validate default provider exists in providers pool
      if (config.ai.default) {
        if (!config.ai.default.provider || typeof config.ai.default.provider !== "string") {
          errors.push("Missing or invalid 'ai.default.provider' field");
        } else {
          const defaultProvider = config.ai.default.provider;
          if (defaultProvider === "openai" && !hasOpenai) {
            errors.push(`Default provider '${defaultProvider}' is not configured`);
          } else if (defaultProvider === "deepseek" && !hasDeepseek) {
            errors.push(`Default provider '${defaultProvider}' is not configured`);
          } else if (defaultProvider === "ollama" && !hasOllama) {
            errors.push(`Default provider '${defaultProvider}' is not configured`);
          }
        }
        if (!config.ai.default.model || typeof config.ai.default.model !== "string") {
          errors.push("Missing or invalid 'ai.default.model' field");
        }
      } else {
        errors.push("Missing or invalid 'ai.default' field");
      }

      // Validate step providers exist in providers pool
      if (config.steps) {
        const validStepNames = ["cleaning", "handout", "summary"];
        for (const stepName of validStepNames) {
          if (config.steps[stepName]?.aiConfig?.provider) {
            const stepProvider = config.steps[stepName].aiConfig.provider;
            if (stepProvider === "openai" && !hasOpenai) {
              errors.push(`Step '${stepName}' provider '${stepProvider}' is not configured`);
            } else if (stepProvider === "deepseek" && !hasDeepseek) {
              errors.push(`Step '${stepName}' provider '${stepProvider}' is not configured`);
            } else if (stepProvider === "ollama" && !hasOllama) {
              errors.push(`Step '${stepName}' provider '${stepProvider}' is not configured`);
            }
          }
        }
      }
    }
  }

  // Validate ASR whisper vad.enabled
  if (config.asr?.whisper?.vad !== undefined) {
    if (typeof config.asr.whisper.vad !== "object" || config.asr.whisper.vad === null) {
      errors.push("Invalid 'asr.whisper.vad' field");
    } else {
      if (typeof config.asr.whisper.vad.enabled !== "boolean") {
        errors.push("Missing or invalid 'asr.whisper.vad.enabled' field");
      }
    }
  }

  if (errors.length > 0) {
    throw new Error(`Config validation failed after merging defaults (${configPath}):\n${errors.map((e) => `  - ${e}`).join("\n")}`);
  }
}
