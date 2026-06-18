# Pipeline Steps

The pipeline executes a series of sequential steps, each performing a specific transformation on the data. This document describes each step in detail.

## Table of Contents

- [Step Execution Order](#step-execution-order)
- [ASR Step (Transcription)](#asr-step-transcription)
- [Cleaning Step](#cleaning-step)
- [Handout Step](#handout-step)
- [Summary Step](#summary-step)
- [Step Isolation and Idempotency](#step-isolation-and-idempotency)
- [Batch Execution Mode](#batch-execution-mode)

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

**Output:**
- Per-part cleaned transcripts (`.md` format) in the `cleaned/` subdirectory of `paths.outputDir` — one file per raw part, with the same base name (e.g. `part-1.txt` → `cleaned/part-1.md`).
- A single merged `clean-transcripts.md` at the root of `paths.outputDir`, concatenating all cleaned parts in order. This is a convenience artifact for reading the full cleaned transcript; it is **not** consumed by later steps (the handout step reads the per-part files in `cleaned/`, and the summary step's fallback re-merges from `cleaned/` in memory).

**What it does:**
- Removes filler words and hesitations
- Fixes punctuation and capitalization
- Improves paragraph structure
- Maintains consistency across sequential files
- Uses context materials if provided (see [Context Materials](configuration.md#context-materials))

**Behavior:**
- Processes files sequentially, using previous transcripts as context (sync mode)
- Applies profile-specific cleaning prompts
- Writes each cleaned part to `cleaned/<base>.md` (e.g. `part-1.txt` → `cleaned/part-1.md`)
- After all parts are cleaned, merges them into `clean-transcripts.md` at the output root: each part's per-part metadata header is stripped, a single document header is prepended, and the parts are joined in numeric order. This merge is a plain concatenation — **no AI call** — so it preserves every part exactly, and it runs identically in both sync and batch modes.

**Configuration:** See [AI Provider Configuration](configuration.md#ai-provider-configuration) and [Step Configuration](configuration.md#step-configuration-steps) (including optional `prompt` / `promptFile` overrides).

**Idempotency:** If a cleaned file already exists, the step is skipped for that file (sync mode). In batch mode, only parts whose output file is missing are included in the batch request; parts that already have a cleaned file are skipped when the batch results are applied.

**Batch behaviour** (when `execution: "batch"` is set for this step):
- One batch request is submitted per raw transcript part.
- Each request carries reference-only excerpts of the adjacent raw parts (approximately the last 2000 characters of the previous part and the first 2000 characters of the next part) so the model can maintain cross-part continuity without having access to the full neighbour files.
- The batch job is submitted once and its id is persisted to `<outputDir>/.cache/cleaning/batch/state.json`. If the run is interrupted, re-running the same command resumes the same job (does not resubmit).
- When results arrive, each part's cleaned file is written independently. If individual parts errored inside the batch, those output files are left missing; a re-run will detect the missing files and reprocess only those parts (a new batch job is submitted for the missing parts only).
- On terminal batch failure (`failed`, `expired`, or `cancelled`) the state is cleared and the run throws. A re-run resubmits the full cleaning batch.

## Handout Step

The handout step generates a structured handout document from cleaned transcripts. It runs for all profiles (unless disabled via `steps.handout.enabled`).

**Input:** All cleaned transcript files (`.md` format) from cleaning step

**Output:** `handout.md` file written to `paths.outputDir`

**What it does:**
- Processes one cleaned transcript file at a time (incremental generation)
- Each file is sent to the AI along with the last portion of the previously generated handout
- The handout is built progressively, file by file
- Each part's AI result is persisted to `<outputDir>/.cache/handout/incremental/drafts/<part>.md` immediately after the call, so a run that fails partway through **resumes from the last completed part** on re-run instead of re-issuing (and re-paying for) calls already made
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

**Idempotency:** If `handout.md` already exists, the step is skipped (both sync and batch modes).

**Batch behaviour** (when `execution: "batch"` is set for this step):

The handout step uses a **map-reduce approach** when running in batch mode:

- **Stage 1 (batch):** One batch request is submitted per cleaned transcript part. Each request produces an independent draft section — no global introduction, conclusion, or global numbering is produced at this stage. Neighbor excerpts from adjacent cleaned parts (approximately the last 2000 characters of the previous part and the first 2000 characters of the next part) are included to smooth transitions. All Stage 1 drafts are batched into a single OpenAI Batch API job.
- **Stage 2 (mechanical merge):** After the batch completes, the ordered drafts are merged **in-process, with no AI call**. The merge concatenates the drafts and applies one global hierarchical heading numbering — re-numbering all sections from 1, with subsections inheriting their parent's number (`## 1.`, `## 2.`, `### 2.1`, …). Because there is no model request, this stage is instant and cannot time out, regardless of session size. (Cross-draft de-duplication and transition smoothing are not performed mechanically; Stage 1 already drafts each part with neighbor excerpts and an instruction never to reproduce them, so seam overlap is minimal.)

If any Stage 1 draft fails inside the batch, the run throws before writing `handout.md` (no partial output is written). A re-run will resubmit the Stage 1 batch job in full. Completed Stage 1 drafts are persisted to `<outputDir>/.cache/handout/batch/drafts/<part>.md`; if the batch succeeded but a later step failed, the re-run reuses those drafts instead of resubmitting the batch.

The batch job id is persisted to `<outputDir>/.cache/handout/batch/state.json` at submit time. If the run is interrupted during Stage 1 polling, re-running resumes the same batch job. On terminal failure the state is cleared and the run throws.

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

**Idempotency:** If `summary.md` already exists, the step is skipped (both sync and batch modes).

**Batch behaviour** (when `execution: "batch"` is set for this step):

The summary step adapts based on input size:

- **Single-pass** (input is ≤ 90,000 tokens): One batch request is submitted for the entire input. The batch job id is persisted to `<outputDir>/.cache/summary/batch/state.json`. If the batch result contains an error, the run throws before writing `summary.md`. A re-run resumes the batch job if it is still running, or resubmits if the state has been cleared by a terminal failure.
- **Chunked** (input exceeds 90,000 tokens): The input is split into chunks and one batch request per chunk is submitted in a single batch job. After the batch completes, a single synchronous merge call combines the per-chunk summaries into the final summary (same merge logic as sync mode). The merge runs at full price but is one call.

In both cases, `summary.md` is the idempotency marker — if it already exists the entire step is skipped. A failed batch result throws before the file is written, so a re-run always retries cleanly.

## Step Isolation and Idempotency

Each step operates independently:

- **Isolation:** Steps can be enabled or disabled via configuration
- **Idempotency:** Steps check for existing outputs and skip processing when artifacts already exist
- **Safe re-runs:** You can safely re-run the pipeline without reprocessing completed steps
- **Incremental processing:** Add new audio files and only new files will be processed

In batch mode, idempotency has an additional dimension: in-flight batch jobs are also idempotent. Each step's job state is persisted to `<outputDir>/.cache/<step>/batch/state.json` immediately after submission. Re-running the pipeline before the batch completes resumes the same job rather than submitting a new one.

## Batch Execution Mode

An overview of how batch execution affects each step:

| Step | Batch strategy | Sync fallback within step | Partial-failure behaviour |
|---|---|---|---|
| **Cleaning** | One request per raw part; neighbor excerpts included for context | None — all outputs written from batch results | Missing output files on re-run are reprocessed in a new batch |
| **Handout** | Stage 1: one draft per cleaned part (batch); Stage 2: global merge (mechanical, in-process) | Stage 2 merge is a no-AI in-process concatenation + heading renumber | Any Stage 1 failure throws before writing `handout.md`; re-run resubmits Stage 1 |
| **Summary** | Single-pass (≤90k tokens): one request; Chunked (>90k): one request per chunk | Chunked merge is always sync | Failure throws before writing `summary.md`; re-run resumes or resubmits |

**Resume contract:** each step stores its own batch record at `<outputDir>/.cache/<step>/batch/state.json` (e.g. `.cache/cleaning/batch/state.json`, `.cache/handout/batch/state.json`). The record is written at submission and cleared when the batch completes successfully or fails terminally. Corrupt state (invalid JSON) is treated as a hard error rather than silently discarding progress.

**Auxiliary cache:** all of the above progress artifacts — per-step batch state, handout batch drafts, and handout incremental fragments — live under a single `<outputDir>/.cache` folder. On a **successful** run this folder is deleted (controlled by [`output.dropCache`](configuration.md#output-configuration), default `true`); on failure it is kept so the next run can resume.

**Terminal failures** (`failed`, `expired`, `cancelled`): state is cleared and the run throws with the batch id and failure counts. A re-run will resubmit a fresh batch job for that step.

**Configuration:** See [Batch Execution Mode](configuration.md#batch-execution-mode) in the Configuration Reference for `execution`, `ai.batch.pollIntervalMs`, and `ai.batch.maxWaitMs`.

## See Also

- [Architecture](architecture.md) - Pipeline design and principles
- [Configuration Reference](configuration.md) - Step configuration options
- [Use Cases](use-cases.md) - Common workflows
