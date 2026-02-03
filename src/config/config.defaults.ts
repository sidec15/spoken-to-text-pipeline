import type { PipelineConfig, SupportedProfile } from "./config.types.js";

/**
 * Type for profile-specific ASR whisper defaults.
 * Extracted from PipelineConfig to ensure type safety and consistency.
 */
type WhisperConfig = NonNullable<NonNullable<NonNullable<PipelineConfig["asr"]>["whisper"]>>;
type VadConfig = NonNullable<WhisperConfig["vad"]>;

type AsrWhisperDefaults = Required<
  Pick<WhisperConfig, "task" | "outputFormat" | "temperature" | "beamSize" | "bestOf" | "vad">
> & {
  vad: Required<VadConfig>;
};

/**
 * Profile-specific ASR defaults
 */
const ASR_PROFILE_DEFAULTS: Record<SupportedProfile, AsrWhisperDefaults> = {
  lecture: {
    task: "transcribe",
    outputFormat: "txt",
    temperature: 0,
    beamSize: 5,
    bestOf: 5,
    vad: {
      enabled: true,
      threshold: 0.45,
      minSilenceMs: 700,
      maxSpeechS: 60,
    },
  },
  meeting: {
    task: "transcribe",
    outputFormat: "txt",
    temperature: 0.2,
    beamSize: 3,
    bestOf: 3,
    vad: {
      enabled: true,
      threshold: 0.6,
      minSilenceMs: 500,
      maxSpeechS: 30,
    },
  },
  other: {
    task: "transcribe",
    outputFormat: "txt",
    temperature: 0,
    beamSize: 5,
    bestOf: 5,
    vad: {
      enabled: true,
      threshold: 0.5,
      minSilenceMs: 600,
      maxSpeechS: 45,
    },
  },
};

/**
 * Gets ASR defaults for a specific profile
 */
export function getAsrDefaults(profile: SupportedProfile): AsrWhisperDefaults {
  return ASR_PROFILE_DEFAULTS[profile];
}

/**
 * Base default configuration values.
 * These are merged with user-provided config, with user values taking precedence.
 * Only fields that have sensible defaults are included here.
 * Type is derived from PipelineConfig to ensure structure matches exactly.
 */
export const CONFIG_DEFAULTS: Omit<PipelineConfig, "profile"> = {
  language: {
    input: "en",
    output: "en",
  },
  logging: {
    level: "info",
    singleLine: false,
  },
  paths: {
    inputDir: "./input",
    outputDir: "./output",
  },
  output: {
    addTimestamp: false,
    // summaryWordCount is undefined by default - uses dynamic calculation based on input size and profile
  },
  asr: {
    provider: "whisper",
    whisper: {
      serverUrl: "http://localhost:9000/asr",
      // Note: task, outputFormat, temperature, beamSize, bestOf, and vad
      // are set per-profile via getAsrDefaults()
    },
  },
  ai: {
    providers: {},
    default: {
      provider: "openai",
      model: "gpt-5-mini",
    },
  },
  context: undefined,
  // Note: profiles.prompts are not included here as they come from profilePresets.ts
  // Users can override them in their config if needed
  profiles: undefined,
};
