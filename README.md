# Table of Contents

- [Overview](#overview)
- [What is This Project?](#what-is-this-project)
- [Who is This For?](#who-is-this-for)
- [Use Cases and Workflows](#use-cases-and-workflows)
- [Pipeline Architecture](#pipeline-architecture)
- [Installation](#installation)
  - [Install as a Library](#install-as-a-library)
  - [Install as a CLI Tool](#install-as-a-cli-tool)
- [Quick Start](#quick-start)
- [CLI Usage](#cli-usage)
- [Programmatic Usage (Library)](#programmatic-usage-library)
- [Whisper ASR Integration](#whisper-asr-integration)
  - [Running Whisper Locally with Docker](#running-whisper-locally-with-docker)
  - [Configuring the Pipeline for Whisper](#configuring-the-pipeline-for-whisper)
- [Configuration](#configuration)
  - [Configuration File Structure](#configuration-file-structure)
  - [Profiles](#profiles)
  - [Input Audio Files](#input-audio-files)
  - [Context Materials](#context-materials)
  - [AI Provider Configuration](#ai-provider-configuration)
  - [Output Configuration](#output-configuration)
- [Pipeline Steps](#pipeline-steps)
  - [ASR Step (Transcription)](#asr-step-transcription)
  - [Cleaning Step](#cleaning-step)
  - [Handout Step](#handout-step)
  - [Summary Step](#summary-step)
- [Outputs and Generated Artifacts](#outputs-and-generated-artifacts)
- [Supported AI Providers](#supported-ai-providers)
- [Advanced Topics](#advanced-topics)
  - [Idempotency and Re-running](#idempotency-and-re-running)
  - [Custom Prompts](#custom-prompts)
  - [Per-Step AI Configuration](#per-step-ai-configuration)
  - [Logging and Progress Reporting](#logging-and-progress-reporting)
- [Contributing](#contributing)
- [License](#license)

## Overview

The **spoken-to-text-pipeline** is a Node.js pipeline that transforms spoken audio into structured, editable text through automated transcription and AI-powered post-processing. It addresses the common problem of raw ASR (Automatic Speech Recognition) output requiring significant manual cleanup before being usable for documentation, study materials, or analysis.

This pipeline orchestrates the complete workflow from audio files to polished text artifacts. It handles transcription via external ASR systems, cleans raw transcripts using AI, and generates summaries and handouts tailored to different use cases. The pipeline is designed to be both a reusable library for programmatic integration and a standalone CLI tool for direct usage.

The system is AI-provider-agnostic, supporting multiple providers (OpenAI, DeepSeek) and allowing per-step configuration. It works with external ASR services like Whisper, focusing on post-transcription processing rather than implementing ASR itself.

## What is This Project?

This project is a **pipeline orchestrator** for spoken-to-text workflows. It is not an ASR engine itself—instead, it coordinates transcription input from external ASR systems and applies AI-powered post-processing to produce clean, structured text outputs.

**What the pipeline does:**

* Orchestrates transcription of audio files using external ASR services (e.g., Whisper)
* Cleans raw ASR output to remove filler words, fix punctuation, and improve readability
* Generates structured handouts from lecture transcripts (lecture profile)
* Creates summaries of transcribed content with configurable length targets
* Processes multiple audio files sequentially, maintaining context across parts
* Supports batch processing with idempotent operations
* Provides both programmatic (library) and command-line interfaces

**What the pipeline does not do:**

* Implement ASR transcription engines internally
* Record or capture audio
* Perform real-time transcription
* Translate between languages (translation is handled by ASR if supported)
* Provide audio editing or manipulation capabilities

## Who is This For?

This project serves developers and technical users who need to process spoken audio into structured text at scale.

**Primary audiences:**

* **Developers building transcription workflows** who need a reusable, configurable pipeline component
* **Educators and researchers** processing recorded lectures, seminars, or educational content into study materials
* **Teams working with long-form audio** (meetings, interviews, presentations) who require clean transcripts and summaries
* **Users who want reproducible, scriptable pipelines** rather than manual, one-off transcription tasks

The pipeline assumes familiarity with Node.js and basic command-line usage, but does not require deep knowledge of ASR systems or AI model internals.

## Use Cases and Workflows

### Processing Recorded Lectures

**Input:** Multiple audio files from a lecture series (e.g., `part-1.wav`, `part-2.wav`, `part-3.wav`)

**Pipeline usage:** Configure the pipeline with the `lecture` profile, pointing to the directory containing audio files. The pipeline transcribes each part, cleans the raw transcripts, merges them into a structured handout, and generates a summary.

**Expected output:** Cleaned markdown files for each part (`part-1.md`, `part-2.md`, etc.), a unified `handout.md` with table of contents and organized sections, and a `summary.md` with key points.

### Generating Study Handouts from Audio

**Input:** Single or multiple audio recordings of educational content

**Pipeline usage:** Use the lecture profile with context materials (reference texts, course materials) to improve terminological accuracy. The pipeline processes audio sequentially, maintaining style consistency across parts.

**Expected output:** A polished handout document suitable for study or distribution, with consistent formatting and terminology aligned to the provided context materials.

### Cleaning Whisper Raw Transcripts

**Input:** Raw transcript files already generated by Whisper (or other ASR systems)

**Pipeline usage:** Skip the ASR step by providing pre-transcribed `.txt` files in the output directory. Configure the pipeline to run only the cleaning step, which processes raw transcripts into clean markdown.

**Expected output:** Cleaned `.md` files with proper punctuation, paragraph breaks, and removal of filler words, ready for further use.

### Batch Processing Multi-Part Recordings

**Input:** A directory containing multiple audio files representing sequential parts of a longer recording

**Pipeline usage:** Place all audio files in the input directory. The pipeline processes them in alphabetical order, maintaining context between sequential parts during cleaning to ensure consistent style and terminology.

**Expected output:** Sequentially numbered cleaned transcripts (`part-1.md`, `part-2.md`, etc.) and optionally a merged summary or handout, depending on the selected profile.

## Pipeline Architecture

The pipeline operates as a **sequential series of isolated steps**, each performing a specific transformation on the data. Steps are executed in order, with each step consuming outputs from previous steps and producing artifacts for subsequent steps.

```
Audio Files
   ↓
ASR (external, e.g. Whisper)
   ↓
Raw Transcription (.txt files)
   ↓
Cleaning (AI-powered)
   ↓
Cleaned Transcripts (.md files)
   ↓
Handout Generation (lecture profile only)
   ↓
Summary Generation
   ↓
Final Artifacts
```

**Step isolation:** Each step operates independently and can be enabled or disabled via configuration. Steps check for existing outputs and skip processing when artifacts already exist (idempotency), allowing safe re-runs and incremental processing.

**AI usage occurs after transcription:** The pipeline uses AI models exclusively for post-processing steps (cleaning, handout generation, summary). The actual speech-to-text conversion is handled by external ASR systems, keeping concerns separated and allowing users to choose their preferred ASR provider.

**Flexibility and reusability:** This separation makes the pipeline flexible—users can swap ASR providers, adjust AI models per step, or skip steps entirely. The modular design allows the same pipeline to serve different use cases (lectures, meetings, general transcription) through profile-based configuration without code changes.

## Installation

The pipeline requires **Node.js** (version 18 or higher) and can be installed as either a library dependency or a global CLI tool.

### Install as a Library

To use the pipeline programmatically in your Node.js project:

```bash
npm install spoken-to-text-pipeline
```

Or install from a local path or Git repository:

```bash
npm install /path/to/spoken-to-text-pipeline
# or
npm install git+https://github.com/your-org/spoken-to-text-pipeline.git
```

The package exports the `runPipeline` function and TypeScript types. Import it in your code:

```typescript
import { runPipeline } from "spoken-to-text-pipeline";
```

### Install as a CLI Tool

To use the pipeline as a command-line tool, install it globally:

```bash
npm install -g spoken-to-text-pipeline
```

After installation, the `spoken-to-text` command will be available in your PATH.

Alternatively, use `npx` to run it without global installation:

```bash
npx spoken-to-text-pipeline --config path/to/config.json
```

**Note:** If installing from source, build the project first:

```bash
npm install
npm run build
```

## Quick Start

Get the pipeline running in three steps: install, configure, and run.

### Prerequisites

Before starting, ensure you have:

1. **A Whisper ASR server** running and accessible (see [Whisper ASR Integration](#whisper-asr-integration))
2. **An AI provider API key** (OpenAI or DeepSeek) for post-processing steps
3. **Audio files** in `.wav` format ready to process

### Step 1: Install

Install globally for CLI usage:

```bash
npm install -g spoken-to-text-pipeline
```

### Step 2: Create Configuration

Create a `pipeline.config.json` file with minimal required fields:

```json
{
  "profile": "lecture",
  "language": {
    "input": "it",
    "output": "it"
  },
  "paths": {
    "inputDir": "./audio",
    "outputDir": "./output"
  },
  "asr": {
    "provider": "whisper",
    "whisper": {
      "serverUrl": "http://localhost:9000/asr"
    }
  },
  "ai": {
    "providers": {
      "openai": {
        "apiKey": "your-openai-api-key"
      }
    },
    "default": {
      "provider": "openai",
      "model": "gpt-5-mini"
    }
  }
}
```

Replace `your-openai-api-key` and `http://localhost:9000/asr` with your actual values. The pipeline uses built-in default prompts for the selected profile.

### Step 3: Run

Place your `.wav` audio files in the `inputDir` directory, then run:

```bash
spoken-to-text
```

Or specify a custom config path:

```bash
spoken-to-text --config my-config.json
```

The pipeline will:
1. Transcribe all audio files using Whisper
2. Clean the raw transcripts with AI
3. Generate a handout (lecture profile) or summary based on your profile
4. Write all outputs to the `outputDir` directory

Check the output directory for cleaned `.md` files, handouts, and summaries.

## CLI Usage

The CLI tool `spoken-to-text` runs the pipeline using a JSON configuration file.

### Basic Usage

Run with the default configuration file (`pipeline.config.json` in the current directory):

```bash
spoken-to-text
```

Specify a custom configuration file:

```bash
spoken-to-text --config my-config.json
```

Or use the short form:

```bash
spoken-to-text -c my-config.json
```

You can also pass the config path as a positional argument:

```bash
spoken-to-text my-config.json
```

### Command Options

- `-c, --config PATH` - Path to the pipeline configuration file (default: `pipeline.config.json`)
- `-h, --help` - Display help message and exit

### Execution Flow

When you run the CLI:

1. The configuration file is loaded and validated
2. The pipeline executes all steps sequentially:
   - **ASR Step**: Transcribes audio files from `inputDir` using Whisper
   - **Cleaning Step**: Cleans raw transcripts with AI
   - **Handout Step**: Generates handout (lecture profile only)
   - **Summary Step**: Generates summary
3. Progress is displayed in the terminal with a progress bar
4. Logs are written to the console based on the configured log level
5. All outputs are written to the `outputDir` directory

### Exit Codes

- `0` - Pipeline completed successfully
- `1` - Pipeline failed (error message displayed)

### Examples

Process audio files with default config:

```bash
spoken-to-text
```

Use a production configuration:

```bash
spoken-to-text --config configs/production.json
```

Get help:

```bash
spoken-to-text --help
```

## Programmatic Usage (Library)

Use the pipeline programmatically in your Node.js application by importing `runPipeline` and providing a configuration object.

### Basic Usage

```typescript
import { runPipeline } from "spoken-to-text-pipeline";
import type { PipelineConfig } from "spoken-to-text-pipeline";
import fs from "node:fs";

// Load configuration from file
const configJson = fs.readFileSync("pipeline.config.json", "utf-8");
const config: PipelineConfig = JSON.parse(configJson);

// Run the pipeline
const result = await runPipeline({ config });

if (result.success) {
  console.log("Pipeline completed successfully");
} else {
  console.error("Pipeline failed:", result.error);
}
```

### Using Configuration Objects

You can also construct the configuration object directly:

```typescript
import { runPipeline } from "spoken-to-text-pipeline";
import type { PipelineConfig } from "spoken-to-text-pipeline";

const config: PipelineConfig = {
  profile: "lecture",
  language: {
    input: "en",
    output: "en"
  },
  logging: {
    level: "info",
    singleLine: true
  },
  paths: {
    inputDir: "./audio",
    outputDir: "./output"
  },
  asr: {
    provider: "whisper",
    whisper: {
      serverUrl: "http://localhost:9000/asr"
    }
  },
  ai: {
    providers: {
      openai: {
        apiKey: process.env.OPENAI_API_KEY!
      }
    }
  }
};

const result = await runPipeline({ config });
```

### Custom Logger

Provide a custom logger to control log output. The logger must implement the `Logger` interface:

```typescript
import { runPipeline } from "spoken-to-text-pipeline";
import type { Logger } from "spoken-to-text-pipeline";

const logger: Logger = {
  error(message: string, err?: unknown) {
    console.error(`[ERROR] ${message}`, err);
  },
  warn(message: string) {
    console.warn(`[WARN] ${message}`);
  },
  info(message: string) {
    console.info(`[INFO] ${message}`);
  },
  debug(message: string) {
    console.debug(`[DEBUG] ${message}`);
  },
  silly(message: string) {
    console.log(`[SILLY] ${message}`);
  },
  withContext(ctx: Record<string, string | undefined>) {
    // Return a new logger with merged context
    return logger; // Simplified - implement context merging as needed
  }
};

const result = await runPipeline({
  config,
  logger
});
```

If no logger is provided, a default logger is created based on `config.logging` settings. The default logger uses Winston internally, but you can provide any implementation that matches the `Logger` interface.

### Custom Progress Reporter

Implement a custom progress reporter to track pipeline progress:

```typescript
import { runPipeline } from "spoken-to-text-pipeline";
import type { ProgressReporter } from "spoken-to-text-pipeline";

const progressReporter: ProgressReporter = {
  start(total: number, label?: string) {
    console.log(`Starting: ${label} (${total} items)`);
  },
  increment(step: number = 1) {
    console.log(`Progress: +${step}`);
  },
  updateMessage(message: string) {
    console.log(`Status: ${message}`);
  },
  stop() {
    console.log("Completed");
  }
};

const result = await runPipeline({
  config,
  progress: progressReporter
});
```

If no progress reporter is provided, a no-op reporter is used (no progress output). The CLI tool uses `cli-progress` (v3.12.0) internally to display progress bars, but you can provide any implementation that matches the `ProgressReporter` interface.

### Error Handling

The pipeline returns a result object instead of throwing exceptions:

```typescript
const result = await runPipeline({ config });

if (!result.success) {
  // Handle error
  console.error("Pipeline failed:", result.error);
  process.exit(1);
}

// Continue with success case
console.log("Pipeline completed");
```

### TypeScript Types

All types are exported for TypeScript usage:

```typescript
import type {
  PipelineConfig,
  PipelineOptions,
  PipelineResult,
  SupportedProfile,
  SupportedAiProvider,
  Logger,
  ProgressReporter
} from "spoken-to-text-pipeline";
```

### API Reference

**`runPipeline(options: PipelineOptions): Promise<PipelineResult>`**

Runs the pipeline with the provided options.

- `options.config` (required): Pipeline configuration object
- `options.logger` (optional): Custom logger instance. If not provided, a default logger is created based on `config.logging`
- `options.progress` (optional): Custom progress reporter. If not provided, a no-op reporter is used

Returns a promise that resolves to a `PipelineResult`:
- `success: boolean` - Whether the pipeline completed successfully
- `error?: string` - Error message if the pipeline failed

## Whisper ASR Integration

The pipeline requires a Whisper ASR server to handle audio transcription. You can run Whisper locally using Docker.

### Running Whisper Locally with Docker

The recommended approach is to use the `onerahmet/openai-whisper-asr-webservice` Docker image, which provides an HTTP API compatible with the pipeline.

#### Quick Start with Docker Compose

Create a `docker-compose.yml` file with the following configuration:

```yaml
services:
  whisper:
    image: onerahmet/openai-whisper-asr-webservice:latest
    container_name: whisper-asr
    restart: unless-stopped

    ports:
      # Expose Whisper ASR HTTP API
      - "9000:9000"

    environment:
      # ============================================================
      # ASR_ENGINE
      #
      # Selects the backend engine used for transcription.
      #
      # Possible values:
      #   - faster_whisper   → Fast, efficient, supports VAD (RECOMMENDED)
      #   - openai_whisper   → Original OpenAI Whisper (slower, no VAD)
      #   - whisperx         → Whisper + alignment + speaker diarization
      #                        (very heavy, GPU strongly recommended)
      # ============================================================
      - ASR_ENGINE=faster_whisper

      # ============================================================
      # ASR_MODEL
      #
      # Selects the Whisper model to load.
      #
      # Supported model names:
      #   - tiny
      #   - tiny.en
      #   - base
      #   - base.en
      #   - small
      #   - small.en
      #   - medium
      #   - medium.en
      #   - large-v1
      #   - large-v2
      #   - large-v3
      #   - large        (alias for the latest large version, usually large-v3)
      #
      # Notes:
      #   - *.en models are English-only and slightly faster
      #   - Larger models = higher accuracy but much higher CPU/RAM usage
      #
      # RECOMMENDATIONS (CPU, Windows, long Italian lectures):
      #   - base   → safest and fastest
      #   - small  → BEST DEFAULT (good accuracy, stable)
      #
      # ⚠️ USING medium:
      #   - Requires Docker Desktop memory ≥ 10 GB (8 GB minimum)
      #   - Slower (often 2–4× real time)
      #   - Strongly recommended:
      #       * split audio into ≤ 10 min chunks
      #       * disable FFmpeg re-encoding (encode=false in client)
      #       * limit CTranslate2 threads (see CT2_NUM_THREADS below)
      #
      # ⚠️ USING large / large-v*:
      #   - Requires Docker Desktop memory ≥ 14–16 GB
      #   - VERY slow on CPU
      #   - Diminishing accuracy returns for lectures
      #   - Generally NOT recommended on CPU-only systems
      # ============================================================
      - ASR_MODEL=large

      # ============================================================
      # ASR_LANGUAGE
      #
      # Force the source language.
      # If omitted or empty → automatic language detection.
      #
      # Examples: it, en, fr, es, de
      #
      # Recommendation:
      #   Always force the language for lectures.
      # ============================================================
      - ASR_LANGUAGE=it

      # ============================================================
      # ASR_DEVICE
      #
      # Selects the device used for inference.
      #
      # Possible values:
      #   - cpu   → CPU inference (stable, default)
      #   - cuda  → NVIDIA GPU (requires CUDA + nvidia-container-toolkit)
      # ============================================================
      - ASR_DEVICE=cpu

      # ============================================================
      # CT2_NUM_THREADS (OPTIONAL, ADVANCED)
      #
      # Limits the number of threads used by CTranslate2.
      #
      # Strongly recommended when using:
      #   - ASR_MODEL=medium
      #   - ASR_MODEL=large*
      #
      # Benefits:
      #   - Reduces peak RAM usage
      #   - Avoids memory spikes that cause exit code 137
      #   - Improves stability on Windows / Docker Desktop
      #
      # Tradeoff:
      #   - Slightly slower inference
      #
      # Uncomment ONLY if using medium or large:
      #
      # - CT2_NUM_THREADS=1
      # ============================================================

    volumes:
      # ============================================================
      # Model cache
      #
      # Stores downloaded Whisper / faster-whisper models so they
      # are not re-downloaded on each container restart.
      # ============================================================
      - ${HOME}/.docker/whisper/models:/root/.cache/whisper

      # ============================================================
      # Optional workflow directories
      #
      # These are NOT used automatically by the server,
      # but are useful for:
      #   - batch scripts
      #   - shared input/output access
      #   - custom client-side tooling
      # ============================================================
      - ${HOME}/.docker/whisper/inputs:/input
      - ${HOME}/.docker/whisper/outputs:/output
```

Start the server:

```bash
docker-compose up -d
```

The Whisper server will be available at `http://localhost:9000/asr`.

**Note:** Adjust `ASR_MODEL` and `ASR_LANGUAGE` according to your needs and available machine resources. For CPU-based systems processing long lectures, `small` is recommended as the default model. Resource requirements:
- **`base`**: ~1GB RAM, fastest processing
- **`small`**: ~2GB RAM, recommended default for CPU systems
- **`medium`**: ≥10GB RAM (Docker Desktop), 2-4× real-time processing
- **`large`**: ≥14-16GB RAM (Docker Desktop), very slow on CPU-only systems

Ensure Docker Desktop has sufficient memory allocated (Settings → Resources → Memory). All configuration options are documented in the comments within the docker-compose.yml file above.

### Configuring the Pipeline for Whisper

Once your Whisper server is running, configure the pipeline to use it:

```json
{
  "asr": {
    "provider": "whisper",
    "whisper": {
      "serverUrl": "http://localhost:9000/asr"
    }
  }
}
```

If your Whisper server is running on a different host or port, update `serverUrl` accordingly:

```json
{
  "asr": {
    "provider": "whisper",
    "whisper": {
      "serverUrl": "http://192.168.1.100:9000/asr"
    }
  }
}
```

#### Optional Whisper Configuration

You can customize transcription behavior:

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

- **`task`**: `"transcribe"` (same language) or `"translate"` (to English)
- **`outputFormat`**: `"txt"`, `"json"`, `"srt"`, `"vtt"`, or `"tsv"`
- **`temperature`**: Decoding temperature (0-1), lower = more deterministic
- **`beamSize`**: Beam search size (higher = better accuracy, slower)
- **`bestOf`**: Number of candidates to consider
- **`vad`**: Voice Activity Detection settings (requires `faster_whisper` engine)
  - `enabled`: Enable VAD filtering
  - `threshold`: VAD threshold (0-1)
  - `minSilenceMs`: Minimum silence duration before splitting segments
  - `maxSpeechS`: Maximum speech segment duration
- **`requestTimeoutMs`**: Request timeout per audio file (default: 1 hour)

### Verifying the Setup

Test that your Whisper server is accessible:

```bash
curl http://localhost:9000/asr
```

You should receive a response indicating the server is running. If the pipeline fails to connect, check:

1. The Docker container is running: `docker ps`
2. Port 9000 is accessible: `curl http://localhost:9000/asr`
3. The `serverUrl` in your config matches the actual server address
4. Firewall rules allow connections to the server port

## Configuration

The pipeline is configured via a JSON file (default: `pipeline.config.json`). This section provides detailed documentation for all configuration options.

### Configuration File Structure

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
  "context": { ... },
  "profiles": { ... }
}
```

Only the `profile` field is required. All other fields are optional and will be filled with sensible defaults if not provided. **Important:** At least one AI provider (OpenAI or DeepSeek) with its required API key must be configured in `ai.providers` for the pipeline to function. The configuration is validated on load, and errors will indicate missing or invalid fields.

### Configuration Defaults

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

### Profiles

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

### Language Configuration

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

### Logging Configuration

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

### Paths Configuration

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

### Input Audio Files

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

### Context Materials

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

- **`textSources`** (optional): Array of file paths containing reference text. Files must be `.txt` or `.md` format.

**How context is used:**

- Context files are loaded and provided to the **cleaning step only** as reference-only material
- The AI uses context during cleaning to improve terminological accuracy and theoretical coherence
- Context content is **NOT** modified, repeated, or directly copied into outputs
- Context helps the AI understand domain-specific terms and maintain consistency during transcript cleaning
- **Note:** Context files are not used in the handout or summary steps - those steps rely on the cleaned transcripts and built-in prompts

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

### AI Provider Configuration

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
    },
    "steps": {
      "cleaning": {
        "provider": "openai",
        "model": "gpt-4o-mini"
      },
      "summary": {
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

#### Provider Pool (`providers`)

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

#### Default Configuration (`default`)

The `default` object specifies the provider, model, and optional overrides to use for all steps when a step doesn't have a specific override.

- **`provider`** (required): AI provider to use (`"openai"` or `"deepseek"`)
- **`model`** (required): Model identifier (e.g., `"gpt-4o-mini"`, `"gpt-4o"`, `"deepseek-chat"`)
- **`overrides`** (optional): Parameter overrides
  - `temperature` (optional): Temperature for text generation (0-2). Default: profile-specific preset values
  - `maxTokens` (optional): Maximum tokens in generated output. Default: calculated dynamically

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

#### Per-Step Overrides (`steps`)

The optional `steps` object allows you to override the default configuration for specific steps.

- **`cleaning`** (optional): Override for cleaning step
- **`handout`** (optional): Override for handout step (lecture profile only)
- **`summary`** (optional): Override for summary step

Each step override can specify:
- `provider` (optional): Override provider
- `model` (optional): Override model
- `overrides` (optional): Override temperature and/or maxTokens

**Example:**

```json
{
  "steps": {
    "cleaning": {
      "provider": "openai",
      "model": "gpt-4o-mini"
    },
    "summary": {
      "provider": "deepseek",
      "model": "deepseek-chat",
      "overrides": {
        "temperature": 0.3,
        "maxTokens": 2000
      }
    }
  }
}
```

#### Temperature Defaults

If not specified, temperature defaults to profile-specific preset values:

- **Cleaning**: `0` (all profiles) - Deterministic cleaning
- **Handout**: `0` (lecture profile) - Deterministic structure
- **Summary**: 
  - `0.2` (lecture profile)
  - `0.3` (meeting profile)
  - `0.3` (other profile)

#### MaxTokens Calculation

If `maxTokens` is not specified, it's calculated dynamically:

- **Cleaning**: `inputTokens * 2` - Output typically similar to input
- **Handout**: `inputTokens * 1.5` - Output similar or slightly longer
- **Summary**: `summaryWordCount * 1.3` - Based on target word count (calculated dynamically if not set)

### Output Configuration

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

### ASR Configuration

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

- **`provider`** (required): Must be `"whisper"`

#### Whisper Configuration

- **`serverUrl`** (required): URL of the Whisper ASR server endpoint (e.g., `"http://localhost:9000/asr"`)

- **`task`** (optional): ASR task type
  - `"transcribe"` - Transcribe audio to text in the same language (default)
  - `"translate"` - Transcribe and translate to English

- **`outputFormat`** (optional): Output format for transcriptions
  - `"txt"` - Plain text (default)
  - `"json"` - JSON format
  - `"srt"` - SubRip subtitle format
  - `"vtt"` - WebVTT subtitle format
  - `"tsv"` - Tab-separated values

- **`temperature`** (optional): Temperature for ASR decoding (0-1). Lower values make transcription more deterministic. Default: profile-specific (lecture: 0, meeting: 0.2, other: 0)

- **`beamSize`** (optional): Beam size for beam search decoding. Higher values improve accuracy but increase processing time. Default: profile-specific (lecture: 5, meeting: 3, other: 5)

- **`bestOf`** (optional): Number of candidates to consider during decoding. Default: profile-specific (lecture: 5, meeting: 3, other: 5)

#### Voice Activity Detection (VAD)

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

- **`enabled`** (required if `vad` is provided): Enable or disable VAD processing

- **`threshold`** (optional): VAD threshold (0-1). Higher values require stronger signal to be considered speech. Default: profile-specific (lecture: 0.45, meeting: 0.6, other: 0.5)

- **`minSilenceMs`** (optional): Minimum silence duration in milliseconds before splitting segments. Default: profile-specific (lecture: 700, meeting: 500, other: 600)

- **`maxSpeechS`** (optional): Maximum speech segment duration in seconds. Longer segments are split automatically. Default: profile-specific (lecture: 60, meeting: 30, other: 45)

**Default VAD settings by profile:**

- **Lecture**: `enabled=true`, `threshold=0.45`, `minSilenceMs=700`, `maxSpeechS=60`
- **Meeting**: `enabled=true`, `threshold=0.6`, `minSilenceMs=500`, `maxSpeechS=30`
- **Other**: `enabled=true`, `threshold=0.5`, `minSilenceMs=600`, `maxSpeechS=45`

- **`requestTimeoutMs`** (optional): Request timeout in milliseconds for each audio file transcription. Default: `undefined` (uses Whisper server default timeout). Recommended: `900000` (15 minutes) for long audio files.

### Profile Prompts Configuration

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

See [Custom Prompts](#custom-prompts) in Advanced Topics for more details on prompt customization.
