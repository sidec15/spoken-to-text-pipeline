import type { PipelineConfig } from "../../config/config.types.js";
import type { ResolvedWhisperConfig } from "./asr.types.js";
import { WHISPER_PROFILE_PRESETS } from "./whisper.presets.js";

export function resolveWhisperConfig(config: PipelineConfig): ResolvedWhisperConfig {
  const preset = WHISPER_PROFILE_PRESETS[config.profile];

  if (!preset) {
    throw new Error(`No Whisper preset defined for profile '${config.profile}'`);
  }

  const overrides = config.asr?.whisper ?? {};

  return {
    serverUrl: overrides.serverUrl ?? config.asr.whisper.serverUrl,
    options: {
      ...preset,
      ...overrides,
      language: config.language.input,
    },
  };
}
