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
    const requiredPaths = ["audioInputDir", "rawOutputDir", "cleanOutputDir", "finalOutputDir"];
    for (const pathKey of requiredPaths) {
      if (typeof paths[pathKey] !== "string") {
        errors.push(`Missing or invalid 'paths.${pathKey}' field`);
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
    if (typeof ai.provider !== "string" || !["cursor", "openai"].includes(ai.provider)) {
      errors.push("Missing or invalid 'ai.provider' field (must be: cursor or openai)");
    }
    if (!("config" in ai) || typeof ai.config !== "object" || ai.config === null) {
      errors.push("Missing or invalid 'ai.config' field");
    } else {
      const aiConfig = ai.config as Record<string, unknown>;
      if (ai.provider === "openai") {
        if (!("openai" in aiConfig) || typeof aiConfig.openai !== "object" || aiConfig.openai === null) {
          errors.push("Missing or invalid 'ai.config.openai' field");
        } else {
          const openai = aiConfig.openai as Record<string, unknown>;
          if (typeof openai.apiKey !== "string") {
            errors.push("Missing or invalid 'ai.config.openai.apiKey' field");
          }
          if (typeof openai.model !== "string") {
            errors.push("Missing or invalid 'ai.config.openai.model' field");
          }
        }
      } else if (ai.provider === "cursor") {
        if (!("cursor" in aiConfig) || typeof aiConfig.cursor !== "object" || aiConfig.cursor === null) {
          errors.push("Missing or invalid 'ai.config.cursor' field");
        } else {
          const cursor = aiConfig.cursor as Record<string, unknown>;
          if (typeof cursor.cliPath !== "string") {
            errors.push("Missing or invalid 'ai.config.cursor.cliPath' field");
          }
          if (typeof cursor.workspace !== "string") {
            errors.push("Missing or invalid 'ai.config.cursor.workspace' field");
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
