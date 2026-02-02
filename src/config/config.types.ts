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
 * AI provider pool configuration.
 * Contains API keys for all providers that may be used.
 * At least one provider must be configured.
 */
export interface AiProviderPool {
  /**
   * OpenAI provider configuration (optional).
   * Default: undefined (OpenAI provider not available)
   */
  openai?: {
    /** OpenAI API key (required if openai provider is configured) */
    apiKey: string;
  };
  /**
   * DeepSeek provider configuration (optional).
   * Default: undefined (DeepSeek provider not available)
   */
  deepseek?: {
    /** DeepSeek API key (required if deepseek provider is configured) */
    apiKey: string;
  };
}

/**
 * Step-specific AI configuration.
 * Defines provider, model, and optional parameter overrides for a step.
 */
export interface StepAiConfig {
  /** AI provider to use (required) */
  provider: SupportedAiProvider;
  /** Model identifier (e.g., "gpt-4o-mini", "gpt-5-mini", "deepseek-chat") (required) */
  model: string;
  /**
   * Optional overrides for AI generation parameters.
   * Default: undefined (uses profile preset values for temperature, calculated values for maxTokens)
   */
  overrides?: {
    /**
     * Temperature for text generation (0-2) (optional).
     * Lower values make output more deterministic, higher values more creative.
     * Default: Profile-specific preset values:
     * - cleaning: 0 (all profiles)
     * - handout: 0 (lecture profile only)
     * - summary: 0.2 (lecture), 0.3 (meeting), 0.3 (other)
     */
    temperature?: number;
    /**
     * Maximum tokens in the generated output (optional).
     * If not specified, calculated dynamically based on input length and step type:
     * - cleaning: inputTokens * 2
     * - handout: inputTokens * 1.5
     * - summary: summaryWordCount * 1.3 (default wordCount: 1000)
     */
    maxTokens?: number;
  };
}

/**
 * AI configuration for text processing steps.
 */
export interface AiConfig {
  /**
   * Provider pool containing API keys for all providers that may be used (required).
   * At least one provider must be configured.
   */
  providers: AiProviderPool;
  /**
   * Default provider, model, and overrides to use for all steps (optional).
   * Used when a step doesn't have a specific override.
   * Default: { provider: "openai", model: "gpt-5-mini", overrides: undefined }
   */
  default?: StepAiConfig;
  /**
   * Optional per-step overrides.
   * Each step can override provider, model, or overrides.
   * Default: undefined (all steps use ai.default, or OpenAI gpt-5-mini if ai.default is not provided)
   */
  steps?: {
    /**
     * Override configuration for cleaning step (optional).
     * Default: undefined (uses ai.default, or OpenAI gpt-5-mini if ai.default is not provided)
     */
    cleaning?: Partial<StepAiConfig>;
    /**
     * Override configuration for handout step (optional).
     * Default: undefined (uses ai.default, or OpenAI gpt-5-mini if ai.default is not provided)
     */
    handout?: Partial<StepAiConfig>;
    /**
     * Override configuration for summary step (optional).
     * Default: undefined (uses ai.default, or OpenAI gpt-5-mini if ai.default is not provided)
     */
    summary?: Partial<StepAiConfig>;
  };
}

/**
 * Main pipeline configuration interface.
 * Defines all settings for the spoken-to-text processing pipeline.
 */
export interface PipelineConfig {
  /**
   * Profile that determines processing behavior, prompts, and available steps (required).
   * Lecture profile includes handout generation; meeting/other profiles skip it.
   */
  profile: SupportedProfile;

  /**
   * Language configuration for input and output (required).
   */
  language: {
    /**
     * Language code for the input audio (e.g., "it", "en", "es") (required).
     * Used by ASR step for transcription.
     * Must be a valid Whisper language code.
     */
    input: string;
    /**
     * Language code for all output text (e.g., "it", "en", "es") (required).
     * Used by AI steps (cleaning, handout, summary) to ensure output is in the specified language.
     */
    output: string;
  };

  /**
   * Logging configuration (required).
   */
  logging: {
    /**
     * Minimum log level to display (required).
     * - "error": Only errors
     * - "warn": Warnings and errors
     * - "info": Informational messages, warnings, and errors
     * - "debug": All messages including debug details
     */
    level: "error" | "warn" | "info" | "debug";
    /**
     * If true, logs are displayed in single-line format (required).
     * If false, logs use multi-line format with better readability.
     */
    singleLine: boolean;
  };

  /**
   * File system paths configuration (required).
   */
  paths: {
    /**
     * Directory containing input audio files (.wav format) (required).
     * Files are processed in alphabetical order.
     */
    inputDir: string;
    /**
     * Base output directory where all pipeline outputs are written (required).
     * All outputs (transcripts, cleaned files, handouts, summaries) go directly here (no subfolders).
     * If `output.addTimestamp` is true, a timestamp suffix is appended.
     */
    outputDir: string;
  };

  /**
   * Optional output configuration.
   * Default: undefined (no output configuration applied)
   */
  output?: {
    /**
     * If true, appends a timestamp suffix (yyyyMMddHHmmss) to outputDir (optional).
     * Example: "output" becomes "output_20250125143000"
     * Default: false
     */
    addTimestamp?: boolean;
    /**
     * Target word count for summary generation (optional).
     * The AI will aim to produce summaries approximately this length.
     * Default: 1000 words
     */
    summaryWordCount?: number;
  };

  /**
   * ASR (Automatic Speech Recognition) configuration (required).
   */
  asr: {
    /** ASR provider to use (required, must be "whisper") */
    provider: SupportedAsrProvider;
    /** Whisper ASR specific configuration (required) */
    whisper: {
      /**
       * URL of the Whisper ASR server endpoint (required).
       * Example: "http://localhost:9000/asr"
       */
      serverUrl: string;
      /**
       * ASR task type (optional).
       * - "transcribe": Transcribe audio to text in the same language
       * - "translate": Transcribe and translate to English
       * Default: "transcribe" (from profile preset)
       */
      task?: "transcribe" | "translate";
      /**
       * Output format for transcriptions (optional).
       * - "txt": Plain text
       * - "json": JSON format
       * - "srt": SubRip subtitle format
       * - "vtt": WebVTT subtitle format
       * - "tsv": Tab-separated values
       * Default: "txt" (from profile preset)
       */
      outputFormat?: "txt" | "json" | "srt" | "vtt" | "tsv";
      /**
       * Temperature for ASR decoding (0-1) (optional).
       * Lower values make transcription more deterministic.
       * Default: Profile-specific preset values:
       * - lecture: 0
       * - meeting: 0.2
       * - other: 0
       */
      temperature?: number;
      /**
       * Beam size for beam search decoding (optional).
       * Higher values improve accuracy but increase processing time.
       * Default: Profile-specific preset values:
       * - lecture: 5
       * - meeting: 3
       * - other: 5
       */
      beamSize?: number;
      /**
       * Number of candidates to consider during decoding (optional).
       * Default: Profile-specific preset values:
       * - lecture: 5
       * - meeting: 3
       * - other: 5
       */
      bestOf?: number;

      /**
       * Voice Activity Detection (VAD) configuration (optional).
       * VAD helps identify speech segments and filter out silence/noise.
       * Default: If not provided, uses profile preset defaults with VAD enabled:
       * - lecture: enabled=true, threshold=0.45, minSilenceMs=700, maxSpeechS=60
       * - meeting: enabled=true, threshold=0.6, minSilenceMs=500, maxSpeechS=30
       * - other: enabled=true, threshold=0.5, minSilenceMs=600, maxSpeechS=45
       */
      vad?: {
        /** Enable or disable VAD processing (required if vad is provided) */
        enabled: boolean;
        /**
         * VAD threshold (0-1) (optional).
         * Higher values require stronger signal to be considered speech.
         * Default: Profile-specific preset values:
         * - lecture: 0.45
         * - meeting: 0.6
         * - other: 0.5
         */
        threshold?: number;
        /**
         * Minimum silence duration in milliseconds before splitting segments (optional).
         * Default: Profile-specific preset values:
         * - lecture: 700
         * - meeting: 500
         * - other: 600
         */
        minSilenceMs?: number;
        /**
         * Maximum speech segment duration in seconds (optional).
         * Longer segments are split automatically.
         * Default: Profile-specific preset values:
         * - lecture: 60
         * - meeting: 30
         * - other: 45
         */
        maxSpeechS?: number;
      };

      /**
       * Request timeout in milliseconds for each audio file transcription (optional).
       * Default: undefined (uses Whisper server default timeout)
       */
      requestTimeoutMs?: number;
    };
  };

  /**
   * AI provider configuration for text processing steps (required).
   * Supports provider pool, default configuration, and per-step overrides.
   */
  ai: AiConfig;

  /**
   * Optional context configuration for improving AI processing.
   * Default: undefined (no context files are loaded)
   */
  context?: {
    /**
     * Array of file paths containing reference text (.txt or .md files) (optional).
     * These files are provided to AI steps as reference-only context to improve
     * terminological accuracy and theoretical coherence.
     * Content is NOT modified or repeated in outputs.
     * Default: undefined (if context is provided but textSources is not, no context is used)
     */
    textSources?: string[];
  };

  /**
   * Profile-specific prompt configurations (required).
   * Each profile defines custom prompts for its supported steps.
   * Prompts can override or extend the default profile presets.
   */
  profiles: {
    /**
     * Lecture profile configuration (required).
     * Includes prompts for cleaning, handout generation, and summary.
     */
    lecture: {
      prompts: {
        /** System prompt for cleaning lecture transcripts (required) */
        cleaning: string;
        /** System prompt for generating handouts from cleaned transcripts (required) */
        handout: string;
        /** System prompt for generating summaries (required) */
        summary: string;
      };
    };
    /**
     * Meeting profile configuration (required).
     * Includes prompts for cleaning and summary (no handout step).
     */
    meeting: {
      prompts: {
        /** System prompt for cleaning meeting transcripts (required) */
        cleaning: string;
        /** System prompt for generating summaries (required) */
        summary: string;
      };
    };
    /**
     * Other profile configuration (required).
     * General-purpose prompts for cleaning and summary.
     */
    other: {
      prompts: {
        /** System prompt for cleaning general transcripts (required) */
        cleaning: string;
        /** System prompt for generating summaries (required) */
        summary: string;
      };
    };
  };
}
