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
     * - summary: summaryWordCount * 1.3 (wordCount calculated dynamically if not set)
     */
    maxTokens?: number;
  };
}

/**
 * AI configuration for text processing steps.
 */
export interface AiConfig {
  /**
   * Provider pool containing API keys for all providers that may be used (optional).
   * At least one provider must be configured when the config is loaded.
   * Default: {}
   */
  providers?: AiProviderPool;
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
 * Only `profile` is required; all other fields are optional and will be filled with defaults.
 */
export interface PipelineConfig {
  /**
   * Profile that determines processing behavior, prompts, and available steps (required).
   * Lecture profile includes handout generation; meeting/other profiles skip it.
   */
  profile: SupportedProfile;

  /**
   * Language configuration for input and output (optional).
   * Default: { input: "en", output: "en" }
   */
  language?: {
    /**
     * Language code for the input audio (e.g., "it", "en", "es") (optional).
     * Used by ASR step for transcription.
     * Must be a valid Whisper language code.
     * Default: "en"
     */
    input?: string;
    /**
     * Language code for all output text (e.g., "it", "en", "es") (optional).
     * Used by AI steps (cleaning, handout, summary) to ensure output is in the specified language.
     * Default: "en"
     */
    output?: string;
  };

  /**
   * Logging configuration (optional).
   * Default: { level: "info", singleLine: false }
   */
  logging?: {
    /**
     * Minimum log level to display (optional).
     * - "error": Only errors
     * - "warn": Warnings and errors
     * - "info": Informational messages, warnings, and errors
     * - "debug": All messages including debug details
     * Default: "info"
     */
    level?: "error" | "warn" | "info" | "debug";
    /**
     * If true, logs are displayed in single-line format (optional).
     * If false, logs use multi-line format with better readability.
     * Default: false
     */
    singleLine?: boolean;
  };

  /**
   * File system paths configuration (optional).
   * Default: { inputDir: "./input", outputDir: "./output" }
   */
  paths?: {
    /**
     * Directory containing input audio files (.wav format) (optional).
     * Files are processed in alphabetical order.
     * Default: "./input"
     */
    inputDir?: string;
    /**
     * Base output directory where all pipeline outputs are written (optional).
     * All outputs (transcripts, cleaned files, handouts, summaries) go directly here (no subfolders).
     * If `output.addTimestamp` is true, a timestamp suffix is appended.
     * Default: "./output"
     */
    outputDir?: string;
  };

  /**
   * Optional output configuration.
   * Default: { addTimestamp: false, summaryWordCount: undefined }
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
     * If provided, this value is used as a static override for summary length.
     * If not provided, the word count is calculated dynamically based on:
     * - Input content length
     * - Profile type (lecture/meeting/other)
     * - Input type (handout vs. transcript)
     * 
     * Dynamic calculation uses profile-specific compression ratios:
     * - Lecture: 10-15% (handout already condensed)
     * - Meeting: 50% (preserves more detail)
     * - Other: 50% (preserves more detail)
     * 
     * The calculated value is bounded between 200 (minimum) and 5000 (maximum) words.
     * Default: undefined (uses dynamic calculation)
     */
    summaryWordCount?: number;
  };

  /**
   * ASR (Automatic Speech Recognition) configuration (optional).
   * Default: Profile-specific values (see config.defaults.ts)
   */
  asr?: {
    /** ASR provider to use (optional, must be "whisper") */
    provider?: SupportedAsrProvider;
    /** Whisper ASR specific configuration (optional) */
    whisper?: {
      /**
       * URL of the Whisper ASR server endpoint (optional).
       * Example: "http://localhost:9000/asr"
       * Default: "http://localhost:9000/asr"
       */
      serverUrl?: string;
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
   * AI provider configuration for text processing steps (optional).
   * Supports provider pool, default configuration, and per-step overrides.
   * Default: { providers: {}, default: { provider: "openai", model: "gpt-5-mini" } }
   */
  ai?: AiConfig;

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
   * Profile-specific prompt configurations (optional).
   * Each profile defines custom prompts for its supported steps.
   * Prompts can override or extend the default profile presets.
   * If not provided, uses prompts from profilePresets.ts
   */
  profiles?: {
    /**
     * Lecture profile configuration (optional).
     * Includes prompts for cleaning, handout generation, and summary.
     */
    lecture?: {
      prompts?: {
        /** System prompt for cleaning lecture transcripts (optional) */
        cleaning?: string;
        /** System prompt for generating handouts from cleaned transcripts (optional) */
        handout?: string;
        /** System prompt for generating summaries (optional) */
        summary?: string;
      };
    };
    /**
     * Meeting profile configuration (optional).
     * Includes prompts for cleaning and summary (no handout step).
     */
    meeting?: {
      prompts?: {
        /** System prompt for cleaning meeting transcripts (optional) */
        cleaning?: string;
        /** System prompt for generating summaries (optional) */
        summary?: string;
      };
    };
    /**
     * Other profile configuration (optional).
     * General-purpose prompts for cleaning and summary.
     */
    other?: {
      prompts?: {
        /** System prompt for cleaning general transcripts (optional) */
        cleaning?: string;
        /** System prompt for generating summaries (optional) */
        summary?: string;
      };
    };
  };
}
