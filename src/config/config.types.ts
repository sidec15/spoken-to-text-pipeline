export type SupportedProfile = "lecture" | "meeting" | "other";
export type SupportedAiProvider = "cursor" | "openai";
export type SupportedAsrProvider = "whisper";

export interface CursorAiConfig {
  cursor: {
    cliPath: string;
    workspace: string;
  };
}

export interface OpenAiConfig {
  openai: {
    apiKey: string;
    model: string;
    overrides: {
      temperature?: number;
      maxTokens?: number;
    };
  };
}

export type AiConfig = CursorAiConfig | OpenAiConfig;

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
    config: AiConfig;
  };

  context?: {
    textSources?: string[]; // .txt / .md only
  };

  profiles: {
    lecture: {
      prompts: {
        cleaning: string;
        handout: string;
        summary: string;
      };
    };
    meeting: {
      prompts: {
        cleaning: string;
        summary: string;
      };
    };
    other: {
      prompts: {
        cleaning: string;
        summary: string;
      };
    };
  };
}
