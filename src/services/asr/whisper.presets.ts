import type { AsrTranscribeOptions } from "./asr.types.js";

export type ProfileName = "lecture" | "meeting" | "other";

export const WHISPER_PROFILE_PRESETS: Record<ProfileName, AsrTranscribeOptions> = {
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
