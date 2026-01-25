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
  - filesystem paths
  - AI provider configuration
  - ASR configuration
  - optional context sources
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
  - scan audio directory
  - skip already transcribed files (idempotent)
  - transcribe audio → raw text
- Output:
  - `raw/part-XX.txt`

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
  - detect raw transcripts
  - skip already cleaned files
  - load:
    - manual context
    - previous cleaned output (optional)
  - call AI service
- Output:
  - `clean/part-XX.md`

---

## 8️⃣ Dispensa / Handout Step (Future)
- Merge cleaned parts
- Reorganize conceptually (not temporally)
- Produce:
  - structured lecture handout
- AI-driven with dedicated prompts

---

## 9️⃣ Summary Step (Future)
- Generate structured summary from handout
- Fixed length (~1000 words)
- Strict Markdown formatting rules

---

## 🔟 Pipeline Orchestration
- Execute steps in order:
  1. ASR
  2. Cleaning
  3. (Future) Handout
  4. (Future) Summary
- Provide:
  - progress bars per step
  - contextual logging
  - graceful skipping

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
