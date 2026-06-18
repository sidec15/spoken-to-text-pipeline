/**
 * Supported pipeline profiles. All profiles use the same steps (cleaning, handout, summary);
 * profile only affects default prompts and ASR defaults.
 * - "lecture": Optimized for educational lectures
 * - "meeting": Optimized for meeting transcripts (decisions, action items)
 * - "other": General-purpose transcription and cleaning
 */
export type SupportedProfile = "lecture" | "meeting" | "other";

/**
 * Predefined step labels in English. Used for the ***Step*** line in output headers.
 * Localized via AI when language.output is not English.
 */
export type OutputStepLabel =
  | "Lecture Handout"
  | "Meeting Handout"
  | "Handout"
  | "Lecture Summary"
  | "Meeting Summary"
  | "Summary"
  | "Cleaned transcript"
  | "Raw transcript"
  ;

/**
 * Supported AI providers for text processing steps (cleaning, handout, summary).
 */
export type SupportedAiProvider = "openai" | "deepseek" | "ollama";

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
    /** OpenAI API key (required if openai provider is configured). Can be omitted if SPOKEN_TO_TEXT_OPENAI_API_KEY is set. */
    apiKey: string;
    /**
     * Per-request timeout in milliseconds for synchronous Responses API calls (optional).
     * The OpenAI SDK default is 10 minutes, which is too short for a large single-pass
     * handout merge (all drafts concatenated). Raise this for long sessions.
     * Default: 1800000 (30 minutes).
     */
    requestTimeoutMs?: number;
  };
  /**
   * DeepSeek provider configuration (optional).
   * Default: undefined (DeepSeek provider not available)
   */
  deepseek?: {
    /** DeepSeek API key (required if deepseek provider is configured). Can be omitted if SPOKEN_TO_TEXT_DEEPSEEK_API_KEY is set. */
    apiKey: string;
  };
  /**
   * Ollama provider configuration (optional).
   * Ollama runs locally and does not require an API key.
   * Default: undefined (Ollama provider not available)
   */
  ollama?: {
    /**
     * Ollama server base URL (optional).
     * Default: "http://localhost:11434/v1"
     */
    baseUrl?: string;
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
     * - handout: 0 (all profiles)
     * - summary: 0.2 (lecture), 0.3 (meeting), 0.3 (other)
     */
    temperature?: number;
    /**
     * Maximum tokens in the generated output (optional).
     * If not specified, calculated dynamically based on input length and step type:
     * - cleaning: inputTokens * 2
     * - handout: not used (no maxTokens limit)
     * - summary: summaryWordCount * 1.3 (wordCount calculated dynamically if not set)
     */
    maxTokens?: number;
  };
  /**
   * Execution mode for AI generation (optional).
   * - "sync": synchronous Responses API call (default).
   * - "batch": OpenAI Batch API (~50% cheaper, async overnight turnaround).
   *   Requires provider "openai".
   * Default: "sync"
   */
  execution?: "sync" | "batch";
}

/**
 * Step configuration.
 * Defines enabled status, optional prompt override, and AI configuration for a step.
 */
export interface StepConfig {
  /**
   * Enable or disable the step (optional).
   * If false, the step will be skipped during pipeline execution.
   * Default: true (step is enabled)
   */
  enabled?: boolean;
  /**
   * Inline system prompt override (optional).
   * Takes precedence over promptFile. If set, used instead of the profile default prompt.
   */
  prompt?: string;
  /**
   * Path to a text or markdown file containing the system prompt (optional).
   * Resolved relative to the config file directory. Used only when prompt is not set.
   */
  promptFile?: string;
  /**
   * AI configuration for this step (optional).
   * If not provided, uses ai.default or OpenAI gpt-5-mini as fallback.
   */
  aiConfig?: Partial<StepAiConfig>;
}

/**
 * Handout step configuration.
 * Uses the same structure as StepConfig (prompt, promptFile) for consistency.
 */
export type HandoutStepConfig = StepConfig;

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
   * Batch API tuning (optional). Used only by steps whose execution is "batch".
   * Default: { pollIntervalMs: 30000, maxWaitMs: undefined (wait indefinitely) }
   */
  batch?: {
    /** Poll interval in milliseconds while auto-watching a batch job. Default: 30000. */
    pollIntervalMs?: number;
    /** Max wall-clock wait in ms before leaving the job pending. Default: undefined (wait indefinitely). */
    maxWaitMs?: number;
  };
}

/**
 * Main pipeline configuration interface.
 * Defines all settings for the spoken-to-text processing pipeline.
 * Only `profile` is required; all other fields are optional and will be filled with defaults.
 */
export interface PipelineConfig {
  /**
   * Title of the pipeline (optional).
   * Default: undefined
   */
  title?: string;

  /**
   * Author(s) of the lecture, meeting or other content (optional).
   * Default: undefined
   */
  authors?: string[];

  /**
   * Date of the lecture, meeting or other content (optional).
   * From JSON config this is a string (e.g. "07 febbraio 2026"); programmatic use may pass Date.
   * Default: undefined
   */
  date?: string | Date;

  /**
   * Profile that determines default prompts and ASR defaults (required).
   * All profiles use the same steps (cleaning, handout, summary).
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
     * Directory containing input audio files (.wav or .mp3 format) (optional).
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
    /**
     * Whether to drop the auxiliary `.cache` folder (batch state, handout draft
     * fragments, and other progress artifacts) after a SUCCESSFUL run (optional).
     * - true: remove `<outputDir>/.cache` once the pipeline finishes successfully.
     * - false: keep it (useful for debugging/inspection).
     * On failure the cache is always kept so a re-run can resume.
     * Default: true
     */
    dropCache?: boolean;
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
   * Supports provider pool and default configuration.
   * Default: { providers: {}, default: { provider: "openai", model: "gpt-5.2" } }
   */
  ai?: AiConfig;

  /**
   * Step configuration for pipeline steps (optional).
   * Allows enabling/disabling steps and configuring AI settings per step.
   * Default: undefined (all steps enabled, using ai.default or OpenAI gpt-5.2)
   */
  steps?: {
    /**
     * Configuration for ASR (transcription) step (optional).
     * Only enabled can be set; ASR uses config.asr for provider/settings.
     */
    asr?: { enabled?: boolean };
    /**
     * Configuration for cleaning step (optional).
     */
    cleaning?: StepConfig;
    /**
     * Configuration for handout step (optional).
     */
    handout?: HandoutStepConfig;
    /**
     * Configuration for summary step (optional).
     */
    summary?: StepConfig;
  };

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
   * Directory of the config file (optional, set by loadConfig when loading from file).
   * Used to resolve relative paths such as steps.*.promptFile. Not part of user JSON.
   */
  configDir?: string;
}
