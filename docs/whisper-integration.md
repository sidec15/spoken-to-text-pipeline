# Whisper ASR Integration

The pipeline requires a Whisper ASR server to handle audio transcription. You can run Whisper locally using Docker.

## Table of Contents

- [Overview](#overview)
- [Quick Start with Docker Compose](#quick-start-with-docker-compose)
- [Model Selection Guide](#model-selection-guide)
- [Configuring the Pipeline for Whisper](#configuring-the-pipeline-for-whisper)
- [Verifying the Setup](#verifying-the-setup)

## Overview

The recommended approach is to use the `onerahmet/openai-whisper-asr-webservice` Docker image, which provides an HTTP API compatible with the pipeline.

## Quick Start with Docker Compose

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

## Model Selection Guide

**Note:** Adjust `ASR_MODEL` and `ASR_LANGUAGE` according to your needs and available machine resources. For CPU-based systems processing long lectures, `small` is recommended as the default model.

### Resource Requirements

- **`base`**: ~1GB RAM, fastest processing
- **`small`**: ~2GB RAM, recommended default for CPU systems
- **`medium`**: ≥10GB RAM (Docker Desktop), 2-4× real-time processing
- **`large`**: ≥14-16GB RAM (Docker Desktop), very slow on CPU-only systems

Ensure Docker Desktop has sufficient memory allocated (Settings → Resources → Memory). All configuration options are documented in the comments within the docker-compose.yml file above.

## Configuring the Pipeline for Whisper

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

### Optional Whisper Configuration

You can customize transcription behavior. See the [Configuration Reference](configuration.md#asr-configuration) for detailed options including:

- `task`: `"transcribe"` (same language) or `"translate"` (to English)
- `outputFormat`: `"txt"`, `"json"`, `"srt"`, `"vtt"`, or `"tsv"`
- `temperature`: Decoding temperature (0-1), lower = more deterministic
- `beamSize`: Beam search size (higher = better accuracy, slower)
- `bestOf`: Number of candidates to consider
- `vad`: Voice Activity Detection settings (requires `faster_whisper` engine)
- `requestTimeoutMs`: Request timeout per audio file (default: 1 hour, recommended: 15 minutes for long files)

**Timeout Behavior:**
- **Connection timeout**: 30 seconds (fixed) - If the server doesn't accept a connection within 30 seconds, the request fails immediately with a clear error message
- **Request timeout**: Configurable via `requestTimeoutMs` (default: 1 hour) - Maximum time for the entire request including upload, processing, and response download

## Verifying the Setup

Test that your Whisper server is accessible:

```bash
curl http://localhost:9000/asr
```

You should receive a response indicating the server is running. If the pipeline fails to connect, check:

1. The Docker container is running: `docker ps`
2. Port 9000 is accessible: `curl http://localhost:9000/asr`
3. The `serverUrl` in your config matches the actual server address
4. Firewall rules allow connections to the server port

**Troubleshooting Connection Timeouts:**

If you see errors like "Failed to connect to Whisper server" or "connection timeout", this indicates:

- **Connection timeout (30 seconds)**: The server didn't accept the connection within 30 seconds. This usually means:
  - The server is not running or not accessible
  - Network/firewall issues
  - The server is overloaded and can't accept new connections

- **Request timeout**: The connection was established but the request took too long. Increase `requestTimeoutMs` in your config if processing long audio files.

The pipeline distinguishes between these two timeout types to help diagnose the issue.
