# 🧭 Spoken-to-Text-Pipeline — Step-by-Step Roadmap

## 1️⃣ Project & Runtime Foundations
- Initialize Node.js + TypeScript project
- Configure:
  - `tsconfig.json`
  - `package.json` scripts (dev, build, run)
- Setup:
  - Structured logger with contextual metadata
  - Progress reporting (`cli-progress`)
  - Idempotent filesystem conventions
- Define **Step interface** and **Pipeline runner**

---

## 2️⃣ Configuration System
- Create a **single JSON config file** for the whole pipeline
- Define:
  - `profile` (lecture, meeting, etc.)
  - input/output language
  - filesystem paths:
    - `inputDir`: audio input directory
    - `outputDir`: base output directory (all outputs go here)
  - AI provider configuration
  - ASR configuration
  - optional context sources
  - output options:
    - `addTimestamp`: optional timestamp prefix/suffix on outputDir
    - `summaryWordCount`: configurable summary length (default: 1000)
- Add:
  - strong typing (`PipelineConfig`)
  - config resolver & validator
- Ensure:
  - defaults + overrides
  - profile-driven behavior

---

## 3️⃣ Audio Preparation (External / Manual)
- Audio cleanup & splitting (Audacity or equivalent)
- Convert to:
  - WAV
  - fixed-length chunks (~10 minutes)
- Store in:
  - `audio/input/`
- This step is **explicitly outside the pipeline**

---

## 4️⃣ ASR Step (Whisper)
- Implement `AsrStep`
- Use:
  - Whisper ASR service (HTTP)
  - profile-based parameter presets
- Responsibilities:
  - scan `inputDir` for audio files
  - skip already transcribed files (idempotent)
  - transcribe audio → raw text
- Output:
  - `{outputDir}/part-XX.txt` (raw transcripts)

---

## 5️⃣ AI Abstraction Layer
- Define `AiService` interface
- Implement:
  - `OpenAiService` (GPT-5-mini)
- Support:
  - multiple input messages
  - role separation
  - structured prompt assembly
- Keep:
  - provider-specific logic isolated

---

## 6️⃣ Prompt System (Critical)
### Prompt 1 — System Prompt
- Defines:
  - role
  - rules
  - cleaning behavior
  - output constraints
- Stored in:
  - profile presets

### Prompt 2 — Optional Manual Context
- Reference-only
- Loaded from user-provided text sources
- Bounded & injected only if present

### Prompt 3 — Previous Cleaned Excerpt
- Reference-only
- Used for continuity across parts
- Tail-only (bounded)

### Prompt 4 — Current Raw Transcript
- The **only** content to transform

---

## 7️⃣ Cleaning Step
- Implement `CleaningStep`
- Responsibilities:
  - detect raw transcripts from `{outputDir}/part-XX.txt`
  - skip already cleaned files (idempotent)
  - load:
    - manual context
    - previous cleaned output (optional, for continuity)
  - call AI service with all 4 prompts
- Output:
  - `{outputDir}/part-XX.md` (cleaned transcripts)

---

## 8️⃣ Handout Step (Future)
- Implement `HandoutStep`
- Profile-specific:
  - **Lecture**: creates handout
  - **Meeting/Other**: skipped (no handout)
- Responsibilities:
  - read all cleaned files from `{outputDir}/part-XX.md` (sorted)
  - merge all cleaned parts with clear separators
  - skip if handout already exists (idempotent)
  - handle token limits: start with full merge, add chunking if needed
  - call AI service with handout prompt
- Input strategy:
  - Merge all cleaned files: `---\n## Part N\n\n{content}\n`
  - If exceeds model context: implement smart chunking or use larger context model
- Output:
  - `{outputDir}/handout.md` (conceptually reorganized, thematic structure)

---

## 9️⃣ Summary Step (Future)
- Implement `SummaryStep`
- Profile-specific input:
  - **Lecture**: reads `{outputDir}/handout.md`
  - **Meeting/Other**: merges all `{outputDir}/part-XX.md` files
- Responsibilities:
  - read input (handout or merged cleaned files)
  - skip if summary already exists (idempotent)
  - call AI service with summary prompt
  - enforce word count (configurable, default: 1000 words)
- Configuration:
  - `output.summaryWordCount`: target word count (default: 1000)
  - Include word count target in system prompt
  - Post-process validation (warn if significantly off)
- Output:
  - `{outputDir}/summary.md` (structured summary, ~1000 words by default)

---

## 🔟 Pipeline Orchestration
- Execute steps in order:
  1. ASR → `{outputDir}/part-XX.txt`
  2. Cleaning → `{outputDir}/part-XX.md`
  3. Handout → `{outputDir}/handout.md` (only for lecture profile)
  4. Summary → `{outputDir}/summary.md` (all profiles)
- Provide:
  - progress bars per step
  - contextual logging
  - graceful skipping
  - conditional step execution based on profile
- Output directory handling:
  - User specifies base `outputDir`
  - Optional timestamp: `{outputDir}_yyyyMMddHHmmss` if `addTimestamp: true`
  - All outputs go directly in output directory (no subfolders)

---

## 1️⃣1️⃣ Idempotency & Safety
- Every step:
  - checks outputs before running
  - never overwrites silently
- Deterministic AI behavior:
  - fixed prompts
  - low temperature
- Reproducible runs

---

## 1️⃣2️⃣ Extensibility
- New profiles (meeting, interview, therapy session)
- New AI providers
- New prompt versions
- New output formats

---

## 🧠 Key Design Principles
- Separation of concerns
- Explicit prompt boundaries
- Text-only AI inputs
- Progressive transformation
- Human-auditable outputs
- Automation without losing control
