# Installation

The pipeline requires **Node.js** (version 18 or higher) and can be installed as either a library dependency or a global CLI tool.

## Table of Contents

- [Install as a Library](#install-as-a-library)
- [Install as a CLI Tool](#install-as-a-cli-tool)
- [Installing from Source](#installing-from-source)
- [Prerequisites](#prerequisites)
- [Next Steps](#next-steps)

## Install as a Library

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

## Install as a CLI Tool

To use the pipeline as a command-line tool, install it globally:

```bash
npm install -g spoken-to-text-pipeline
```

After installation, the `spoken-to-text` command will be available in your PATH.

Alternatively, use `npx` to run it without global installation:

```bash
npx spoken-to-text-pipeline --config path/to/config.json
```

## Installing from Source

If installing from source, build the project first:

```bash
npm install
npm run build
```

## Prerequisites

Before using the pipeline, ensure you have:

1. **Node.js** version 18 or higher
2. **A Whisper ASR server** running and accessible (see [Whisper Integration](whisper-integration.md))
3. **An AI provider API key** (OpenAI or DeepSeek) for post-processing steps

## Next Steps

- [Getting Started Guide](getting-started.md) - Complete setup instructions
- [Whisper Integration](whisper-integration.md) - Setting up Whisper ASR
- [Configuration Reference](configuration.md) - Configuration options
