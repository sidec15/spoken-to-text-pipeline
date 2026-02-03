# Programmatic Usage (Library)

Use the pipeline programmatically in your Node.js application by importing `runPipeline` and providing a configuration object.

## Table of Contents

- [Basic Usage](#basic-usage)
- [Using Configuration Objects](#using-configuration-objects)
- [Custom Logger](#custom-logger)
- [Custom Progress Reporter](#custom-progress-reporter)
- [Error Handling](#error-handling)
- [TypeScript Types](#typescript-types)
- [API Reference](#api-reference)

## Basic Usage

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

## Using Configuration Objects

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

## Custom Logger

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

## Custom Progress Reporter

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

## Error Handling

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

## TypeScript Types

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

## API Reference

**`runPipeline(options: PipelineOptions): Promise<PipelineResult>`**

Runs the pipeline with the provided options.

- `options.config` (required): Pipeline configuration object
- `options.logger` (optional): Custom logger instance. If not provided, a default logger is created based on `config.logging`
- `options.progress` (optional): Custom progress reporter. If not provided, a no-op reporter is used

Returns a promise that resolves to a `PipelineResult`:
- `success: boolean` - Whether the pipeline completed successfully
- `error?: string` - Error message if the pipeline failed

## See Also

- [Configuration Reference](configuration.md) - Configuration options
- [CLI Usage](cli-usage.md) - Command-line interface
- [Getting Started Guide](getting-started.md) - Setup instructions
