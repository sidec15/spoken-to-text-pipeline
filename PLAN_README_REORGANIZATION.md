# Plan: README Reorganization

## Current State

The README.md is **1,341 lines** and contains:
- Overview and introduction
- Installation instructions
- Quick start guide
- Detailed CLI usage
- Detailed programmatic usage
- Whisper ASR integration (very detailed)
- Complete configuration reference (very large)
- Pipeline steps documentation
- Advanced topics
- Contributing and license

## Goals

1. **Keep README focused** on:
   - Why this tool exists (problem statement)
   - Quick overview of what it does
   - Quick start guide
   - Links to detailed documentation

2. **Move detailed docs** to `docs/` folder:
   - Configuration reference
   - Advanced topics
   - Detailed usage guides
   - API reference
   - Integration guides

3. **Maintain discoverability** with clear navigation

## Proposed Structure

### README.md (Simplified - ~200-300 lines)

**Sections to keep:**
1. **Overview** - What is this? Why does it exist?
   - Problem statement (real-time transcription services exist, but post-processing options are limited/paid)
   - Brief description
   - Key features

2. **Quick Start** - Get running in 3 steps
   - Prerequisites
   - Installation
   - Basic configuration
   - Run command

3. **Documentation Links** - Navigation to detailed docs
   - Links to all docs files

4. **Basic Usage** - Very brief examples
   - CLI example
   - Programmatic example

5. **Contributing & License** - Keep these

**Sections to remove/move:**
- Detailed configuration reference → `docs/configuration.md`
- Whisper ASR integration details → `docs/whisper-integration.md`
- Detailed CLI usage → `docs/cli-usage.md`
- Detailed programmatic usage → `docs/programmatic-usage.md`
- Pipeline steps details → `docs/pipeline-steps.md`
- Advanced topics → `docs/advanced-topics.md`
- Use cases and workflows → `docs/use-cases.md`
- Architecture details → `docs/architecture.md`

### docs/ Folder Structure

```
docs/
├── README.md                    # Documentation index/overview
├── getting-started.md           # Detailed getting started guide
├── installation.md             # Detailed installation instructions
├── configuration.md            # Complete configuration reference
├── whisper-integration.md      # Whisper ASR setup and configuration
├── cli-usage.md                # CLI tool detailed usage
├── programmatic-usage.md        # Library API reference
├── pipeline-steps.md           # Detailed step documentation
├── use-cases.md                # Use cases and workflows
├── advanced-topics.md          # Advanced configuration and customization
└── architecture.md             # Pipeline architecture and design
```

## Detailed Breakdown

### README.md Content

```markdown
# spoken-to-text-pipeline

[Brief description - 2-3 sentences]

## Why This Tool?

While there are many services that let users write transcripts in real-time, 
there are few alternatives when dealing with post-processing activities, 
and most of them are paid. This pipeline fills that gap by providing:

- [Key benefit 1]
- [Key benefit 2]
- [Key benefit 3]

## Quick Start

[3-step quick start - minimal, focused]

## Documentation

- [Getting Started](docs/getting-started.md) - Complete setup guide
- [Configuration](docs/configuration.md) - Configuration reference
- [CLI Usage](docs/cli-usage.md) - Command-line interface guide
- [Programmatic Usage](docs/programmatic-usage.md) - Library API reference
- [Whisper Integration](docs/whisper-integration.md) - ASR setup guide
- [Pipeline Steps](docs/pipeline-steps.md) - Step-by-step documentation
- [Use Cases](docs/use-cases.md) - Common workflows
- [Advanced Topics](docs/advanced-topics.md) - Advanced configuration
- [Architecture](docs/architecture.md) - System design and internals

## Basic Usage

### CLI

```bash
spoken-to-text --config pipeline.config.json
```

### Programmatic

```typescript
import { runPipeline } from "spoken-to-text-pipeline";
// [minimal example]
```

[Contributing & License sections]
```

### docs/configuration.md

**Content:**
- Complete configuration file structure
- All configuration options with detailed descriptions
- Configuration defaults
- Profile-specific settings
- Examples for each section
- Validation rules

**Sections:**
1. Configuration File Structure
2. Configuration Defaults
3. Profiles
4. Language Configuration
5. Logging Configuration
6. Paths Configuration
7. Input Audio Files
8. Context Materials
9. AI Provider Configuration
10. Output Configuration
11. ASR Configuration
12. Profile Prompts Configuration

### docs/whisper-integration.md

**Content:**
- Running Whisper locally with Docker
- Docker Compose setup
- Configuration options
- Model selection guide
- Resource requirements
- Troubleshooting

**Sections:**
1. Overview
2. Quick Start with Docker Compose
3. Docker Configuration Options
4. Model Selection Guide
5. Resource Requirements
6. Configuring the Pipeline
7. Troubleshooting

### docs/cli-usage.md

**Content:**
- Command-line interface reference
- All command options
- Execution flow
- Exit codes
- Examples

### docs/programmatic-usage.md

**Content:**
- Library API reference
- `runPipeline` function
- TypeScript types
- Custom logger
- Custom progress reporter
- Error handling
- Examples

### docs/pipeline-steps.md

**Content:**
- ASR Step (Transcription)
- Cleaning Step
- Handout Step
- Summary Step
- Step execution order
- Idempotency

### docs/use-cases.md

**Content:**
- Processing Recorded Lectures
- Generating Study Handouts
- Cleaning Whisper Raw Transcripts
- Batch Processing Multi-Part Recordings
- Each with detailed examples

### docs/advanced-topics.md

**Content:**
- Idempotency and Re-running
- Custom Prompts
- Per-Step AI Configuration
- Logging and Progress Reporting
- Dynamic Summary Word Count
- Context Materials Best Practices

### docs/architecture.md

**Content:**
- Pipeline Architecture
- Step isolation
- AI usage patterns
- Design decisions
- Extensibility

### docs/getting-started.md

**Content:**
- Prerequisites
- Installation (detailed)
- First configuration
- Running first pipeline
- Understanding outputs
- Next steps

## Migration Plan

### Phase 1: Create docs/ folder structure
1. Create `docs/` directory
2. Create all markdown files (empty or with placeholders)
3. Create `docs/README.md` as documentation index

### Phase 2: Extract content from README
1. Extract configuration section → `docs/configuration.md`
2. Extract Whisper integration → `docs/whisper-integration.md`
3. Extract CLI usage → `docs/cli-usage.md`
4. Extract programmatic usage → `docs/programmatic-usage.md`
5. Extract pipeline steps → `docs/pipeline-steps.md`
6. Extract use cases → `docs/use-cases.md`
7. Extract advanced topics → `docs/advanced-topics.md`
8. Extract architecture → `docs/architecture.md`
9. Create `docs/getting-started.md` from Quick Start + Installation

### Phase 3: Simplify README
1. Rewrite Overview section (focus on why)
2. Simplify Quick Start (3 steps, link to detailed guide)
3. Add Documentation Links section
4. Add Basic Usage section (minimal examples)
5. Keep Contributing & License

### Phase 4: Cross-references and links
1. Add internal links within docs files
2. Add links from README to docs
3. Add links from docs back to README where appropriate
4. Update Table of Contents in README

### Phase 5: Review and polish
1. Ensure all content is properly linked
2. Check for broken references
3. Verify navigation flow
4. Update any code examples if needed

## Benefits

1. **Readability**: README becomes scannable and focused
2. **Maintainability**: Detailed docs are easier to update in separate files
3. **Discoverability**: Clear navigation structure
4. **Scalability**: Easy to add new documentation without bloating README
5. **User Experience**: Users can quickly find what they need

## File Size Targets

- **README.md**: ~200-300 lines (down from 1,341)
- **docs/configuration.md**: ~400-500 lines
- **docs/whisper-integration.md**: ~200-300 lines
- **docs/cli-usage.md**: ~100-150 lines
- **docs/programmatic-usage.md**: ~200-250 lines
- **docs/pipeline-steps.md**: ~150-200 lines
- **docs/use-cases.md**: ~150-200 lines
- **docs/advanced-topics.md**: ~200-250 lines
- **docs/architecture.md**: ~100-150 lines
- **docs/getting-started.md**: ~150-200 lines

**Total**: ~1,850-2,500 lines (more detailed, better organized)

## Notes

- Keep all existing content (nothing deleted, just reorganized)
- Maintain all code examples
- Preserve all links and references
- Update internal links to point to new locations
- Consider adding a docs/README.md as a documentation hub
