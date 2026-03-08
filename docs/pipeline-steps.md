# Pipeline Steps

The pipeline executes a series of sequential steps, each performing a specific transformation on the data. This document describes each step in detail.

## Table of Contents

- [Step Execution Order](#step-execution-order)
- [ASR Step (Transcription)](#asr-step-transcription)
- [Cleaning Step](#cleaning-step)
- [Handout Step](#handout-step)
- [Summary Step](#summary-step)
- [Step Isolation and Idempotency](#step-isolation-and-idempotency)

## Step Execution Order

```
Audio Files
   ↓
ASR Step (Transcription)
   ↓
Cleaning Step
   ↓
Handout Step
   ↓
Summary Step
   ↓
Final Artifacts
```

## ASR Step (Transcription)

The ASR (Automatic Speech Recognition) step transcribes audio files into raw text.

**Input:** Audio files (`.wav` format) from `paths.inputDir`

**Output:** Raw transcript files (`.txt` format) written to `paths.outputDir`

**Behavior:**
- Processes files in alphabetical order
- Sends each audio file to the configured Whisper ASR server
- Writes raw transcripts with the same base name as the input file
- Example: `part-1.wav` → `part-1.txt`

**Configuration:** See [ASR Configuration](configuration.md#asr-configuration)

**Idempotency:** If a transcript file already exists, the step is skipped for that file.

## Cleaning Step

The cleaning step uses AI to clean and normalize raw transcripts.

**Input:** Raw transcript files (`.txt` format) from ASR step

**Output:** Cleaned transcript files (`.md` format) written to `paths.outputDir`

**What it does:**
- Removes filler words and hesitations
- Fixes punctuation and capitalization
- Improves paragraph structure
- Maintains consistency across sequential files
- Uses context materials if provided (see [Context Materials](configuration.md#context-materials))

**Behavior:**
- Processes files sequentially, using previous transcripts as context
- Applies profile-specific cleaning prompts
- Writes cleaned markdown files with the same base name
- Example: `part-1.txt` → `part-1.md`

**Configuration:** See [AI Provider Configuration](configuration.md#ai-provider-configuration) and [Step Configuration](configuration.md#step-configuration-steps) (including optional `prompt` / `promptFile` overrides).

**Idempotency:** If a cleaned file already exists, the step is skipped for that file.

## Handout Step

The handout step generates a structured handout document from cleaned transcripts. It runs for all profiles (unless disabled via `steps.handout.enabled`).

**Input:** All cleaned transcript files (`.md` format) from cleaning step

**Output:** `handout.md` file written to `paths.outputDir`

**What it does:**
- Processes one cleaned transcript file at a time (incremental generation)
- Each file is sent to the AI along with the last portion of the previously generated handout
- The handout is built progressively, file by file
- Organizes content into hierarchical sections
- Uses profile-specific prompts from `profilePresets` (lecture, meeting, other)
- Creates a polished handout suitable for study or distribution
- **No table of contents** — output uses hierarchical headings, no meta header (header is added post-processing)

**Behavior:**
- Runs for all profiles (lecture, meeting, other) when enabled
- Reads all cleaned transcript files from the `cleaned` subdirectory (sorted by numeric part index)
- Uses profile-specific prompts (override via `steps.handout.prompt` or `steps.handout.promptFile`)
- Generates a unified handout with numbered sections

**Configuration:** See [AI Provider Configuration](configuration.md#ai-provider-configuration) and [Step Configuration](configuration.md#step-configuration).

**Idempotency:** If `handout.md` already exists, the step is skipped.

## Summary Step

The summary step generates a summary of the processed content.

**Input:** 
- When `handout.md` exists (all profiles): Summary uses the handout
- When handout is missing (e.g. handout step disabled): Merged cleaned transcript files (`.md` format)

**Output:** `summary.md` file written to `paths.outputDir`

**What it does:**
- Analyzes the input content
- Generates a concise summary with key points
- Uses dynamic word count calculation based on input size and profile
- Adapts summary length to content size

**Behavior:**
- Prefers `handout.md` when present (all profiles)
- Falls back to merged cleaned files when handout is not available
- Uses profile-specific prompts
- Calculates target word count dynamically (see [Output Configuration](configuration.md#output-configuration))

**Configuration:** See [Output Configuration](configuration.md#output-configuration) for `summaryWordCount` settings

**Idempotency:** If `summary.md` already exists, the step is skipped.

## Step Isolation and Idempotency

Each step operates independently:

- **Isolation:** Steps can be enabled or disabled via configuration
- **Idempotency:** Steps check for existing outputs and skip processing when artifacts already exist
- **Safe re-runs:** You can safely re-run the pipeline without reprocessing completed steps
- **Incremental processing:** Add new audio files and only new files will be processed

## See Also

- [Architecture](architecture.md) - Pipeline design and principles
- [Configuration Reference](configuration.md) - Step configuration options
- [Use Cases](use-cases.md) - Common workflows
