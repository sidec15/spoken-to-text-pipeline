# Configuration Reference

The pipeline is configured via a JSON file (default: `pipeline.config.json`). This document provides detailed documentation for all configuration options.

## Table of Contents

- [Configuration File Structure](#configuration-file-structure)
- [Configuration Defaults](#configuration-defaults)
- [Profiles](#profiles)
- [Language Configuration](#language-configuration)
- [Logging Configuration](#logging-configuration)
- [Paths Configuration](#paths-configuration)
- [Input Audio Files](#input-audio-files)
- [Context Materials](#context-materials)
- [AI Provider Configuration](#ai-provider-configuration)
  - [Provider Pool (`providers`)](#provider-pool-providers)
  - [Default Configuration (`default`)](#default-configuration-default)
  - [Temperature Defaults](#temperature-defaults)
  - [MaxTokens Calculation](#maxtokens-calculation)
- [Step Configuration](#step-configuration-steps)
- [Output Configuration](#output-configuration)
- [ASR Configuration](#asr-configuration)
  - [Whisper Configuration](#whisper-configuration)
  - [Voice Activity Detection (VAD)](#voice-activity-detection-vad)
- [Profile Prompts Configuration](#profile-prompts-configuration)
- [Configuration Parameters Summary](#configuration-parameters-summary)

## Configuration File Structure

The configuration file is a JSON object with the following top-level structure:

```json
{
  "profile": "lecture",
  "language": { ... },
  "logging": { ... },
  "paths": { ... },
  "output": { ... },
  "asr": { ... },
  "ai": { ... },
  "steps": { ... },
  "context": { ... },
  "profiles": { ... }
}
```

Only the `profile` field is required. All other fields are optional and will be filled with sensible defaults if not provided. **Important:** At least one AI provider (OpenAI or DeepSeek) with its required API key must be configured in `ai.providers` for the pipeline to function. The configuration is validated on load, and errors will indicate missing or invalid fields.

## Configuration Defaults

When fields are not provided in the configuration file, the following defaults are applied:

- **`language`**: `{ input: "en", output: "en" }`
- **`logging`**: `{ level: "info", singleLine: false }`
- **`paths`**: `{ inputDir: "./input", outputDir: "./output" }`
- **`output`**: `{ addTimestamp: false }` (summaryWordCount calculated dynamically if not set)
- **`asr.provider`**: `"whisper"`
- **`asr.whisper.serverUrl`**: `"http://localhost:9000/asr"`
- **`asr.whisper.task`**, **`asr.whisper.outputFormat`**, **`asr.whisper.temperature`**, **`asr.whisper.beamSize`**, **`asr.whisper.bestOf`**, and **`asr.whisper.vad`**: Profile-specific defaults (see [Profiles](#profiles) section)
- **`ai.providers`**: `{}` (empty by default, but **at least one provider with its API key must be configured** - this is required for the pipeline to work)
- **`ai.default`**: `{ provider: "openai", model: "gpt-5-mini" }`
- **`context`**: `undefined` (no context files)
- **`profiles`**: `undefined` (uses built-in prompts from profilePresets.ts)

**Note:** Profile-specific ASR defaults are automatically applied based on the selected `profile`:
- **Lecture**: `task="transcribe"`, `outputFormat="txt"`, `temperature=0`, `beamSize=5`, `bestOf=5`, `vad={enabled: true, threshold: 0.45, minSilenceMs: 700, maxSpeechS: 60}`
- **Meeting**: `task="transcribe"`, `outputFormat="txt"`, `temperature=0.2`, `beamSize=3`, `bestOf=3`, `vad={enabled: true, threshold: 0.6, minSilenceMs: 500, maxSpeechS: 30}`
- **Other**: `task="transcribe"`, `outputFormat="txt"`, `temperature=0`, `beamSize=5`, `bestOf=5`, `vad={enabled: true, threshold: 0.5, minSilenceMs: 600, maxSpeechS: 45}`

## Profiles

The `profile` field determines which processing profile to use. Each profile has different default prompts, ASR settings, and available steps.

**Supported profiles:**

- **`"lecture"`** - Optimized for educational lectures
  - Includes handout generation step
  - Prompts focus on preserving educational content and structure
  - Default ASR settings: temperature=0, beamSize=5, bestOf=5
  - VAD enabled with threshold=0.45, minSilenceMs=700, maxSpeechS=60
  - **Expected outputs:**
    - Raw transcripts (`.txt` files) from ASR step
    - Cleaned transcripts (`.md` files) from cleaning step
    - Structured handout (`handout.md`) with table of contents and organized sections
    - Summary (`summary.md`) with key concepts and theoretical frameworks

- **`"meeting"`** - Optimized for meeting transcripts
  - Skips handout generation
  - Prompts focus on decisions, action items, and key discussion points
  - Default ASR settings: temperature=0.2, beamSize=3, bestOf=3
  - VAD enabled with threshold=0.6, minSilenceMs=500, maxSpeechS=30
  - **Expected outputs:**
    - Raw transcripts (`.txt` files) from ASR step
    - Cleaned transcripts (`.md` files) from cleaning step
    - Summary (`summary.md`) with decisions, action items, and key discussion points

- **`"other"`** - General-purpose transcription
  - Skips handout generation
  - Generic prompts for cleaning and summarization
  - Default ASR settings: temperature=0, beamSize=5, bestOf=5
  - VAD enabled with threshold=0.5, minSilenceMs=600, maxSpeechS=45
  - **Expected outputs:**
    - Raw transcripts (`.txt` files) from ASR step
    - Cleaned transcripts (`.md` files) from cleaning step
    - Summary (`summary.md`) with main ideas and key information

**Example:**

```json
{
  "profile": "lecture"
}
```

## Language Configuration

The `language` object specifies input and output languages.

```json
{
  "language": {
    "input": "it",
    "output": "it"
  }
}
```

- **`input`** (optional): Language code for the input audio (e.g., `"it"`, `"en"`, `"es"`, `"fr"`, `"de"`). Must be a valid Whisper language code. Used by the ASR step for transcription. Default: `"en"`

- **`output`** (optional): Language code for all output text. Used by AI steps (cleaning, handout, summary) to ensure output is in the specified language. The AI will be instructed to write all content in this language. Default: `"en"`

**Common language codes:** `it` (Italian), `en` (English), `es` (Spanish), `fr` (French), `de` (German), `pt` (Portuguese), `ru` (Russian), `ja` (Japanese), `zh` (Chinese), `ko` (Korean).

## Logging Configuration

The `logging` object controls log output behavior.

```json
{
  "logging": {
    "level": "info",
    "singleLine": true
  }
}
```

- **`level`** (optional): Minimum log level to display. Default: `"info"`
  - `"error"` - Only errors
  - `"warn"` - Warnings and errors
  - `"info"` - Informational messages, warnings, and errors (recommended)
  - `"debug"` - All messages including debug details

- **`singleLine`** (optional): Log format. Default: `false`
  - `true` - Single-line format (compact, good for CI/CD)
  - `false` - Multi-line format (more readable, better for development)

## Paths Configuration

The `paths` object defines input and output directories.

```json
{
  "paths": {
    "inputDir": "./audio",
    "outputDir": "./output"
  }
}
```

- **`inputDir`** (optional): Directory containing input audio files. Only `.wav` files are processed. Files are processed in alphabetical order. Use absolute paths or paths relative to the current working directory. Default: `"./input"`

- **`outputDir`** (optional): Base output directory where all pipeline outputs are written. All outputs (raw transcripts, cleaned files, handouts, summaries) are written directly to this directory (no subfolders). If `output.addTimestamp` is `true`, a timestamp suffix (`yyyyMMddHHmmss`) is appended to this path. Use absolute paths or paths relative to the current working directory. Default: `"./output"`

**Example with timestamp:**

If `outputDir` is `"./output"` and `output.addTimestamp` is `true`, the actual output directory becomes `"./output_20250125143000"`.

## Input Audio Files

Audio files must be in `.wav` format and placed in the `paths.inputDir` directory. The pipeline:

- Processes files in alphabetical order
- Skips files that don't end with `.wav` (case-insensitive)
- For each file, generates a corresponding output file with the same base name
- Example: `part-1.wav` → `part-1.txt` (raw transcript) → `part-1.md` (cleaned)

**Note:** File processing order

The pipeline processes files in **alphabetical order** (lexicographic sorting). For numeric sequences, use zero-padded numbers to ensure correct ordering:
- ❌ Without zero-padding: `part-1.wav`, `part-2.wav`, ..., `part-10.wav` → processes as: `part-1`, `part-10`, `part-2`, `part-3`, ... (incorrect numeric order)
- ✅ With zero-padding: `part-01.wav`, `part-02.wav`, ..., `part-10.wav` → processes as: `part-01`, `part-02`, `part-03`, ..., `part-10` (correct numeric order)

**File naming recommendations:**

- Use zero-padded numbers (e.g., `part-01.wav`, `part-02.wav`, `part-03.wav`) for correct numeric ordering
- Include numeric prefixes for proper ordering
- Avoid special characters that might cause filesystem issues

## Context Materials

The optional `context` object allows you to provide reference materials to improve AI processing quality.

**Important:** The pipeline **automatically maintains consistency** within a single run by processing audio files sequentially and using previously processed transcripts as context. You do **not** need to provide transcripts from the current run as context files.

```json
{
  "context": {
    "textSources": [
      "./reference/course-materials.md",
      "./reference/glossary.txt"
    ]
  }
}
```

- **`textSources`** (optional): Array of file paths containing reference text. Files must be `.txt` or `.md` format. Default: `undefined` (no context files loaded)

**How context is used:**

- Context files are loaded and provided to **all AI processing steps** (cleaning, handout, summary) as reference-only material
- The AI uses context during processing to improve terminological accuracy and theoretical coherence
- Context content is **NOT** modified, repeated, or directly copied into outputs
- Context helps the AI understand domain-specific terms and maintain consistency across all processing steps
- Context is used in:
  - **Cleaning step**: Improves terminological accuracy during transcript cleaning
  - **Handout step**: Ensures consistent terminology and theoretical coherence in handout generation
  - **Summary step**: Maintains accuracy and consistency when summarizing content

**When to use context files:**

- **Course materials or textbooks** for lecture processing (to improve terminological accuracy)
- **Glossaries or terminology lists** (to ensure consistent terminology)
- **Transcripts from previous runs** (to maintain consistency across different processing sessions - these should **not** include transcripts from the audio files being processed in the current run)
- **Reference documents** for meeting context (to provide background information)

**Note:** Transcripts from files being processed in the current run are automatically used as context for subsequent files within the same run. Only provide context files if you want to include transcripts from previous runs or external reference materials.

**Example:**

```json
{
  "context": {
    "textSources": [
      "./materials/textbook-chapter-1.md",
      "./materials/terminology.txt"
    ]
  }
}
```

## AI Provider Configuration

The `ai` object configures AI providers and models for text processing steps (cleaning, handout, summary).

```json
{
  "ai": {
    "providers": {
      "openai": {
        "apiKey": "sk-..."
      },
      "deepseek": {
        "apiKey": "sk-..."
      }
    },
    "default": {
      "provider": "openai",
      "model": "gpt-4o-mini"
    }
  },
  "steps": {
    "cleaning": {
      "enabled": true,
      "aiConfig": {
        "provider": "openai",
        "model": "gpt-4o-mini"
      }
    },
    "summary": {
      "enabled": true,
      "aiConfig": {
        "provider": "deepseek",
        "model": "deepseek-chat",
        "overrides": {
          "temperature": 0.3
        }
      }
    }
  }
}
```

### Provider Pool (`providers`)

The `providers` object contains API keys for all providers that may be used. **At least one provider with its API key must be configured** - this is required for the pipeline to function. You can configure multiple providers and switch between them per step.

- **`openai`** (optional): OpenAI provider configuration
  - `apiKey` (required if `openai` is provided): Your OpenAI API key (starts with `sk-`)

- **`deepseek`** (optional): DeepSeek provider configuration
  - `apiKey` (required if `deepseek` is provided): Your DeepSeek API key

**Important:** The `providers` object cannot be empty. You must configure at least one provider (either `openai` or `deepseek`) with its corresponding `apiKey` for the pipeline to work.

**Example:**

```json
{
  "providers": {
    "openai": {
      "apiKey": "sk-proj-..."
    }
  }
}
```

### Default Configuration (`default`)

The `default` object specifies the provider, model, and optional overrides to use for all steps when a step doesn't have a specific override.

- **`provider`** (optional): AI provider to use (`"openai"` or `"deepseek"`). Default: `"openai"`
- **`model`** (optional): Model identifier (e.g., `"gpt-4o-mini"`, `"gpt-4o"`, `"deepseek-chat"`). Default: `"gpt-5-mini"`
- **`overrides`** (optional): Parameter overrides. Default: `undefined`
  - `temperature` (optional): Temperature for text generation (0-2). Default: profile-specific preset values (cleaning: 0, handout: 0, summary: 0.2-0.3 depending on profile)
  - `maxTokens` (optional): Maximum tokens in generated output. Default: calculated dynamically (cleaning: inputTokens * 2, handout: inputTokens * 1.5, summary: summaryWordCount * 1.3)

**Example:**

```json
{
  "default": {
    "provider": "openai",
    "model": "gpt-4o-mini",
    "overrides": {
      "temperature": 0.2
    }
  }
}
```

## Step Configuration

The optional `steps` object allows you to configure specific pipeline steps at the top level of the configuration.

- **`cleaning`** (optional): Configuration for cleaning step
- **`handout`** (optional): Configuration for handout step (lecture profile only)
- **`summary`** (optional): Configuration for summary step

Each step configuration can specify:
- `enabled` (optional): Enable or disable the step. If `false`, the step will be skipped. Default: `true` (step is enabled)
- `aiConfig` (optional): AI configuration for this step. If not provided, uses `ai.default` or OpenAI gpt-5-mini as fallback
  - `provider` (optional): Override provider. Default: uses `ai.default.provider` or `"openai"`
  - `model` (optional): Override model. Default: uses `ai.default.model` or `"gpt-5-mini"`
  - `overrides` (optional): Override temperature and/or maxTokens. Default: uses `ai.default.overrides` or profile-specific presets

**Example:**

```json
{
  "steps": {
    "cleaning": {
      "enabled": true,
      "aiConfig": {
        "provider": "openai",
        "model": "gpt-4o-mini"
      }
    },
    "summary": {
      "enabled": true,
      "aiConfig": {
        "provider": "deepseek",
        "model": "deepseek-chat",
        "overrides": {
          "temperature": 0.3,
          "maxTokens": 2000
        }
      }
    }
  }
}
```

**Disabling steps:**

You can disable specific steps by setting `enabled: false`:

```json
{
  "steps": {
    "handout": {
      "enabled": false
    },
    "summary": {
      "enabled": false
    }
  }
}
```

When a step is disabled, it will be skipped during pipeline execution. This is useful when you only want to run specific steps (e.g., only transcription and cleaning, skipping handout and summary generation).

**Note:** The `steps` configuration is at the top level of the configuration file, not nested under `ai`. This separates step control (enabled/disabled) from AI provider configuration.

### Temperature Defaults

If not specified, temperature defaults to profile-specific preset values:

- **Cleaning**: `0` (all profiles) - Deterministic cleaning
- **Handout**: `0` (lecture profile) - Deterministic structure
- **Summary**: 
  - `0.2` (lecture profile)
  - `0.3` (meeting profile)
  - `0.3` (other profile)

### MaxTokens Calculation

If `maxTokens` is not specified, it's calculated dynamically:

- **Cleaning**: `inputTokens * 2` - Output typically similar to input
- **Handout**: `inputTokens * 1.5` - Output similar or slightly longer
- **Summary**: `summaryWordCount * 1.3` - Based on target word count (calculated dynamically if not set)

## Output Configuration

The optional `output` object controls output behavior.

```json
{
  "output": {
    "addTimestamp": false
  }
}
```

- **`addTimestamp`** (optional): If `true`, appends a timestamp suffix (`yyyyMMddHHmmss`) to `outputDir`. Default: `false`
  - Example: `"output"` becomes `"output_20250125143000"`
  - Useful for creating timestamped output directories for each run

- **`summaryWordCount`** (optional): Static override for target word count in summary generation. 
  - **If not provided**: Word count is calculated **dynamically** based on:
    - Input content length (characters/words)
    - Profile type (`lecture`, `meeting`, or `other`)
    - Input type (handout vs. transcript)
    
    Dynamic calculation uses profile-specific compression ratios:
    - **Lecture**: 10-15% of input (handout already condensed)
    - **Meeting**: 50% of input (preserves more detail)
    - **Other**: 50% of input (preserves more detail)
    
    The calculated value is bounded between **200** (minimum) and **5000** (maximum) words.
    
  - **If provided**: Used as a static override, disabling dynamic calculation
  - Used to calculate `maxTokens` if not explicitly set
  - Tolerance: approximately ±25%

**Examples:**

Dynamic calculation (default):
```json
{
  "output": {
    "addTimestamp": false
  }
}
```

Static override:
```json
{
  "output": {
    "addTimestamp": true,
    "summaryWordCount": 1500
  }
}
```

## ASR Configuration

The `asr` object configures the Automatic Speech Recognition system (Whisper).

```json
{
  "asr": {
    "provider": "whisper",
    "whisper": {
      "serverUrl": "http://localhost:9000/asr",
      "task": "transcribe",
      "outputFormat": "txt",
      "temperature": 0,
      "beamSize": 5,
      "bestOf": 5,
      "vad": {
        "enabled": true,
        "threshold": 0.45,
        "minSilenceMs": 700,
        "maxSpeechS": 60
      },
      "requestTimeoutMs": 900000
    }
  }
}
```

- **`provider`** (optional): Must be `"whisper"`. Default: `"whisper"`

### Whisper Configuration

- **`serverUrl`** (optional): URL of the Whisper ASR server endpoint (e.g., `"http://localhost:9000/asr"`). Default: `"http://localhost:9000/asr"`

- **`task`** (optional): ASR task type. Default: `"transcribe"` (profile-specific)
  - `"transcribe"` - Transcribe audio to text in the same language
  - `"translate"` - Transcribe and translate to English

- **`outputFormat`** (optional): Output format for transcriptions. Default: `"txt"` (profile-specific)
  - `"json"` - JSON format
  - `"srt"` - SubRip subtitle format
  - `"vtt"` - WebVTT subtitle format
  - `"tsv"` - Tab-separated values

- **`temperature`** (optional): Temperature for ASR decoding (0-1). Lower values make transcription more deterministic. Default: profile-specific (lecture: 0, meeting: 0.2, other: 0)

- **`beamSize`** (optional): Beam size for beam search decoding. Higher values improve accuracy but increase processing time. Default: profile-specific (lecture: 5, meeting: 3, other: 5)

- **`bestOf`** (optional): Number of candidates to consider during decoding. Default: profile-specific (lecture: 5, meeting: 3, other: 5)

### Voice Activity Detection (VAD)

The optional `vad` object configures Voice Activity Detection, which helps identify speech segments and filter out silence/noise. Requires `faster_whisper` engine.

```json
{
  "vad": {
    "enabled": true,
    "threshold": 0.45,
    "minSilenceMs": 700,
    "maxSpeechS": 60
  }
}
```

- **`enabled`** (optional if `vad` is provided): Enable or disable VAD processing. Default: `true` (profile-specific)

- **`threshold`** (optional): VAD threshold (0-1). Higher values require stronger signal to be considered speech. Default: profile-specific (lecture: 0.45, meeting: 0.6, other: 0.5)

- **`minSilenceMs`** (optional): Minimum silence duration in milliseconds before splitting segments. Default: profile-specific (lecture: 700, meeting: 500, other: 600)

- **`maxSpeechS`** (optional): Maximum speech segment duration in seconds. Longer segments are split automatically. Default: profile-specific (lecture: 60, meeting: 30, other: 45)

**Default VAD settings by profile:**

- **Lecture**: `enabled=true`, `threshold=0.45`, `minSilenceMs=700`, `maxSpeechS=60`
- **Meeting**: `enabled=true`, `threshold=0.6`, `minSilenceMs=500`, `maxSpeechS=30`
- **Other**: `enabled=true`, `threshold=0.5`, `minSilenceMs=600`, `maxSpeechS=45`

- **`requestTimeoutMs`** (optional): Request timeout in milliseconds for each audio file transcription. Default: `undefined` (uses Whisper server default timeout). Recommended: `900000` (15 minutes) for long audio files.

## Profile Prompts Configuration

The `profiles` object defines custom prompts for each profile. This section is required by the configuration schema, but if prompts are empty strings, the pipeline uses built-in default prompts optimized for each profile.

```json
{
  "profiles": {
    "lecture": {
      "prompts": {
        "cleaning": "",
        "handout": "",
        "summary": ""
      }
    },
    "meeting": {
      "prompts": {
        "cleaning": "",
        "summary": ""
      }
    },
    "other": {
      "prompts": {
        "cleaning": "",
        "summary": ""
      }
    }
  }
}
```

**Required prompts by profile:**

- **Lecture**: `cleaning`, `handout`, `summary`
- **Meeting**: `cleaning`, `summary`
- **Other**: `cleaning`, `summary`

**Using default prompts:**

To use the built-in default prompts (recommended), set all prompt strings to empty strings (`""`). The pipeline will use optimized prompts based on the selected profile.

**Customizing prompts:**

You can override default prompts by providing custom prompt text. Prompts are system prompts sent to the AI model and should clearly describe the task and desired output format.

**Example with custom prompts:**

```json
{
  "profiles": {
    "lecture": {
      "prompts": {
        "cleaning": "Clean and normalize the lecture transcript, preserving all educational content.",
        "handout": "Transform cleaned transcripts into a structured handout with table of contents.",
        "summary": "Create a concise summary of the handout, approximately 1000 words."
      }
    },
    "meeting": {
      "prompts": {
        "cleaning": "Clean the meeting transcript, preserving decisions and action items.",
        "summary": "Summarize the meeting, highlighting decisions and action items."
      }
    },
    "other": {
      "prompts": {
        "cleaning": "Clean and normalize the transcript.",
        "summary": "Create a summary of the content."
      }
    }
  }
}
```

See [Custom Prompts](advanced-topics.md#custom-prompts) in Advanced Topics for more details on prompt customization.

## Configuration Parameters Summary

The following table provides a quick reference for all configuration parameters:

| Parameter | Type | Required | Default | Allowed Values | Notes |
|-----------|------|----------|---------|----------------|-------|
| **`profile`** | `string` | Yes | - | `"lecture"`, `"meeting"`, `"other"` | Determines processing behavior and available steps |
| **`language`** | `object` | No | `{ input: "en", output: "en" }` | - | Language configuration |
| `language.input` | `string` | No | `"en"` | Valid Whisper language codes (`"it"`, `"en"`, `"es"`, `"fr"`, `"de"`, `"pt"`, `"ru"`, `"ja"`, `"zh"`, `"ko"`, etc.) | Input audio language |
| `language.output` | `string` | No | `"en"` | Valid language codes | Output text language |
| **`logging`** | `object` | No | `{ level: "info", singleLine: false }` | - | Logging configuration |
| `logging.level` | `string` | No | `"info"` | `"error"`, `"warn"`, `"info"`, `"debug"` | Minimum log level |
| `logging.singleLine` | `boolean` | No | `false` | `true`, `false` | Single-line vs multi-line format |
| **`paths`** | `object` | No | `{ inputDir: "./input", outputDir: "./output" }` | - | File system paths |
| `paths.inputDir` | `string` | No | `"./input"` | Valid directory path | Input audio directory |
| `paths.outputDir` | `string` | No | `"./output"` | Valid directory path | Output directory (timestamp suffix added if `output.addTimestamp` is true) |
| **`output`** | `object` | No | `{ addTimestamp: false, summaryWordCount: undefined }` | - | Output configuration |
| `output.addTimestamp` | `boolean` | No | `false` | `true`, `false` | Append timestamp to outputDir |
| `output.summaryWordCount` | `number` | No | `undefined` (dynamic) | Positive integer | Target word count for summaries (200-5000 range when calculated dynamically) |
| **`asr`** | `object` | No | Profile-specific | - | ASR configuration |
| `asr.provider` | `string` | No | `"whisper"` | `"whisper"` | ASR provider (currently only Whisper supported) |
| `asr.whisper` | `object` | No | Profile-specific | - | Whisper-specific configuration |
| `asr.whisper.serverUrl` | `string` | No | `"http://localhost:9000/asr"` | Valid URL | Whisper server endpoint |
| `asr.whisper.task` | `string` | No | `"transcribe"` (profile-specific) | `"transcribe"`, `"translate"` | ASR task type |
| `asr.whisper.outputFormat` | `string` | No | `"txt"` (profile-specific) | `"txt"`, `"json"`, `"srt"`, `"vtt"`, `"tsv"` | Output format |
| `asr.whisper.temperature` | `number` | No | Profile-specific (lecture: 0, meeting: 0.2, other: 0) | 0-1 | ASR decoding temperature |
| `asr.whisper.beamSize` | `number` | No | Profile-specific (lecture: 5, meeting: 3, other: 5) | Positive integer | Beam search size |
| `asr.whisper.bestOf` | `number` | No | Profile-specific (lecture: 5, meeting: 3, other: 5) | Positive integer | Number of candidates |
| `asr.whisper.vad` | `object` | No | Profile-specific (enabled: true) | - | Voice Activity Detection |
| `asr.whisper.vad.enabled` | `boolean` | No | `true` (profile-specific) | `true`, `false` | Enable VAD |
| `asr.whisper.vad.threshold` | `number` | No | Profile-specific (lecture: 0.45, meeting: 0.6, other: 0.5) | 0-1 | VAD threshold |
| `asr.whisper.vad.minSilenceMs` | `number` | No | Profile-specific (lecture: 700, meeting: 500, other: 600) | Positive integer | Min silence duration (ms) |
| `asr.whisper.vad.maxSpeechS` | `number` | No | Profile-specific (lecture: 60, meeting: 30, other: 45) | Positive integer | Max speech segment (seconds) |
| `asr.whisper.requestTimeoutMs` | `number` | No | `undefined` (server default) | Positive integer | Request timeout (ms), recommended: 900000 |
| **`ai`** | `object` | No | `{ providers: {}, default: { provider: "openai", model: "gpt-5-mini" } }` | - | AI provider configuration |
| `ai.providers` | `object` | ⚠️ No | `{}` | - | Provider pool (at least one provider with API key required) |
| `ai.providers.openai` | `object` | No | `undefined` | - | OpenAI provider config |
| `ai.providers.openai.apiKey` | `string` | ⚠️ No | - | Valid API key (starts with `sk-`) | OpenAI API key (required if openai provider is configured) |
| `ai.providers.deepseek` | `object` | No | `undefined` | - | DeepSeek provider config |
| `ai.providers.deepseek.apiKey` | `string` | ⚠️ No | - | Valid API key | DeepSeek API key (required if deepseek provider is configured) |
| `ai.default` | `object` | No | `{ provider: "openai", model: "gpt-5-mini" }` | - | Default AI configuration |
| `ai.default.provider` | `string` | No | `"openai"` | `"openai"`, `"deepseek"` | Default provider |
| `ai.default.model` | `string` | No | `"gpt-5-mini"` | Valid model identifier | Default model |
| `ai.default.overrides` | `object` | No | `undefined` | - | Default parameter overrides |
| `ai.default.overrides.temperature` | `number` | No | Profile-specific presets | 0-2 | Temperature override |
| `ai.default.overrides.maxTokens` | `number` | No | Calculated dynamically | Positive integer | Max tokens override |
| **`steps`** | `object` | No | `undefined` | - | Step configuration |
| `steps.cleaning` | `object` | No | `undefined` | - | Cleaning step configuration |
| `steps.cleaning.enabled` | `boolean` | No | `true` | `true`, `false` | Enable or disable cleaning step |
| `steps.cleaning.aiConfig` | `object` | No | Uses `ai.default` | - | AI configuration for cleaning step |
| `steps.cleaning.aiConfig.provider` | `string` | No | Uses `ai.default.provider` | `"openai"`, `"deepseek"` | Override provider |
| `steps.cleaning.aiConfig.model` | `string` | No | Uses `ai.default.model` | Valid model identifier | Override model |
| `steps.cleaning.aiConfig.overrides` | `object` | No | Uses `ai.default.overrides` | - | Override parameters |
| `steps.cleaning.aiConfig.overrides.temperature` | `number` | No | Profile-specific presets | 0-2 | Temperature override |
| `steps.cleaning.aiConfig.overrides.maxTokens` | `number` | No | Calculated dynamically | Positive integer | Max tokens override |
| `steps.handout` | `object` | No | `undefined` | - | Handout step configuration (lecture profile only) |
| `steps.handout.enabled` | `boolean` | No | `true` | `true`, `false` | Enable or disable handout step |
| `steps.handout.aiConfig` | `object` | No | Uses `ai.default` | - | AI configuration for handout step |
| `steps.handout.aiConfig.provider` | `string` | No | Uses `ai.default.provider` | `"openai"`, `"deepseek"` | Override provider |
| `steps.handout.aiConfig.model` | `string` | No | Uses `ai.default.model` | Valid model identifier | Override model |
| `steps.handout.aiConfig.overrides` | `object` | No | Uses `ai.default.overrides` | - | Override parameters |
| `steps.handout.aiConfig.overrides.temperature` | `number` | No | Profile-specific presets | 0-2 | Temperature override |
| `steps.handout.aiConfig.overrides.maxTokens` | `number` | No | Calculated dynamically | Positive integer | Max tokens override |
| `steps.summary` | `object` | No | `undefined` | - | Summary step configuration |
| `steps.summary.enabled` | `boolean` | No | `true` | `true`, `false` | Enable or disable summary step |
| `steps.summary.aiConfig` | `object` | No | Uses `ai.default` | - | AI configuration for summary step |
| `steps.summary.aiConfig.provider` | `string` | No | Uses `ai.default.provider` | `"openai"`, `"deepseek"` | Override provider |
| `steps.summary.aiConfig.model` | `string` | No | Uses `ai.default.model` | Valid model identifier | Override model |
| `steps.summary.aiConfig.overrides` | `object` | No | Uses `ai.default.overrides` | - | Override parameters |
| `steps.summary.aiConfig.overrides.temperature` | `number` | No | Profile-specific presets | 0-2 | Temperature override |
| `steps.summary.aiConfig.overrides.maxTokens` | `number` | No | Calculated dynamically | Positive integer | Max tokens override |
| **`context`** | `object` | No | `undefined` | - | Context materials |
| `context.textSources` | `string[]` | No | `undefined` | Array of file paths | Reference text files (.txt or .md) |
| **`profiles`** | `object` | No | `undefined` | - | Custom profile prompts |
| `profiles.lecture` | `object` | No | `undefined` | - | Lecture profile prompts |
| `profiles.lecture.prompts` | `object` | No | Uses built-in prompts | - | Custom prompts |
| `profiles.lecture.prompts.cleaning` | `string` | No | Built-in prompt | Any string (empty string uses default) | Cleaning prompt |
| `profiles.lecture.prompts.handout` | `string` | No | Built-in prompt | Any string (empty string uses default) | Handout prompt |
| `profiles.lecture.prompts.summary` | `string` | No | Built-in prompt | Any string (empty string uses default) | Summary prompt |
| `profiles.meeting` | `object` | No | `undefined` | - | Meeting profile prompts |
| `profiles.meeting.prompts` | `object` | No | Uses built-in prompts | - | Custom prompts |
| `profiles.meeting.prompts.cleaning` | `string` | No | Built-in prompt | Any string (empty string uses default) | Cleaning prompt |
| `profiles.meeting.prompts.summary` | `string` | No | Built-in prompt | Any string (empty string uses default) | Summary prompt |
| `profiles.other` | `object` | No | `undefined` | - | Other profile prompts |
| `profiles.other.prompts` | `object` | No | Uses built-in prompts | - | Custom prompts |
| `profiles.other.prompts.cleaning` | `string` | No | Built-in prompt | Any string (empty string uses default) | Cleaning prompt |
| `profiles.other.prompts.summary` | `string` | No | Built-in prompt | Any string (empty string uses default) | Summary prompt |

**Profile-Specific Defaults:**

| Parameter | Lecture | Meeting | Other |
|-----------|---------|---------|-------|
| `asr.whisper.temperature` | `0` | `0.2` | `0` |
| `asr.whisper.beamSize` | `5` | `3` | `5` |
| `asr.whisper.bestOf` | `5` | `3` | `5` |
| `asr.whisper.vad.enabled` | `true` | `true` | `true` |
| `asr.whisper.vad.threshold` | `0.45` | `0.6` | `0.5` |
| `asr.whisper.vad.minSilenceMs` | `700` | `500` | `600` |
| `asr.whisper.vad.maxSpeechS` | `60` | `30` | `45` |
| `ai.default.overrides.temperature` (cleaning) | `0` | `0` | `0` |
| `ai.default.overrides.temperature` (handout) | `0` | N/A | N/A |
| `ai.default.overrides.temperature` (summary) | `0.2` | `0.3` | `0.3` |

**Dynamic Defaults:**

- `output.summaryWordCount`: Calculated dynamically based on input length and profile (bounded 200-5000 words)
  - Lecture: 10-15% of input
  - Meeting: 50% of input
  - Other: 50% of input

- `ai.default.overrides.maxTokens`: Calculated dynamically based on step type
  - Cleaning: `inputTokens * 2`
  - Handout: `inputTokens * 1.5`
  - Summary: `summaryWordCount * 1.3`
