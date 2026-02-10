# spoken-to-text-pipeline

[![Build Status](https://github.com/sidec15/spoken-to-text-pipeline/actions/workflows/tests.yaml/badge.svg)](https://github.com/sidec15/spoken-to-text-pipeline/actions/workflows/tests.yaml)
[![codecov](https://codecov.io/gh/sidec15/spoken-to-text-pipeline/graph/badge.svg?token=ES1EOSVK6L)](https://codecov.io/gh/sidec15/spoken-to-text-pipeline)

<!-- <p style="text-align: left;">
  <img src="spoken-to-text.png" alt="spoken-to-text" height="200">
</p> -->

A Node.js pipeline that transforms spoken audio into structured, editable text through automated transcription and AI-powered post-processing.

## Why This Tool?

While there are many services that let users write transcripts in real-time, there are **few alternatives when dealing with post-processing activities**, and most of them are **paid**. This pipeline fills that gap by providing:

- **Automated post-processing** of raw ASR transcripts using AI
- **Profile-based workflows** optimized for lectures, meetings, and general transcription
- **Batch processing** with idempotent operations for safe re-runs
- **Flexible configuration** supporting multiple AI providers and ASR systems
- **Both CLI and library** interfaces for different use cases

## What It Does

This project is a **pipeline orchestrator** for spoken-to-text workflows. It coordinates transcription input from external ASR systems (like Whisper) and applies AI-powered post-processing to produce clean, structured text outputs.

**What the pipeline does:**

* Orchestrates transcription of audio files using external ASR services (e.g., Whisper)
* Cleans raw ASR output to remove filler words, fix punctuation, and improve readability
* Generates structured handouts
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

## Quick Start

Get the pipeline running in three steps:

### Prerequisites

1. **A Whisper ASR server** running and accessible (see [Whisper Integration](docs/whisper-integration.md))
2. **An AI provider API key** (OpenAI or DeepSeek) for post-processing steps
3. **Audio files** in `.wav` format ready to process

### Step 1: Install

```bash
npm install -g spoken-to-text-pipeline
```

### Step 2: Create Configuration

Create a `pipeline.config.json` file:

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

You can omit API keys from the config by setting `SPOKEN_TO_TEXT_OPENAI_API_KEY` and/or `SPOKEN_TO_TEXT_DEEPSEEK_API_KEY` in the environment.

### Step 3: Run

Place your `.wav` audio files in the `inputDir` directory, then run:

```bash
spoken-to-text
```

The pipeline will transcribe, clean, and generate outputs in the `outputDir` directory.

## Documentation

### Getting Started
- **[Getting Started Guide](docs/getting-started.md)** - Complete setup instructions
- **[Installation](docs/installation.md)** - Detailed installation guide

### Usage Guides
- **[CLI Usage](docs/cli-usage.md)** - Command-line interface reference
- **[Programmatic Usage](docs/programmatic-usage.md)** - Library API reference for Node.js integration

### Configuration
- **[Configuration Reference](docs/configuration.md)** - Complete configuration options and examples
- **[Whisper Integration](docs/whisper-integration.md)** - Setting up and configuring Whisper ASR

### Pipeline Details
- **[Pipeline Steps](docs/pipeline-steps.md)** - Detailed documentation for each pipeline step
- **[Use Cases](docs/use-cases.md)** - Common workflows and examples
- **[Architecture](docs/architecture.md)** - System design and internals

### Advanced Topics
- **[Advanced Topics](docs/advanced-topics.md)** - Advanced configuration, customization, and best practices

## Basic Usage Examples

### CLI

```bash
# Use default config file
spoken-to-text

# Specify custom config
spoken-to-text --config my-config.json
```

### Programmatic

```typescript
import { runPipeline } from "spoken-to-text-pipeline";
import type { PipelineConfig } from "spoken-to-text-pipeline";

const config: PipelineConfig = {
  profile: "lecture",
  // ... configuration
};

const result = await runPipeline({ config });

if (result.success) {
  console.log("Pipeline completed successfully");
} else {
  console.error("Pipeline failed:", result.error);
}
```

See [Programmatic Usage](docs/programmatic-usage.md) for more details.

## Key Features

- **Profile-based processing:** Optimized workflows for lectures, meetings, and general transcription
- **AI-powered cleaning:** Removes filler words, fixes punctuation, improves readability
- **Structured outputs:** Generates handouts with table of contents
- **Dynamic summaries:** Automatically calculates summary length based on content size
- **Idempotent operations:** Safe to re-run, only processes new or changed files
- **Multiple AI providers:** Support for OpenAI and DeepSeek
- **Context-aware processing:** Maintains consistency across sequential files
- **Flexible configuration:** Per-step AI configuration, custom prompts, and more

## Who Is This For?

This project serves developers and technical users who need to process spoken audio into structured text at scale.

**Primary audiences:**

* **Developers building transcription workflows** who need a reusable, configurable pipeline component
* **Educators and researchers** processing recorded lectures, seminars, or educational content into study materials
* **Teams working with long-form audio** (meetings, interviews, presentations) who require clean transcripts and summaries
* **Users who want reproducible, scriptable pipelines** rather than manual, one-off transcription tasks

The pipeline assumes familiarity with Node.js and basic command-line usage, but does not require deep knowledge of ASR systems or AI model internals.

## Contributing

Contributions are welcome! Please see [CONTRIBUTING.md](CONTRIBUTING.md) for guidelines on how to contribute to this project.

## License

ISC
