# CLI Usage

The CLI tool `spoken-to-text` runs the pipeline using a JSON configuration file.

## Table of Contents

- [Basic Usage](#basic-usage)
- [Command Options](#command-options)
- [Execution Flow](#execution-flow)
- [Exit Codes](#exit-codes)
- [Examples](#examples)

## Basic Usage

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

Specify a base directory for resolving relative paths:

```bash
spoken-to-text --base-dir /path/to/project --config config.json
```

Or use the short form:

```bash
spoken-to-text -b ./project -c config.json
```

Run in dry-run mode to validate configuration without executing:

```bash
spoken-to-text --dry-run --config config.json
```

Or use the short form:

```bash
spoken-to-text -d -c config.json
```

## Command Options

- `-c, --config PATH` - Path to the pipeline configuration file (default: `pipeline.config.json`)
- `-b, --base-dir PATH` - Base directory for resolving relative paths in configuration (default: current working directory)
- `-d, --dry-run` - Run in dry-run mode: validate configuration and show execution plan without executing
- `-h, --help` - Display help message and exit

## Execution Flow

When you run the CLI:

1. The configuration file is loaded and validated
2. If `--dry-run` is specified, the pipeline validates the configuration and shows the execution plan, then exits without executing any steps
3. Otherwise, the pipeline executes all steps sequentially:
   - **ASR Step**: Transcribes audio files from `inputDir` using Whisper
   - **Cleaning Step**: Cleans raw transcripts with AI
   - **Handout Step**: Generates handout (lecture profile only)
   - **Summary Step**: Generates summary
4. Progress is displayed in the terminal with a progress bar (not shown in dry-run mode)
5. Logs are written to the console based on the configured log level
6. All outputs are written to the `outputDir` directory (skipped in dry-run mode)

## Exit Codes

- `0` - Pipeline completed successfully
- `1` - Pipeline failed (error message displayed)

## Examples

Process audio files with default config:

```bash
spoken-to-text
```

Use a production configuration:

```bash
spoken-to-text --config configs/production.json
```

Or use the short form:

```bash
spoken-to-text -c configs/production.json
```

Specify a base directory for resolving relative paths:

```bash
spoken-to-text --base-dir /path/to/project --config config.json
```

Or use the short form:

```bash
spoken-to-text -b ./project -c config.json
```

Validate configuration without executing (dry-run):

```bash
spoken-to-text --dry-run --config config.json
```

Or use the short form:

```bash
spoken-to-text -d -c config.json
```

Get help:

```bash
spoken-to-text --help
```

## See Also

- [Getting Started Guide](getting-started.md) - Complete setup instructions
- [Configuration Reference](configuration.md) - Configuration options
- [Programmatic Usage](programmatic-usage.md) - Using the library API
