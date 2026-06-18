# Configuration Reference

The pipeline is configured via a JSON file (default: `pipeline.config.json`). This document provides detailed documentation for all configuration options.

## Table of Contents

- [Configuration File Structure](#configuration-file-structure)
- [Configuration Defaults](#configuration-defaults)
- [Profiles](#profiles)
- [Metadata (title, authors, date)](#metadata-title-authors-date)
- [Language Configuration](#language-configuration)
- [Logging Configuration](#logging-configuration)
- [Paths Configuration](#paths-configuration)
- [Input Audio Files](#input-audio-files)
- [Context Materials](#context-materials)
- [AI Provider Configuration](#ai-provider-configuration)
  - [Provider Pool (`providers`)](#provider-pool-providers)
  - [Default Configuration (`default`)](#default-configuration-default)
  - [Supported Models and Parameter Compatibility](#supported-models-and-parameter-compatibility)
  - [Temperature Defaults](#temperature-defaults)
  - [MaxTokens Calculation](#maxtokens-calculation)
- [Batch Execution Mode](#batch-execution-mode)
- [Step Configuration](#step-configuration)
- [Output Configuration](#output-configuration)
- [ASR Configuration](#asr-configuration)
  - [Whisper Configuration](#whisper-configuration)
  - [Voice Activity Detection (VAD)](#voice-activity-detection-vad)
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
  "context": { ... }
}
```

Only the `profile` field is required. All other fields are optional and will be filled with sensible defaults if not provided. **Important:** At least one AI provider (OpenAI, DeepSeek, or Ollama) must be configured in `ai.providers` for the pipeline to function. OpenAI and DeepSeek require an API key; Ollama runs locally and does not. The configuration is validated on load, and errors will indicate missing or invalid fields.

## Configuration Defaults

When fields are not provided in the configuration file, the following defaults are applied:

- **`language`**: `{ input: "en", output: "en" }`
- **`logging`**: `{ level: "info", singleLine: false }`
- **`paths`**: `{ inputDir: "./input", outputDir: "./output" }`
- **`output`**: `{ addTimestamp: false, dropCache: true }` (summaryWordCount calculated dynamically if not set)
- **`asr.provider`**: `"whisper"`
- **`asr.whisper.serverUrl`**: `"http://localhost:9000/asr"`
- **`asr.whisper.task`**, **`asr.whisper.outputFormat`**, **`asr.whisper.temperature`**, **`asr.whisper.beamSize`**, **`asr.whisper.bestOf`**, and **`asr.whisper.vad`**: Profile-specific defaults (see [Profiles](#profiles) section)
- **`ai.providers`**: `{}` (empty by default, but **at least one provider must be configured** - this is required for the pipeline to work)
- **`ai.default`**: `{ provider: "openai", model: "gpt-5.2" }`
- **`context`**: `undefined` (no context files)

**Note:** Profile-specific ASR defaults are automatically applied based on the selected `profile`:
- **Lecture**: `task="transcribe"`, `outputFormat="txt"`, `temperature=0`, `beamSize=5`, `bestOf=5`, `vad={enabled: true, threshold: 0.45, minSilenceMs: 700, maxSpeechS: 60}`
- **Meeting**: `task="transcribe"`, `outputFormat="txt"`, `temperature=0.2`, `beamSize=3`, `bestOf=3`, `vad={enabled: true, threshold: 0.6, minSilenceMs: 500, maxSpeechS: 30}`
- **Other**: `task="transcribe"`, `outputFormat="txt"`, `temperature=0`, `beamSize=5`, `bestOf=5`, `vad={enabled: true, threshold: 0.5, minSilenceMs: 600, maxSpeechS: 45}`

## Profiles

The `profile` field determines which processing profile to use. All profiles use the same steps (cleaning, handout, summary); each profile has different default prompts and ASR settings.

**Supported profiles:**

- **`"lecture"`** - Optimized for educational lectures
  - Prompts focus on preserving educational content and structure
  - Default ASR settings: temperature=0, beamSize=5, bestOf=5
  - VAD enabled with threshold=0.45, minSilenceMs=700, maxSpeechS=60
  - **Expected outputs:**
    - Raw transcripts (`.txt` files) from ASR step
    - Cleaned transcripts (`.md` files) from cleaning step
    - Structured handout (`handout.md`) with table of contents and organized sections
    - Summary (`summary.md`) with key concepts and theoretical frameworks

- **`"meeting"`** - Optimized for meeting transcripts
  - Prompts focus on decisions, action items, and key discussion points
  - Default ASR settings: temperature=0.2, beamSize=3, bestOf=3
  - VAD enabled with threshold=0.6, minSilenceMs=500, maxSpeechS=30
  - **Expected outputs:**
    - Raw transcripts (`.txt` files) from ASR step
    - Cleaned transcripts (`.md` files) from cleaning step
    - Meeting handout (`handout.md`) with structured meeting documentation
    - Summary (`summary.md`) with decisions, action items, and key discussion points

- **`"other"`** - General-purpose transcription
  - Generic prompts for cleaning, handout, and summarization
  - Default ASR settings: temperature=0, beamSize=5, bestOf=5
  - VAD enabled with threshold=0.5, minSilenceMs=600, maxSpeechS=45
  - **Expected outputs:**
    - Raw transcripts (`.txt` files) from ASR step
    - Cleaned transcripts (`.md` files) from cleaning step
    - Handout (`handout.md`) with structured content
    - Summary (`summary.md`) with main ideas and key information

**Example:**

```json
{
  "profile": "lecture"
}
```

## Metadata (title, authors, date)

Optional metadata used in output headers. **Metadata is added post-processing**, not by the AI. The AI is instructed to output content only (no title, header, or metadata). After each step completes (cleaning, handout, summary), the pipeline prepends a metadata header using config values.

- **`title`** (optional): Title of the lecture, meeting, or content. Used as the H1 heading.
- **`authors`** (optional): Array of author/speaker names. Displayed as `**<Authors>**` in the header.
- **`date`** (optional): Date string or `Date` object (e.g. `"2026-02-07"`, `"07 febbraio 2026"`). Formatted and localized according to `language.output` (e.g. Italian locale → "7 febbraio 2026", English → "February 7, 2026").

**Header structure (prepended to output):**

```
# <Title>

**<Authors>**
**<Date>**

***<Step label>***
```

- **Cleaning**: Header is prepended only to the **first** cleaned file; subsequent parts have no header.
- **Handout** and **Summary**: Header is prepended to the single output file.

**Step labels** are predefined in English (e.g. "Lecture Handout", "Meeting Summary", "Cleaned transcript"). When `language.output` is not English, the pipeline uses the AI to translate the step label into the requested locale (e.g. Italian → "Dispense della lezione").

**Example:**

```json
{
  "title": "Repertorio dell'Aggressività",
  "authors": ["Prof. Ligozzi"],
  "date": "2026-02-07"
}
```

When title, authors, and date are omitted, the header contains only the step label (e.g. `***Lecture Handout***`).

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

**Path resolution:** All file and folder paths in the config are resolved as follows:

- **If a base directory is specified on the command line** (e.g. `--base-dir ./my-project`), relative paths are resolved against that directory (except `steps.*.promptFile`, see below).
- **If no base directory is specified**, relative paths are resolved against **the directory of the config file** (e.g. a config at `./project/pipeline.config.json` makes `./input` resolve to `./project/input`).
- **Absolute paths** are always used as-is.
- **Exception:** `steps.*.promptFile` are always resolved relative to the config file directory, regardless of `--base-dir`.

This applies to: `paths.inputDir`, `paths.outputDir`, `context.textSources`, and (relative to config file dir) `steps.*.promptFile`. The same config file then works regardless of where you run the command from.

The `paths` object defines input and output directories.

```json
{
  "paths": {
    "inputDir": "./audio",
    "outputDir": "./output"
  }
}
```

- **`inputDir`** (optional): Directory containing input audio files. Only `.wav` files are processed. Files are processed in alphabetical order. Use absolute paths or paths relative to the [path resolution](#paths-configuration) base (command-line base dir or config file directory). Default: `"./input"`

- **`outputDir`** (optional): Base output directory where all pipeline outputs are written. All outputs (raw transcripts, cleaned files, handouts, summaries) are written directly to this directory (no subfolders). If `output.addTimestamp` is `true`, a timestamp suffix (`yyyyMMddHHmmss`) is appended to this path. Use absolute paths or paths relative to the [path resolution](#paths-configuration) base. Default: `"./output"`

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

- **`textSources`** (optional): Array of file paths containing reference text. Files must be `.txt` or `.md` format. Use absolute paths or paths relative to the [path resolution](#paths-configuration) base (command-line base dir or config file directory). Absolute paths are used as-is. Default: `undefined` (no context files loaded)

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
      },
      "ollama": {}
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

The `providers` object contains configuration for all providers that may be used. **At least one provider must be configured** - this is required for the pipeline to function. You can configure multiple providers and switch between them per step.

- **`openai`** (optional): OpenAI provider configuration
  - `apiKey` (required if `openai` is provided): Your OpenAI API key (starts with `sk-`). If omitted, `SPOKEN_TO_TEXT_OPENAI_API_KEY` is used.
  - `requestTimeoutMs` (optional): Per-request timeout (in milliseconds) for **synchronous** Responses API calls (e.g. incremental/`sync` handout generation, or the chunked-summary merge). The OpenAI SDK default is 10 minutes, which can be too short for a large single request. Default: `1800000` (30 minutes). Raise it for very long sessions if a synchronous step fails with "Request timed out". (The batch handout Stage-2 merge is mechanical and in-process, so it is unaffected by this timeout.)

- **`deepseek`** (optional): DeepSeek provider configuration
  - `apiKey` (required if `deepseek` is provided): Your DeepSeek API key. If omitted, `SPOKEN_TO_TEXT_DEEPSEEK_API_KEY` is used.

- **`ollama`** (optional): Ollama provider configuration (local AI server, no API key required)
  - `baseUrl` (optional): Ollama server base URL. Default: `"http://localhost:11434/v1"`

**Important:** The `providers` object cannot be empty. You must configure at least one provider (`openai`, `deepseek`, or `ollama`) for the pipeline to work.

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

- **`provider`** (optional): AI provider to use (`"openai"`, `"deepseek"`, or `"ollama"`). Default: `"openai"`
- **`model`** (optional): Model identifier (e.g., `"gpt-4o-mini"`, `"gpt-4o"`, `"deepseek-chat"`). Default: `"gpt-5.2"`
- **`overrides`** (optional): Parameter overrides. Default: `undefined`
  - `temperature` (optional): Temperature for text generation (0-2). Default: profile-specific preset values (cleaning: 0, handout: 0, summary: 0.2-0.3 depending on profile)
  - `maxTokens` (optional): Maximum tokens in generated output. Default: not set (the model uses its full budget and stops naturally). **Caution:** For reasoning models (gpt-5 series, o-series), `max_output_tokens` includes internal reasoning tokens — setting it too low can cause empty responses.

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

### Supported Models and Parameter Compatibility

The pipeline automatically handles parameter compatibility across different models. **You don't need to worry about sending unsupported parameters** — the pipeline detects the model and omits parameters that would cause API errors.

#### OpenAI Models

OpenAI offers two model families with different parameter support:

| Model Family | Examples | `temperature` | Type |
|---|---|---|---|
| **GPT-5 series** (reasoning) | `gpt-5`, `gpt-5-mini`, `gpt-5-nano` | **Not supported** (auto-omitted) | Reasoning model |
| **o-series** (reasoning) | `o1`, `o1-mini`, `o3`, `o3-mini`, `o4-mini` | **Not supported** (auto-omitted) | Reasoning model |
| **GPT-4o series** (standard) | `gpt-4o`, `gpt-4o-mini` | Supported | Standard model |
| **GPT-4 / 3.5** (standard) | `gpt-4-turbo`, `gpt-3.5-turbo` | Supported | Standard model |

**Reasoning models** (gpt-5 series, o-series) use internal chain-of-thought reasoning to generate responses. They do not accept `temperature` — the API returns a 400 error if it is sent. The pipeline automatically detects these models by prefix (`gpt-5*`, `o1*`, `o3*`, `o4*`) and omits `temperature` from the request.

> **Note:** If you configure a `temperature` override in your config while using a reasoning model, the override is silently ignored — no error is raised, and the pipeline works correctly.

**All OpenAI models** support `max_output_tokens` (mapped from `maxTokens` in config). By default, `max_output_tokens` is **not sent** — the model uses its full budget and stops naturally. For reasoning models, `max_output_tokens` includes both internal reasoning tokens and the visible answer, so setting it too low can cause empty responses. If the response is incomplete, the pipeline throws a descriptive error.

#### DeepSeek Models

| Model | `temperature` | Type |
|---|---|---|
| `deepseek-chat` | Supported | Standard (non-thinking) |
| `deepseek-reasoner` | **Not supported** (auto-omitted) | Reasoning (thinking mode) |

`deepseek-reasoner` silently ignores `temperature` (no API error), but the pipeline explicitly omits it for clarity.

**Both DeepSeek models** support `max_tokens` (mapped from `maxTokens` in config). By default, `max_tokens` is **not sent** — the model uses its full budget and stops naturally.

#### Ollama Models (Local)

Ollama runs models locally. Any model pulled via `ollama pull` can be used. All Ollama models support `temperature` and `max_tokens`.

| Model | Example Identifier | Notes |
|---|---|---|
| Llama 3.1 | `llama3.1:8b` | Good general-purpose model |
| Qwen 2.5 | `qwen2.5:7b`, `qwen2.5:14b` | Strong multilingual support |
| Mistral | `mistral:7b` | Fast and efficient |
| Gemma 2 | `gemma2:9b` | Google's open model |

> **Note:** Model names must match exactly what Ollama has pulled locally. Use `ollama list` to see available models. Pull a new model with `ollama pull <model>`.

#### Choosing a Model

- **For deterministic tasks** (cleaning, handout): Reasoning models like `gpt-5.2` work well and don't need temperature control
- **For creative tasks** (summary) where you want to tune randomness: Use a standard model like `gpt-4o-mini` with a custom `temperature` override
- **For cost optimization**: `gpt-5-mini` or `deepseek-chat` are cost-effective choices
- **For fully local / offline usage**: Use Ollama with a model like `llama3.1:8b` or `qwen2.5:7b` — no API key or internet required

### Using Ollama (Local AI)

[Ollama](https://ollama.com/) lets you run open-source LLMs locally. No API key, no cloud costs.

**1. Install and start Ollama**

```bash
# macOS / Linux
curl -fsSL https://ollama.com/install.sh | sh

# Windows — download from https://ollama.com/download

# Start the server (runs on http://localhost:11434 by default)
ollama serve
```

**2. Pull a model**

```bash
ollama pull llama3.1:8b
# or
ollama pull qwen2.5:7b
```

**3. Configure the pipeline**

```json
{
  "profile": "lecture",
  "ai": {
    "providers": {
      "ollama": {}
    },
    "default": {
      "provider": "ollama",
      "model": "llama3.1:8b"
    }
  }
}
```

**Custom base URL** (e.g. Ollama running on a different host):

```json
{
  "ai": {
    "providers": {
      "ollama": {
        "baseUrl": "http://192.168.1.100:11434/v1"
      }
    },
    "default": {
      "provider": "ollama",
      "model": "qwen2.5:7b"
    }
  }
}
```

**Mixing providers** — use Ollama for some steps and a cloud provider for others:

```json
{
  "ai": {
    "providers": {
      "openai": { "apiKey": "sk-..." },
      "ollama": {}
    },
    "default": {
      "provider": "ollama",
      "model": "llama3.1:8b"
    }
  },
  "steps": {
    "summary": {
      "aiConfig": {
        "provider": "openai",
        "model": "gpt-4o-mini"
      }
    }
  }
}
```

## Batch Execution Mode

By default every AI step (cleaning, handout, summary) calls the AI provider synchronously and waits for the response before continuing. Setting `execution: "batch"` on a step (or globally via `ai.default.execution`) switches that step to use the **OpenAI Batch API**, which is approximately **50% cheaper** but asynchronous — OpenAI's SLA is "within 24 hours", though many jobs finish sooner.

**Requirements:**
- Batch mode requires provider `"openai"`. Configuring any other provider (`"deepseek"` or `"ollama"`) with `execution: "batch"` is rejected at config load time.
- No new CLI flags are needed. The pipeline submits the batch job, then polls automatically until it completes (or until `maxWaitMs` is exceeded, if set).

### Enabling batch mode

Set `execution` on `ai.default` to apply it to all steps, or on individual `steps.<step>.aiConfig` to apply it to a specific step:

```json
{
  "profile": "lecture",
  "ai": {
    "providers": {
      "openai": { "apiKey": "sk-proj-..." }
    },
    "default": {
      "provider": "openai",
      "model": "gpt-5-mini",
      "execution": "batch"
    },
    "batch": {
      "pollIntervalMs": 30000
    }
  }
}
```

To enable batch mode only for a specific step:

```json
{
  "profile": "lecture",
  "ai": {
    "providers": {
      "openai": { "apiKey": "sk-proj-..." }
    },
    "default": {
      "provider": "openai",
      "model": "gpt-5-mini"
    }
  },
  "steps": {
    "cleaning": {
      "aiConfig": {
        "execution": "batch"
      }
    }
  }
}
```

### Batch tuning (`ai.batch`)

The optional `ai.batch` object controls polling behaviour:

- **`pollIntervalMs`** (optional): How often (in milliseconds) the pipeline polls the OpenAI Batch API while waiting for the job to finish. Default: `30000` (30 seconds).
- **`maxWaitMs`** (optional): Maximum wall-clock time (in milliseconds) the pipeline will wait before giving up. When exceeded the job is **left running remotely** (not cancelled) and the run throws with a "Pending — re-run to resume" message. Default: `undefined` (wait indefinitely until the batch completes or fails).

### Resume / idempotency contract

When a batch job is submitted, its state is persisted per step to `<outputDir>/.cache/<step>/batch/state.json` (e.g. `.cache/cleaning/batch/state.json`). If the run is interrupted (Ctrl-C, process kill, `maxWaitMs` timeout), **re-running the same command resumes the existing batch job** — it does not resubmit. This ensures you are never charged twice for the same work.

On terminal failure (OpenAI reports status `failed`, `expired`, or `cancelled`), the state for that step is cleared automatically and the run throws an error including the batch id and counts. A subsequent re-run will resubmit a fresh batch job for that step.

**Handout draft persistence:** the handout step is a two-stage map-reduce — a Stage-1 batch produces one draft per part, then a mechanical (in-process) Stage-2 merge combines them. Because the batch state is cleared once the batch completes, a failure after the batch would otherwise force the whole batch to be resubmitted on re-run. To avoid that, each Stage-1 draft is persisted to `<outputDir>/.cache/handout/batch/drafts/<part>.md`. On re-run, if **every** part already has a persisted draft, the batch is skipped entirely and the merge runs directly against the saved drafts.

**Incremental handout resume:** in sync (incremental) mode the handout is built one part at a time. Each part's AI result is persisted to `<outputDir>/.cache/handout/incremental/drafts/<part>.md` right after the call, so a run that fails partway through resumes from the last completed part instead of re-issuing earlier calls.

**Auxiliary cache cleanup:** all of these progress artifacts live under a single `<outputDir>/.cache` folder. By default it is **deleted after a successful run** and **kept after a failure** (so the next run can resume). Set [`output.dropCache`](#output-configuration) to `false` to always keep it.

**Note:** `dryRun` mode never submits a batch job.

### Cost and timing trade-offs

A full batch run may involve up to three sequential batch jobs — cleaning, handout (Stage 1 drafts), and summary — each subject to the OpenAI "within 24 hours" SLA. The handout Stage 2 merge is **mechanical and in-process** (concatenation + global heading renumbering, no AI call), so it adds no cost or latency. The chunked-summary merge is still a short synchronous call, which runs at full price but is a single call and negligible in cost compared to the batch savings.

In practice:
- **Cost**: approximately 50% cheaper than synchronous calls for the batched requests.
- **Timing**: plan for overnight turnaround, or set `maxWaitMs` to a shorter budget and re-run later.

## Step Configuration

The optional `steps` object allows you to configure specific pipeline steps at the top level of the configuration.

- **`cleaning`** (optional): Configuration for cleaning step
- **`handout`** (optional): Configuration for handout step (all profiles). Uses the same structure as cleaning and summary (`prompt`, `promptFile`, `aiConfig`).
- **`summary`** (optional): Configuration for summary step

Each step configuration can specify:
- `enabled` (optional): Enable or disable the step. If `false`, the step will be skipped. Default: `true` (step is enabled)
- `prompt` (optional): Inline system prompt override for this step. Takes precedence over `promptFile`. If set, replaces the profile default prompt for this step.
- `promptFile` (optional): Path to a text or markdown file (e.g. `.txt`, `.md`) containing the system prompt. Resolved relative to the config file directory. Used only when `prompt` is not set. Useful for long or structured prompts that are awkward to embed in JSON.
- `aiConfig` (optional): AI configuration for this step. If not provided, uses `ai.default` or OpenAI gpt-5-mini as fallback
  - `provider` (optional): Override provider (`"openai"`, `"deepseek"`, or `"ollama"`). Default: uses `ai.default.provider` or `"openai"`
  - `model` (optional): Override model. Default: uses `ai.default.model` or `"gpt-5-mini"`
  - `overrides` (optional): Override temperature and/or maxTokens. Default: uses `ai.default.overrides` or profile-specific presets

**Prompt override precedence:** If both `prompt` and `promptFile` are set for a step, `prompt` is used. If neither is set, the pipeline uses the built-in default prompt for the selected profile and step.

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
- **Handout**: `0` (all profiles) - Deterministic structure
- **Summary**: 
  - `0.2` (lecture profile)
  - `0.3` (meeting profile)
  - `0.3` (other profile)

> **Important:** Temperature is only sent to models that support it. Reasoning models (OpenAI `gpt-5*`, `o1*`, `o3*`, `o4*` and DeepSeek `deepseek-reasoner`) do not support temperature — the pipeline automatically omits it for these models. See [Supported Models and Parameter Compatibility](#supported-models-and-parameter-compatibility) for details.

### MaxTokens Behavior

By default, `maxTokens` is **not set** — no `max_output_tokens` (OpenAI) or `max_tokens` (DeepSeek) parameter is sent to the API. The model uses its full budget and stops naturally when it finishes generating output. You are only billed for tokens actually produced, not for a limit.

Setting `maxTokens` is **not recommended** in most cases because:
- It adds risk of truncated or empty responses with no real benefit
- For **reasoning models** (gpt-5 series, o-series), `max_output_tokens` includes internal reasoning tokens — a low limit causes the model to exhaust the budget on reasoning and return an empty answer
- The model naturally stops when it has finished the task

If you do set `maxTokens` explicitly and the response is incomplete, the pipeline throws a descriptive error instead of silently returning empty text.

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

- **`dropCache`** (optional): Whether to delete the auxiliary `<outputDir>/.cache` folder after a **successful** run. Default: `true`
  - The `.cache` folder holds progress/resume artifacts only (per-step batch state, handout batch drafts, handout incremental fragments) — never user-facing outputs.
  - `true` (default): remove `.cache` once the pipeline finishes successfully, keeping the output directory clean.
  - `false`: always keep `.cache` (useful for debugging or inspecting intermediate drafts).
  - On **failure** the cache is always kept regardless of this flag, so a re-run can resume from where it stopped.

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

- **`requestTimeoutMs`** (optional): Request timeout in milliseconds for each audio file transcription. This is the maximum time allowed for the entire request (including connection, upload, processing, and response). Default: `undefined` (uses default of 1 hour = 3600000ms). Recommended: `900000` (15 minutes) for long audio files.

  **Note:** The pipeline also implements a separate **connection timeout** of 30 seconds. If the server doesn't accept a connection within 30 seconds, the request fails immediately with a clear error message. This helps identify connection issues early, separate from request processing timeouts.

## Configuration Parameters Summary

The following table provides a quick reference for all configuration parameters:

| Parameter | Type | Required | Default | Allowed Values | Notes |
|-----------|------|----------|---------|----------------|-------|
| **`profile`** | `string` | Yes | - | `"lecture"`, `"meeting"`, `"other"` | Determines processing behavior and available steps |
| `title` | `string` | No | `undefined` | Any string | Title for metadata header (cleaned first file, handout, summary) |
| `authors` | `string[]` | No | `undefined` | Array of strings | Author(s) for metadata header |
| `date` | `string` \| `Date` | No | `undefined` | Any string or Date | Date for metadata header; formatted per `language.output` |
| **`language`** | `object` | No | `{ input: "en", output: "en" }` | - | Language configuration |
| `language.input` | `string` | No | `"en"` | Valid Whisper language codes (`"it"`, `"en"`, `"es"`, `"fr"`, `"de"`, `"pt"`, `"ru"`, `"ja"`, `"zh"`, `"ko"`, etc.) | Input audio language |
| `language.output` | `string` | No | `"en"` | Valid language codes | Output text language |
| **`logging`** | `object` | No | `{ level: "info", singleLine: false }` | - | Logging configuration |
| `logging.level` | `string` | No | `"info"` | `"error"`, `"warn"`, `"info"`, `"debug"` | Minimum log level |
| `logging.singleLine` | `boolean` | No | `false` | `true`, `false` | Single-line vs multi-line format |
| **`paths`** | `object` | No | `{ inputDir: "./input", outputDir: "./output" }` | - | File system paths |
| `paths.inputDir` | `string` | No | `"./input"` | Valid directory path | Input audio directory |
| `paths.outputDir` | `string` | No | `"./output"` | Valid directory path | Output directory (timestamp suffix added if `output.addTimestamp` is true) |
| **`output`** | `object` | No | `{ addTimestamp: false, dropCache: true, summaryWordCount: undefined }` | - | Output configuration |
| `output.addTimestamp` | `boolean` | No | `false` | `true`, `false` | Append timestamp to outputDir |
| `output.dropCache` | `boolean` | No | `true` | `true`, `false` | Delete the `.cache` progress folder after a successful run (kept on failure) |
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
| `asr.whisper.requestTimeoutMs` | `number` | No | `undefined` (1 hour default) | Positive integer | Request timeout (ms), recommended: 900000. Note: Separate 30s connection timeout applies |
| **`ai`** | `object` | No | `{ providers: {}, default: { provider: "openai", model: "gpt-5-mini" } }` | - | AI provider configuration |
| `ai.providers` | `object` | ⚠️ No | `{}` | - | Provider pool (at least one provider with API key required) |
| `ai.providers.openai` | `object` | No | `undefined` | - | OpenAI provider config |
| `ai.providers.openai.apiKey` | `string` | ⚠️ No | `SPOKEN_TO_TEXT_OPENAI_API_KEY` | Valid API key (starts with `sk-`) | OpenAI API key (or env var) |
| `ai.providers.deepseek` | `object` | No | `undefined` | - | DeepSeek provider config |
| `ai.providers.deepseek.apiKey` | `string` | ⚠️ No | `SPOKEN_TO_TEXT_DEEPSEEK_API_KEY` | Valid API key | DeepSeek API key (or env var) |
| `ai.providers.ollama` | `object` | No | `undefined` | - | Ollama provider config (no API key needed) |
| `ai.providers.ollama.baseUrl` | `string` | No | `"http://localhost:11434/v1"` | Valid URL | Ollama server base URL |
| `ai.default` | `object` | No | `{ provider: "openai", model: "gpt-5-mini" }` | - | Default AI configuration |
| `ai.default.provider` | `string` | No | `"openai"` | `"openai"`, `"deepseek"`, `"ollama"` | Default provider |
| `ai.default.model` | `string` | No | `"gpt-5-mini"` | Valid model identifier | Default model |
| `ai.default.overrides` | `object` | No | `undefined` | - | Default parameter overrides |
| `ai.default.overrides.temperature` | `number` | No | Profile-specific presets | 0-2 | Temperature override |
| `ai.default.overrides.maxTokens` | `number` | No | Not set (model default) | Positive integer | Max tokens override (not recommended for reasoning models) |
| `ai.default.execution` | `string` | No | `"sync"` | `"sync"`, `"batch"` | Default execution mode for all steps; `"batch"` requires provider `"openai"` |
| `ai.batch` | `object` | No | `undefined` | - | Batch API tuning; only used by steps whose execution is `"batch"` |
| `ai.batch.pollIntervalMs` | `number` | No | `30000` | Positive integer | Poll interval (ms) while auto-watching a batch job |
| `ai.batch.maxWaitMs` | `number` | No | `undefined` (wait indefinitely) | Positive integer | Max wall-clock wait (ms) before leaving job pending; re-run to resume |
| **`steps`** | `object` | No | `undefined` | - | Step configuration |
| `steps.cleaning` | `object` | No | `undefined` | - | Cleaning step configuration |
| `steps.cleaning.enabled` | `boolean` | No | `true` | `true`, `false` | Enable or disable cleaning step |
| `steps.cleaning.prompt` | `string` | No | Profile default | Any string | Inline system prompt override (takes precedence over promptFile) |
| `steps.cleaning.promptFile` | `string` | No | - | Path to .txt or .md file | Path to prompt file (relative to config file directory) |
| `steps.cleaning.aiConfig` | `object` | No | Uses `ai.default` | - | AI configuration for cleaning step |
| `steps.cleaning.aiConfig.provider` | `string` | No | Uses `ai.default.provider` | `"openai"`, `"deepseek"`, `"ollama"` | Override provider |
| `steps.cleaning.aiConfig.model` | `string` | No | Uses `ai.default.model` | Valid model identifier | Override model |
| `steps.cleaning.aiConfig.overrides` | `object` | No | Uses `ai.default.overrides` | - | Override parameters |
| `steps.cleaning.aiConfig.overrides.temperature` | `number` | No | Profile-specific presets | 0-2 | Temperature override |
| `steps.cleaning.aiConfig.overrides.maxTokens` | `number` | No | Not set (model default) | Positive integer | Max tokens override (not recommended for reasoning models) |
| `steps.cleaning.aiConfig.execution` | `string` | No | `"sync"` | `"sync"`, `"batch"` | Execution mode for cleaning step; `"batch"` requires provider `"openai"` |
| `steps.handout` | `object` | No | `undefined` | - | Handout step configuration |
| `steps.handout.enabled` | `boolean` | No | `true` | `true`, `false` | Enable or disable handout step |
| `steps.handout.prompt` | `string` | No | Profile default | Any string | Inline system prompt override (takes precedence over promptFile) |
| `steps.handout.promptFile` | `string` | No | - | Path to .txt or .md file | Path to prompt file (relative to config file directory) |
| `steps.handout.aiConfig` | `object` | No | Uses `ai.default` | - | AI configuration for handout step |
| `steps.handout.aiConfig.provider` | `string` | No | Uses `ai.default.provider` | `"openai"`, `"deepseek"`, `"ollama"` | Override provider |
| `steps.handout.aiConfig.model` | `string` | No | Uses `ai.default.model` | Valid model identifier | Override model |
| `steps.handout.aiConfig.overrides` | `object` | No | Uses `ai.default.overrides` | - | Override parameters |
| `steps.handout.aiConfig.overrides.temperature` | `number` | No | Profile-specific presets | 0-2 | Temperature override |
| `steps.handout.aiConfig.overrides.maxTokens` | `number` | No | Calculated dynamically | Positive integer | Max tokens override |
| `steps.handout.aiConfig.execution` | `string` | No | `"sync"` | `"sync"`, `"batch"` | Execution mode for handout step; `"batch"` requires provider `"openai"` |
| `steps.summary` | `object` | No | `undefined` | - | Summary step configuration |
| `steps.summary.enabled` | `boolean` | No | `true` | `true`, `false` | Enable or disable summary step |
| `steps.summary.prompt` | `string` | No | Profile default | Any string | Inline system prompt override (takes precedence over promptFile) |
| `steps.summary.promptFile` | `string` | No | - | Path to .txt or .md file | Path to prompt file (relative to config file directory) |
| `steps.summary.aiConfig` | `object` | No | Uses `ai.default` | - | AI configuration for summary step |
| `steps.summary.aiConfig.provider` | `string` | No | Uses `ai.default.provider` | `"openai"`, `"deepseek"`, `"ollama"` | Override provider |
| `steps.summary.aiConfig.model` | `string` | No | Uses `ai.default.model` | Valid model identifier | Override model |
| `steps.summary.aiConfig.overrides` | `object` | No | Uses `ai.default.overrides` | - | Override parameters |
| `steps.summary.aiConfig.overrides.temperature` | `number` | No | Profile-specific presets | 0-2 | Temperature override |
| `steps.summary.aiConfig.overrides.maxTokens` | `number` | No | Calculated dynamically | Positive integer | Max tokens override |
| `steps.summary.aiConfig.execution` | `string` | No | `"sync"` | `"sync"`, `"batch"` | Execution mode for summary step; `"batch"` requires provider `"openai"` |
| **`context`** | `object` | No | `undefined` | - | Context materials |
| `context.textSources` | `string[]` | No | `undefined` | Array of file paths | Reference text files (.txt or .md) |

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
