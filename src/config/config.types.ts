/**
 * Supported pipeline profiles that determine processing behavior and prompts.
 * - "lecture": Optimized for educational lectures (includes handout generation)
 * - "meeting": Optimized for meeting transcripts (focuses on decisions and action items)
 * - "other": General-purpose transcription and cleaning
 */
export type SupportedProfile = "lecture" | "meeting" | "other";

/**
 * Supported AI providers for text processing steps (cleaning, handout, summary).
 */
export type SupportedAiProvider = "openai" | "deepseek";

/**
 * Supported ASR (Automatic Speech Recognition) providers.
 */
export type SupportedAsrProvider = "whisper";

/**
 * Configuration for OpenAI provider.
 */
export interface OpenAiConfig {
  openai: {
    /** OpenAI API key */
    apiKey: string;
    /** OpenAI model identifier (e.g., "gpt-4", "gpt-3.5-turbo") */
    model: string;
    /** Optional overrides for AI generation parameters */
    overrides: {
      /**
       * Temperature for text generation (0-2).
       * Lower values make output more deterministic, higher values more creative.
       * Defaults to profile-specific preset values.
       */
      temperature?: number;
      /**
       * Maximum tokens in the generated output.
       * If not specified, calculated based on input length and step type.
       */
      maxTokens?: number;
    };
  };
}

/**
 * Configuration for DeepSeek provider.
 */
export interface DeepSeekConfig {
  deepseek: {
    /** DeepSeek API key */
    apiKey: string;
    /** DeepSeek model identifier (e.g., "deepseek-chat", "deepseek-reasoner") */
    model: string;
    /** Optional overrides for AI generation parameters */
    overrides: {
      /**
       * Temperature for text generation (0-2).
       * Lower values make output more deterministic, higher values more creative.
       * Defaults to profile-specific preset values.
       */
      temperature?: number;
      /**
       * Maximum tokens in the generated output.
       * If not specified, calculated based on input length and step type.
       */
      maxTokens?: number;
    };
  };
}

/**
 * Union type for AI provider configurations.
 */
export type AiConfig = OpenAiConfig | DeepSeekConfig;

/**
 * Main pipeline configuration interface.
 * Defines all settings for the spoken-to-text processing pipeline.
 */
export interface PipelineConfig {
  /**
   * Profile that determines processing behavior, prompts, and available steps.
   * Lecture profile includes handout generation; meeting/other profiles skip it.
   */
  profile: SupportedProfile;

  /**
   * Language configuration for input and output.
   */
  language: {
    /**
     * Language code for the input audio (e.g., "it", "en", "es").
     * Used by ASR step for transcription.
     * Must be a valid Whisper language code.
     */
    input: string;
    /**
     * Language code for all output text (e.g., "it", "en", "es").
     * Used by AI steps (cleaning, handout, summary) to ensure output is in the specified language.
     */
    output: string;
  };

  /**
   * Logging configuration.
   */
  logging: {
    /**
     * Minimum log level to display.
     * - "error": Only errors
     * - "warn": Warnings and errors
     * - "info": Informational messages, warnings, and errors
     * - "debug": All messages including debug details
     */
    level: "error" | "warn" | "info" | "debug";
    /**
     * If true, logs are displayed in single-line format.
     * If false, logs use multi-line format with better readability.
     */
    singleLine: boolean;
  };

  /**
   * File system paths configuration.
   */
  paths: {
    /**
     * Directory containing input audio files (.wav format).
     * Files are processed in alphabetical order.
     */
    inputDir: string;
    /**
     * Base output directory where all pipeline outputs are written.
     * All outputs (transcripts, cleaned files, handouts, summaries) go directly here (no subfolders).
     * If `output.addTimestamp` is true, a timestamp suffix is appended.
     */
    outputDir: string;
  };

  /**
   * Optional output configuration.
   */
  output?: {
    /**
     * If true, appends a timestamp suffix (yyyyMMddHHmmss) to outputDir.
     * Example: "output" becomes "output_20250125143000"
     * Default: false
     */
    addTimestamp?: boolean;
    /**
     * Target word count for summary generation.
     * The AI will aim to produce summaries approximately this length.
     * Default: 1000 words
     */
    summaryWordCount?: number;
  };

  /**
   * ASR (Automatic Speech Recognition) configuration.
   */
  asr: {
    /** ASR provider to use */
    provider: SupportedAsrProvider;
    /** Whisper ASR specific configuration */
    whisper: {
      /**
       * URL of the Whisper ASR server endpoint.
       * Example: "http://localhost:9000/asr"
       */
      serverUrl: string;
      /**
       * ASR task type.
       * - "transcribe": Transcribe audio to text in the same language
       * - "translate": Transcribe and translate to English
       * Default: "transcribe" (from profile preset)
       */
      task?: "transcribe" | "translate";
      /**
       * Output format for transcriptions.
       * - "txt": Plain text
       * - "json": JSON format
       * - "srt": SubRip subtitle format
       * - "vtt": WebVTT subtitle format
       * - "tsv": Tab-separated values
       * Default: "txt" (from profile preset)
       */
      outputFormat?: "txt" | "json" | "srt" | "vtt" | "tsv";
      /**
       * Temperature for ASR decoding (0-1).
       * Lower values make transcription more deterministic.
       * Default: Profile-specific preset value
       */
      temperature?: number;
      /**
       * Beam size for beam search decoding.
       * Higher values improve accuracy but increase processing time.
       * Default: Profile-specific preset value
       */
      beamSize?: number;
      /**
       * Number of candidates to consider during decoding.
       * Default: Profile-specific preset value
       */
      bestOf?: number;

      /**
       * Voice Activity Detection (VAD) configuration.
       * VAD helps identify speech segments and filter out silence/noise.
       */
      vad?: {
        /** Enable or disable VAD processing */
        enabled: boolean;
        /**
         * VAD threshold (0-1).
         * Higher values require stronger signal to be considered speech.
         * Default: Profile-specific preset value
         */
        threshold?: number;
        /**
         * Minimum silence duration in milliseconds before splitting segments.
         * Default: Profile-specific preset value
         */
        minSilenceMs?: number;
        /**
         * Maximum speech segment duration in seconds.
         * Longer segments are split automatically.
         * Default: Profile-specific preset value
         */
        maxSpeechS?: number;
      };

      /**
       * Request timeout in milliseconds for each audio file transcription.
       * If not specified, uses server default.
       */
      requestTimeoutMs?: number;
    };
  };

  /**
   * AI provider configuration for text processing steps.
   */
  ai: {
    /** AI provider to use for cleaning, handout, and summary steps */
    provider: SupportedAiProvider;
    /** Provider-specific configuration */
    config: AiConfig;
  };

  /**
   * Optional context configuration for improving AI processing.
   */
  context?: {
    /**
     * Array of file paths containing reference text (.txt or .md files).
     * These files are provided to AI steps as reference-only context to improve
     * terminological accuracy and theoretical coherence.
     * Content is NOT modified or repeated in outputs.
     */
    textSources?: string[];
  };

  /**
   * Profile-specific prompt configurations.
   * Each profile defines custom prompts for its supported steps.
   * Prompts can override or extend the default profile presets.
   */
  profiles: {
    /**
     * Lecture profile configuration.
     * Includes prompts for cleaning, handout generation, and summary.
     */
    lecture: {
      prompts: {
        /** System prompt for cleaning lecture transcripts */
        cleaning: string;
        /** System prompt for generating handouts from cleaned transcripts */
        handout: string;
        /** System prompt for generating summaries */
        summary: string;
      };
    };
    /**
     * Meeting profile configuration.
     * Includes prompts for cleaning and summary (no handout step).
     */
    meeting: {
      prompts: {
        /** System prompt for cleaning meeting transcripts */
        cleaning: string;
        /** System prompt for generating summaries */
        summary: string;
      };
    };
    /**
     * Other profile configuration.
     * General-purpose prompts for cleaning and summary.
     */
    other: {
      prompts: {
        /** System prompt for cleaning general transcripts */
        cleaning: string;
        /** System prompt for generating summaries */
        summary: string;
      };
    };
  };
}
