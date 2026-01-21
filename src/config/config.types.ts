export type SupportedProfile = "lecture";
export type SupportedAiProvider = "cursor";
export type SupportedAsrProvider = "whisper";

export interface PipelineConfig {
  profile: SupportedProfile;

  language: {
    input: string;
    output: string;
  };

  logging: {
    level: "error" | "warn" | "info" | "debug";
    singleLine: boolean;
  };

  paths: {
    audioInputDir: string;
    rawOutputDir: string;
    cleanOutputDir: string;
    finalOutputDir: string;
  };

  asr: {
    provider: SupportedAsrProvider;
    whisper: {
      serverUrl: string; // e.g. http://localhost:9000/asr
      task?: "transcribe" | "translate";
      outputFormat?: "txt" | "json" | "srt" | "vtt" | "tsv";
      language?: string; // if omitted, can use config.language.input
      temperature?: number;
      beamSize?: number;
      bestOf?: number;

      vad?: {
        enabled: boolean;
        threshold?: number;
        minSilenceMs?: number;
        maxSpeechS?: number;
      };

      requestTimeoutMs?: number; // per file
    };
  };

  ai: {
    provider: SupportedAiProvider;
    cursor: {
      cliPath: string;
      workspace: string;
    };
  };

  profiles: {
    lecture: {
      prompts: {
        cleaning: string;
        dispensa: string;
        summary: string;
      };
    };
  };
}
