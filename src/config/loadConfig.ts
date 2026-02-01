import fs from "node:fs";
import path from "node:path";
import type { PipelineConfig, SupportedProfile, SupportedAiProvider, SupportedAsrProvider } from "./config.types.js";

export function loadConfig(configPath: string): PipelineConfig {
  const absolutePath = path.isAbsolute(configPath)
    ? configPath
    : path.resolve(process.cwd(), configPath);

  if (!fs.existsSync(absolutePath)) {
    throw new Error(`Config file not found: ${absolutePath}`);
  }

  const raw = fs.readFileSync(absolutePath, "utf-8");

  let config: unknown;
  try {
    config = JSON.parse(raw);
  } catch {
    throw new Error(`Invalid JSON in config file: ${absolutePath}`);
  }

  validateConfig(config, absolutePath);

  return config as PipelineConfig;
}

function validateConfig(config: unknown, configPath: string): asserts config is PipelineConfig {
  if (typeof config !== "object" || config === null) {
    throw new Error(`Config must be an object: ${configPath}`);
  }

  const c = config as Record<string, unknown>;
  const errors: string[] = [];

  // Validate profile
  if (!("profile" in c) || typeof c.profile !== "string") {
    errors.push("Missing or invalid 'profile' field (must be: lecture, meeting, or other)");
  } else if (!["lecture", "meeting", "other"].includes(c.profile)) {
    errors.push(`Invalid 'profile' value: ${c.profile} (must be: lecture, meeting, or other)`);
  }

  // Validate language
  if (!("language" in c) || typeof c.language !== "object" || c.language === null) {
    errors.push("Missing or invalid 'language' field");
  } else {
    const lang = c.language as Record<string, unknown>;
    if (typeof lang.input !== "string") {
      errors.push("Missing or invalid 'language.input' field");
    }
    if (typeof lang.output !== "string") {
      errors.push("Missing or invalid 'language.output' field");
    }
  }

  // Validate logging
  if (!("logging" in c) || typeof c.logging !== "object" || c.logging === null) {
    errors.push("Missing or invalid 'logging' field");
  } else {
    const log = c.logging as Record<string, unknown>;
    if (typeof log.level !== "string" || !["error", "warn", "info", "debug"].includes(log.level)) {
      errors.push("Missing or invalid 'logging.level' field (must be: error, warn, info, or debug)");
    }
    if (typeof log.singleLine !== "boolean") {
      errors.push("Missing or invalid 'logging.singleLine' field (must be boolean)");
    }
  }

  // Validate paths
  if (!("paths" in c) || typeof c.paths !== "object" || c.paths === null) {
    errors.push("Missing or invalid 'paths' field");
  } else {
    const paths = c.paths as Record<string, unknown>;
    if (typeof paths.inputDir !== "string") {
      errors.push("Missing or invalid 'paths.inputDir' field");
    }
    if (typeof paths.outputDir !== "string") {
      errors.push("Missing or invalid 'paths.outputDir' field");
    }
  }

  // Validate output (optional)
  if ("output" in c && c.output !== undefined) {
    if (typeof c.output !== "object" || c.output === null) {
      errors.push("Invalid 'output' field (must be an object)");
    } else {
      const output = c.output as Record<string, unknown>;
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

  // Validate ASR
  if (!("asr" in c) || typeof c.asr !== "object" || c.asr === null) {
    errors.push("Missing or invalid 'asr' field");
  } else {
    const asr = c.asr as Record<string, unknown>;
    if (typeof asr.provider !== "string" || asr.provider !== "whisper") {
      errors.push("Missing or invalid 'asr.provider' field (must be: whisper)");
    }
    if (!("whisper" in asr) || typeof asr.whisper !== "object" || asr.whisper === null) {
      errors.push("Missing or invalid 'asr.whisper' field");
    } else {
      const whisper = asr.whisper as Record<string, unknown>;
      if (typeof whisper.serverUrl !== "string") {
        errors.push("Missing or invalid 'asr.whisper.serverUrl' field");
      }
      if ("vad" in whisper && whisper.vad !== undefined) {
        if (typeof whisper.vad !== "object" || whisper.vad === null) {
          errors.push("Invalid 'asr.whisper.vad' field (must be an object)");
        } else {
          const vad = whisper.vad as Record<string, unknown>;
          if (typeof vad.enabled !== "boolean") {
            errors.push("Missing or invalid 'asr.whisper.vad.enabled' field (must be boolean)");
          }
        }
      }
    }
  }

  // Validate AI
  if (!("ai" in c) || typeof c.ai !== "object" || c.ai === null) {
    errors.push("Missing or invalid 'ai' field");
  } else {
    const ai = c.ai as Record<string, unknown>;

    // Validate providers pool
    if (!("providers" in ai) || typeof ai.providers !== "object" || ai.providers === null) {
      errors.push("Missing or invalid 'ai.providers' field");
    } else {
      const providers = ai.providers as Record<string, unknown>;
      let hasAtLeastOneProvider = false;

      if ("openai" in providers && providers.openai !== undefined) {
        if (typeof providers.openai !== "object" || providers.openai === null) {
          errors.push("Invalid 'ai.providers.openai' field (must be an object)");
        } else {
          const openai = providers.openai as Record<string, unknown>;
          if (typeof openai.apiKey !== "string") {
            errors.push("Missing or invalid 'ai.providers.openai.apiKey' field");
          } else {
            hasAtLeastOneProvider = true;
          }
        }
      }

      if ("deepseek" in providers && providers.deepseek !== undefined) {
        if (typeof providers.deepseek !== "object" || providers.deepseek === null) {
          errors.push("Invalid 'ai.providers.deepseek' field (must be an object)");
        } else {
          const deepseek = providers.deepseek as Record<string, unknown>;
          if (typeof deepseek.apiKey !== "string") {
            errors.push("Missing or invalid 'ai.providers.deepseek.apiKey' field");
          } else {
            hasAtLeastOneProvider = true;
          }
        }
      }

      if (!hasAtLeastOneProvider) {
        errors.push("At least one provider must be configured in 'ai.providers'");
      }
    }

    // Validate default configuration
    if (!("default" in ai) || typeof ai.default !== "object" || ai.default === null) {
      errors.push("Missing or invalid 'ai.default' field");
    } else {
      const defaultConfig = ai.default as Record<string, unknown>;
      if (typeof defaultConfig.provider !== "string" || !["openai", "deepseek"].includes(defaultConfig.provider)) {
        errors.push("Missing or invalid 'ai.default.provider' field (must be: openai or deepseek)");
      } else {
        // Validate that default provider exists in providers pool
        const providerName = defaultConfig.provider as string;
        const providers = ai.providers as Record<string, unknown>;
        if (!(providerName in providers) || providers[providerName] === undefined) {
          errors.push(`Default provider '${providerName}' is not configured in 'ai.providers'`);
        }
      }
      if (typeof defaultConfig.model !== "string") {
        errors.push("Missing or invalid 'ai.default.model' field");
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

    // Validate step overrides (optional)
    if ("steps" in ai && ai.steps !== undefined) {
      if (typeof ai.steps !== "object" || ai.steps === null) {
        errors.push("Invalid 'ai.steps' field (must be an object)");
      } else {
        const steps = ai.steps as Record<string, unknown>;
        const validStepNames = ["cleaning", "handout", "summary"];

        for (const stepName of validStepNames) {
          if (stepName in steps && steps[stepName] !== undefined) {
            const stepConfig = steps[stepName] as Record<string, unknown>;
            const providers = ai.providers as Record<string, unknown>;

            if ("provider" in stepConfig) {
              if (typeof stepConfig.provider !== "string" || !["openai", "deepseek"].includes(stepConfig.provider)) {
                errors.push(`Invalid 'ai.steps.${stepName}.provider' field (must be: openai or deepseek)`);
              } else {
                const providerName = stepConfig.provider as string;
                if (!(providerName in providers) || providers[providerName] === undefined) {
                  errors.push(`Step '${stepName}' provider '${providerName}' is not configured in 'ai.providers'`);
                }
              }
            }

            if ("model" in stepConfig && typeof stepConfig.model !== "string") {
              errors.push(`Invalid 'ai.steps.${stepName}.model' field (must be a string)`);
            }

            if ("overrides" in stepConfig && stepConfig.overrides !== undefined) {
              if (typeof stepConfig.overrides !== "object" || stepConfig.overrides === null) {
                errors.push(`Invalid 'ai.steps.${stepName}.overrides' field (must be an object)`);
              } else {
                const overrides = stepConfig.overrides as Record<string, unknown>;
                if ("temperature" in overrides && typeof overrides.temperature !== "number") {
                  errors.push(`Invalid 'ai.steps.${stepName}.overrides.temperature' field (must be a number)`);
                }
                if ("maxTokens" in overrides && typeof overrides.maxTokens !== "number") {
                  errors.push(`Invalid 'ai.steps.${stepName}.overrides.maxTokens' field (must be a number)`);
                }
              }
            }
          }
        }
      }
    }
  }

  // Validate profiles
  if (!("profiles" in c) || typeof c.profiles !== "object" || c.profiles === null) {
    errors.push("Missing or invalid 'profiles' field");
  } else {
    const profiles = c.profiles as Record<string, unknown>;
    const requiredProfiles: SupportedProfile[] = ["lecture", "meeting", "other"];
    for (const profileName of requiredProfiles) {
      if (!(profileName in profiles) || typeof profiles[profileName] !== "object" || profiles[profileName] === null) {
        errors.push(`Missing or invalid 'profiles.${profileName}' field`);
      } else {
        const profile = profiles[profileName] as Record<string, unknown>;
        if (!("prompts" in profile) || typeof profile.prompts !== "object" || profile.prompts === null) {
          errors.push(`Missing or invalid 'profiles.${profileName}.prompts' field`);
        } else {
          const prompts = profile.prompts as Record<string, unknown>;
          if (profileName === "lecture") {
            const requiredPrompts = ["cleaning", "handout", "summary"];
            for (const promptName of requiredPrompts) {
              if (typeof prompts[promptName] !== "string") {
                errors.push(`Missing or invalid 'profiles.${profileName}.prompts.${promptName}' field`);
              }
            }
          } else {
            const requiredPrompts = ["cleaning", "summary"];
            for (const promptName of requiredPrompts) {
              if (typeof prompts[promptName] !== "string") {
                errors.push(`Missing or invalid 'profiles.${profileName}.prompts.${promptName}' field`);
              }
            }
          }
        }
      }
    }
  }

  // Validate context (optional)
  if ("context" in c && c.context !== undefined) {
    if (typeof c.context !== "object" || c.context === null) {
      errors.push("Invalid 'context' field (must be an object)");
    } else {
      const context = c.context as Record<string, unknown>;
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
