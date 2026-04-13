# Installation

The pipeline can be installed as a **standalone executable** (no Node.js required) or, if you already have **Node.js** (version 18 or higher), as a library dependency or global CLI tool.

## Table of Contents

- [Install as a Standalone Executable](#install-as-a-standalone-executable)
- [Install as a Library](#install-as-a-library)
- [Install as a CLI Tool](#install-as-a-cli-tool)
- [Installing from Source](#installing-from-source)
- [Building Standalone Binaries Locally](#building-standalone-binaries-locally)
- [Publishing a Release](#publishing-a-release)
- [Prerequisites](#prerequisites)
- [Next Steps](#next-steps)

## Install as a Standalone Executable

This is the simplest way to use the tool: download a standalone executable from [Releases](../../releases) — no Node.js installation required.

Each release includes binaries built for:

| Platform              | Download                         |
| --------------------- | -------------------------------- |
| Windows (x64)         | `spoken-to-text-win-x64.exe`     |
| Linux (x64)           | `spoken-to-text-linux-x64`       |
| macOS (Intel)         | `spoken-to-text-macos-x64`       |
| macOS (Apple Silicon) | `spoken-to-text-macos-arm64`     |

After downloading:

- **Windows:** run `spoken-to-text-win-x64.exe` (rename or add its folder to your `PATH` if you want to invoke `spoken-to-text` from anywhere).
- **Linux / macOS:** make the file executable, then run it (optionally move it to a directory on your `PATH` and name it `spoken-to-text`):

```bash
chmod +x spoken-to-text-macos-arm64
./spoken-to-text-macos-arm64 --help
```

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

## Building Standalone Binaries Locally

To produce the same kind of executables as in [Releases](../../releases) on your machine:

```bash
npm run package
```

Artifacts are written to `bin/` for Windows, Linux, and macOS (x64 + ARM64).

If you only need a Windows build (faster):

```bash
npm run package:win
```

## Publishing a Release

Pre-built executables are published automatically via GitHub Actions when you push a version tag. **Do not create releases manually** — the workflow creates the release and uploads the binaries.

```bash
git tag v1.0.1
git push --tags
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
