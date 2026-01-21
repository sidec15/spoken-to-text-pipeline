export type AsrOutputFormat = "txt" | "json" | "srt" | "vtt" | "tsv";
export type AsrTask = "transcribe" | "translate";

export interface AsrTranscribeOptions {
  task: AsrTask;
  outputFormat: AsrOutputFormat;
  language?: string;

  temperature?: number;
  beamSize?: number;
  bestOf?: number;

  vad?: {
    enabled: boolean;
    threshold?: number;
    minSilenceMs?: number;
    maxSpeechS?: number;
  };

  timeoutMs?: number;
}

export interface ResolvedWhisperConfig {
  serverUrl: string;
  options: AsrTranscribeOptions;
}

export interface AsrService {
  transcribeFileAsync(inputPath: string, opts: AsrTranscribeOptions): Promise<Buffer>;
}
