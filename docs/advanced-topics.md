# Advanced Topics

This document covers advanced configuration, customization, and best practices.

## Table of Contents

- [Idempotency and Re-running](#idempotency-and-re-running)
- [Custom Prompts](#custom-prompts)
- [Per-Step AI Configuration](#per-step-ai-configuration)
- [Logging and Progress Reporting](#logging-and-progress-reporting)
- [Dynamic Summary Word Count](#dynamic-summary-word-count)
- [Context Materials Best Practices](#context-materials-best-practices)
- [Performance Optimization](#performance-optimization)
- [Troubleshooting](#troubleshooting)

## Idempotency and Re-running

The pipeline is designed to be **idempotent** - you can safely re-run it without reprocessing completed work.

### How It Works

Each step checks for existing outputs before processing:
- **ASR Step**: Skips files that already have corresponding `.txt` transcripts
- **Cleaning Step**: Skips files that already have corresponding `.md` cleaned files
- **Handout Step**: Skips if `handout.md` already exists
- **Summary Step**: Skips if `summary.md` already exists

### Use Cases

**Incremental Processing:**
- Add new audio files to `inputDir`
- Re-run the pipeline
- Only new files are processed

**Re-running After Errors:**
- If a step fails, fix the issue and re-run
- Completed steps are skipped
- Only failed steps are retried

**Updating Configuration:**
- Change prompts or AI models
- Delete specific output files to reprocess them
- Re-run to apply new settings

### Manual Control

To force reprocessing of a specific file:
1. Delete the corresponding output file(s)
2. Re-run the pipeline
3. The deleted file(s) will be regenerated

## Custom Prompts

You can customize the AI prompts used in each step by providing custom prompt text in your configuration.

### Default Prompts

By default, the pipeline uses optimized prompts based on your selected profile. These prompts are designed to work well for their respective use cases.

### Customizing Prompts

Override default prompts in your configuration:

```json
{
  "profiles": {
    "lecture": {
      "prompts": {
        "cleaning": "Clean and normalize the lecture transcript, preserving all educational content.",
        "handout": "Transform cleaned transcripts into a structured handout with table of contents.",
        "summary": "Create a concise summary of the handout, approximately 1000 words."
      }
    }
  }
}
```

### Prompt Best Practices

1. **Be specific:** Clearly describe the task and desired output format
2. **Include language:** If using a non-English language, specify it in the prompt
3. **Set expectations:** Mention word counts, structure, or format requirements
4. **Test iteratively:** Start with small changes and test the results

### Prompt Variables

The pipeline automatically appends word count targets to summary prompts. You don't need to include this in your custom prompts - it's added automatically.

## Per-Step AI Configuration

You can configure different AI providers and models for each step.

### Example: Different Models Per Step

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

### Model Compatibility

When using per-step AI configuration, be aware that different models have different parameter support. The pipeline handles this automatically — if a model doesn't support `temperature`, the pipeline omits it even if configured in `overrides`.

See [Supported Models and Parameter Compatibility](configuration.md#supported-models-and-parameter-compatibility) for the full compatibility matrix.

### Use Cases

- **Cost optimization:** Use cheaper models for cleaning, premium models for summaries
- **Provider diversity:** Distribute load across multiple providers
- **Model specialization:** Use models optimized for specific tasks

## Logging and Progress Reporting

### Logging Configuration

Control log output with the `logging` configuration:

```json
{
  "logging": {
    "level": "info",
    "singleLine": false
  }
}
```

**Log Levels:**
- `"error"` - Only errors
- `"warn"` - Warnings and errors
- `"info"` - Informational messages (recommended)
- `"debug"` - All messages including debug details

**Format:**
- `singleLine: true` - Compact format, good for CI/CD
- `singleLine: false` - Multi-line format, better for development

### Custom Loggers (Programmatic Usage)

When using the library programmatically, you can provide a custom logger:

```typescript
import { runPipeline } from "spoken-to-text-pipeline";
import type { Logger } from "spoken-to-text-pipeline";

const logger: Logger = {
  error(message: string, err?: unknown) {
    // Custom error handling
  },
  warn(message: string) {
    // Custom warning handling
  },
  info(message: string) {
    // Custom info handling
  },
  debug(message: string) {
    // Custom debug handling
  },
  silly(message: string) {
    // Custom silly handling
  },
  withContext(ctx: Record<string, string | undefined>) {
    // Return logger with merged context
    return logger;
  }
};

await runPipeline({ config, logger });
```

### Progress Reporting (Programmatic Usage)

Provide a custom progress reporter:

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

await runPipeline({ config, progress: progressReporter });
```

## Dynamic Summary Word Count

The pipeline calculates summary word count dynamically based on input size and profile type. See [Output Configuration](configuration.md#output-configuration) for details.

### How It Works

- **Lecture profile**: 10-15% of input (handout already condensed)
- **Meeting profile**: 50% of input (preserves more detail)
- **Other profile**: 50% of input (preserves more detail)

The calculated value is bounded between 200 (minimum) and 5000 (maximum) words.

### Overriding Dynamic Calculation

To use a fixed word count instead:

```json
{
  "output": {
    "summaryWordCount": 1500
  }
}
```

## Context Materials Best Practices

### When to Use Context Files

- **Course materials:** Improve terminological accuracy for lectures
- **Glossaries:** Ensure consistent terminology
- **Previous transcripts:** Maintain consistency across processing sessions
- **Reference documents:** Provide background for meetings

### What NOT to Include

- **Current run transcripts:** These are automatically used as context
- **Very large files:** Keep context files focused and relevant
- **Unrelated content:** Only include materials relevant to the current processing

### Context File Format

- Supported formats: `.txt` and `.md`
- Use clear, structured content
- Include relevant terminology and definitions

## Performance Optimization

### Audio File Preparation

- **Split long files:** Break very long recordings into smaller chunks (10-15 minutes)
- **Use appropriate format:** `.wav` format is required
- **Zero-pad filenames:** Use `part-01.wav`, `part-02.wav` for correct ordering

### Whisper Configuration

- **Choose appropriate model:** `small` is recommended for CPU systems
- **Enable VAD:** Improves accuracy and reduces processing time
- **Set timeouts:** Use `requestTimeoutMs` for long files

### AI Provider Selection

- **Use reasoning models for deterministic tasks:** `gpt-5-mini` excels at cleaning and handout generation where consistency matters
- **Use standard models when you need temperature control:** `gpt-4o-mini` or `deepseek-chat` support `temperature` for tuning creativity in summaries
- **Reserve premium models for complex tasks:** Use `gpt-5` or `gpt-4o` for summaries of complex content
- **Monitor API usage:** Track costs and usage across providers

## Troubleshooting

### Common Issues

**Whisper connection errors:**
- Verify Whisper server is running: `curl http://localhost:9000/asr`
- Check `serverUrl` in configuration
- Verify firewall rules

**AI API errors:**
- Verify API keys are correct
- Check API rate limits
- Ensure sufficient API credits
- **`400 Unsupported parameter: 'temperature'`**: This should not happen with the latest version — the pipeline automatically omits `temperature` for reasoning models (gpt-5 series, o-series, deepseek-reasoner). If you see this error, ensure you are running the latest version of the pipeline.

**File processing order:**
- Use zero-padded filenames for correct ordering
- Check file naming conventions

**Memory issues:**
- Reduce Whisper model size
- Split large audio files
- Limit concurrent processing

## See Also

- [Configuration Reference](configuration.md) - Complete configuration options
- [Pipeline Steps](pipeline-steps.md) - Step-by-step documentation
- [Architecture](architecture.md) - System design
