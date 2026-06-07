# Getting Started

Get the pipeline running in three steps: install, configure, and run.

## Table of Contents

- [Prerequisites](#prerequisites)
- [Step 1: Install](#step-1-install)
- [Step 2: Create Configuration](#step-2-create-configuration)
- [Step 3: Run](#step-3-run)
- [Understanding Outputs](#understanding-outputs)
- [Next Steps](#next-steps)

## Prerequisites

Before starting, ensure you have:

1. **A Whisper ASR server** running and accessible (see [Whisper Integration](whisper-integration.md))
2. **An AI provider API key** (OpenAI or DeepSeek) for post-processing steps
3. **Audio files** in `.wav` format ready to process

## Step 1: Install

Install globally for CLI usage:

```bash
npm install -g spoken-to-text-pipeline
```

See [Installation Guide](installation.md) for more installation options.

## Step 2: Create Configuration

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

Replace `your-openai-api-key` and `http://localhost:9000/asr` with your actual values. You can also set `SPOKEN_TO_TEXT_OPENAI_API_KEY` (and `SPOKEN_TO_TEXT_DEEPSEEK_API_KEY` for DeepSeek) instead of putting keys in the config file. The pipeline uses built-in default prompts for the selected profile.

For detailed configuration options, see the [Configuration Reference](configuration.md).

## Step 3: Run

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
3. Generate handout and summary
4. Write all outputs to the `outputDir` directory

Check the output directory for cleaned `.md` files, handouts, and summaries.

## Understanding Outputs

The pipeline generates several types of output files:

- **Raw transcripts** (`.txt` files) - Direct output from Whisper ASR
- **Cleaned transcripts** (`cleaned/*.md` files) - AI-cleaned versions of each part, with proper formatting
- **Merged cleaned transcript** (`clean-transcripts.md`) - All cleaned parts concatenated into one document
- **Handout** (`handout.md`) - Structured document with table of contents
- **Summary** (`summary.md`) - Summary of the content

See [Pipeline Steps](pipeline-steps.md) for detailed information about each step.

## Next Steps

- [Use Cases](use-cases.md) - Common workflows and examples
- [CLI Usage](cli-usage.md) - Command-line interface reference
- [Programmatic Usage](programmatic-usage.md) - Using the library API
- [Advanced Topics](advanced-topics.md) - Advanced configuration and customization
