# Pipeline Architecture

This document describes the architecture and design of the spoken-to-text-pipeline.

## Table of Contents

- [Overview](#overview)
- [Step Isolation](#step-isolation)
- [AI Usage Pattern](#ai-usage-pattern)
- [Flexibility and Reusability](#flexibility-and-reusability)
- [Design Principles](#design-principles)

## Overview

The pipeline operates as a **sequential series of isolated steps**, each performing a specific transformation on the data. Steps are executed in order, with each step consuming outputs from previous steps and producing artifacts for subsequent steps.

```
Audio Files
   ↓
ASR (external, e.g. Whisper)
   ↓
Raw Transcription (.txt files)
   ↓
Cleaning (AI-powered)
   ↓
Cleaned Transcripts (.md files)
   ↓
Handout Generation (all profiles when enabled)
   ↓
Summary Generation
   ↓
Final Artifacts
```

## Step Isolation

Each step operates independently and can be enabled or disabled via configuration. Steps check for existing outputs and skip processing when artifacts already exist (idempotency), allowing safe re-runs and incremental processing.

## AI Usage Pattern

**AI usage occurs after transcription:** The pipeline uses AI models exclusively for post-processing steps (cleaning, handout generation, summary). The actual speech-to-text conversion is handled by external ASR systems, keeping concerns separated and allowing users to choose their preferred ASR provider.

## Flexibility and Reusability

This separation makes the pipeline flexible—users can swap ASR providers, adjust AI models per step, or skip steps entirely. The modular design allows the same pipeline to serve different use cases (lectures, meetings, general transcription) through profile-based configuration without code changes.

## Design Principles

1. **Separation of Concerns**: ASR and AI post-processing are separate
2. **Idempotency**: Steps can be safely re-run
3. **Profile-Based Configuration**: Different use cases through configuration, not code
4. **Provider Agnostic**: Support multiple AI and ASR providers
5. **Modular Steps**: Each step is independent and testable
