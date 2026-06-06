# OpenAI Batch API Support Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add an opt-in `execution: "batch"` mode for the three AI steps (cleaning, handout, summary) that uses OpenAI's Batch API (~50% cheaper, async overnight turnaround) while keeping today's synchronous behaviour as the default.

**Architecture:** A new `BatchAiService` abstraction submits JSONL request files to OpenAI's `/v1/responses` batch endpoint, polls to completion, and collects results. A `batchCoordinator` persists job state to `<outputDir>/.batch/state.json` so a killed run resumes the same job. The sync `responses.create` body and the batch JSONL body are produced by one shared `buildResponsesRequest` builder, so prompt shape is identical across modes. Cross-part continuity (lost when parts run in parallel instead of sequentially) is preserved by passing reference-only excerpts of the neighboring raw/cleaned parts. Handout switches from sequential-incremental to map-reduce (parallel drafts + one sync merge) in batch mode.

**Tech Stack:** TypeScript (ESM, NodeNext), `openai@6.16.0` SDK (`client.batches`, `client.files`, `toFile`), Jest ESM with `jest.unstable_mockModule`, `node:fs`.

---

## Background facts (verified against the code)

- `resolveStepConfig` (`src/services/ai/aiServiceFactory.ts:181`) is the single merge point for per-step provider/model/overrides. It returns a `StepAiConfig`.
- `createAiService` (`src/services/ai/aiServiceFactory.ts:244`) and `getApiKey` (`:209`) are the existing service-construction helpers.
- `OpenAiService.generateTextAsync` (`src/services/ai/openai/openaiAiService.ts:41`) builds a `responses.create` request inline (input-item assembly at `:42-70`, temperature gating at `:74-90`, incomplete-response guard at `:95-104`).
- `AiGenerateOptions` (`src/services/ai/ai.types.ts:1`) has `systemPrompt`, `manualContextText?`, `previousOutputExcerpt?`, `userPrompt`, `temperature?`, `maxTokens?`.
- Prompt formatters live in `src/config/profilePresets.ts`: `formatManualContextPrompt` (`:19`), `formatPreviousOutputExcerptPrompt` (`:43`), `formatInputContentPrompt` (`:60`).
- `resolveOpenAiConfig` (`src/services/ai/openai/resolveOpenAiConfig.ts:24-25`) appends the output-language instruction string:
  `\n\nIMPORTANT: Output language is specified by ISO 639-1 two-letter code "${langCode}". All output must be written in that language. Write all content, including headings, annotations, and any text, exclusively in the language identified by code "${langCode}".`
- `CleaningStep` (`src/pipeline/steps/cleaningStep.ts`) cleans each raw `.txt` → `cleaned/<base>.md` sequentially, passing the previous *cleaned* tail as `previousOutputExcerpt` (`:130-144`), writes the metadata header on the first file only (`:146-151`, `buildContentWithOptionalHeader` `:189`), then merges via `mergeCleanedFiles` (`:203`). `PREVIOUS_OUTPUT_EXCERPT_CHARS = 2000` (`:15`). `getFilesToProcess` (`:99`) skips already-cleaned files (idempotency).
- `HandoutStep` (`src/pipeline/steps/handoutStep.ts`) builds incrementally via `generateHandoutIncremental` (`:104-152`) with a `CONTINUATION… continue numbering from section N` hint (`:126-129`); reads sorted cleaned files via `getSortedCleanedFiles` (`:64`); writes `handout.md` (`:49`); idempotency via `checkIdempotency` (`:53`).
- `SummaryStep` (`src/pipeline/steps/summaryStep.ts`) branches single-pass vs chunked at `MAX_SAFE_INPUT_TOKENS = 90000` (`:124-149`); chunked path loops `summarizeChunks` (`:360-401`) then `mergeChunkSummaries` (one call, `:406-440`); writes `summary.md` (`:70`).
- `runPipeline` (`src/pipeline/runPipeline.ts:85-88`) returns before any step runs when `dryRun` is set; steps invoked via `PipelineRunner` (`:93-102`).
- `Step` / `StepContext` (`src/pipeline/step.ts:5-17`): `StepContext = { config, baseDir?, outputDir, dryRun?, logger, progress }`.
- Test patterns: OpenAI mocked via `jest.unstable_mockModule('openai', …)` returning `{ default: MockOpenAI }` (`tests/services/ai/openai/openaiAiService.test.ts:1-26`); fs mocked via `jest.unstable_mockModule('node:fs', …)` returning both `default` and named exports (`tests/config/loadConfig.test.ts:11-19`). Imports of the module under test happen *after* the mock, inside `beforeEach`, via dynamic `import()`.
- OpenAI batch output JSONL line shape: `{ id, custom_id, response: { status_code, request_id, body: <Response object with output_text> }, error: null }`. Error lines (in `error_file_id`) carry a non-null `error`.

---

## File structure

**Create:**
- `src/services/ai/batch/batch.types.ts` — `BatchRequest`, `BatchJobStatus`, `BatchPollResult`, `BatchResult`, `BatchAiService` interface.
- `src/services/ai/openai/buildResponsesRequest.ts` — shared request-body builder + `isReasoningModel`.
- `src/services/ai/openai/openaiBatchService.ts` — `OpenAiBatchService implements BatchAiService`.
- `src/services/batch/batchState.ts` — `.batch/state.json` read/write/clear.
- `src/pipeline/batch/batchCoordinator.ts` — `runBatchStep` (submit/resume + auto-watch).
- Tests mirroring each new module under `tests/`.

**Modify:**
- `src/config/config.types.ts`, `src/config/loadConfig.ts` (no change to `config.defaults.ts`).
- `src/services/ai/ai.types.ts`, `src/config/profilePresets.ts`.
- `src/services/ai/aiServiceFactory.ts`, `src/services/ai/openai/openaiAiService.ts`.
- `src/pipeline/steps/cleaningStep.ts`, `src/pipeline/steps/handoutStep.ts`, `src/pipeline/steps/summaryStep.ts`.
- `docs/configuration.md`, `docs/pipeline-steps.md`.

**Task dependency order:** 1 → 2 → 3 → 4 → 5 → 6 → 7 → 8 → (9, 10, 11 independent) → 12.

---

### Task 1: Config types & validation for `execution` + `ai.batch`

**Files:**
- Modify: `src/config/config.types.ts`
- Modify: `src/config/loadConfig.ts`
- Test: `tests/config/loadConfig.test.ts` (extend)

- [ ] **Step 1: Add `execution` to `StepAiConfig` and `batch` to `AiConfig`**

In `src/config/config.types.ts`, inside `interface StepAiConfig` (after the `overrides?` field, before the closing `}` at line 103), add:

```typescript
  /**
   * Execution mode for AI generation (optional).
   * - "sync": synchronous Responses API call (default).
   * - "batch": OpenAI Batch API (~50% cheaper, async overnight turnaround).
   *   Requires provider "openai".
   * Default: "sync"
   */
  execution?: "sync" | "batch";
```

In the same file, inside `interface AiConfig` (after the `default?` field, before the closing `}` at line 155), add:

```typescript
  /**
   * Batch API tuning (optional). Used only by steps whose execution is "batch".
   * Default: { pollIntervalMs: 30000, maxWaitMs: undefined (wait indefinitely) }
   */
  batch?: {
    /** Poll interval in milliseconds while auto-watching a batch job. Default: 30000. */
    pollIntervalMs?: number;
    /** Max wall-clock wait in ms before leaving the job pending. Default: undefined (wait indefinitely). */
    maxWaitMs?: number;
  };
```

- [ ] **Step 2: Write failing validation tests**

Append to `tests/config/loadConfig.test.ts` a `describe("batch execution validation")` block. (These call the same `validateUserConfig` / `validateFinalConfig` entry points the existing tests use — match the surrounding test's import + invocation style.)

```typescript
describe("batch execution config", () => {
  it("accepts execution 'batch' on a step with openai provider", () => {
    const cfg = {
      profile: "lecture",
      ai: {
        providers: { openai: { apiKey: "sk-x" } },
        default: { provider: "openai", model: "gpt-5-mini" },
      },
      steps: { cleaning: { aiConfig: { execution: "batch" } } },
    };
    expect(() => validateUserConfig(cfg as any)).not.toThrow();
  });

  it("rejects an invalid execution value", () => {
    const cfg = {
      profile: "lecture",
      steps: { cleaning: { aiConfig: { execution: "nope" } } },
    };
    const errors = collectUserConfigErrors(cfg as any); // helper that returns the errors array
    expect(errors.some((e) => e.includes("execution"))).toBe(true);
  });

  it("rejects batch execution with a non-openai provider", () => {
    const cfg = {
      profile: "lecture",
      ai: {
        providers: { deepseek: { apiKey: "dk" } },
        default: { provider: "deepseek", model: "deepseek-chat", execution: "batch" },
      },
    };
    expect(() => buildFinalConfigForTest(cfg as any)).toThrow(/requires provider 'openai'/);
  });

  it("rejects non-positive ai.batch.pollIntervalMs", () => {
    const cfg = { profile: "lecture", ai: { batch: { pollIntervalMs: 0 } } };
    const errors = collectUserConfigErrors(cfg as any);
    expect(errors.some((e) => e.includes("ai.batch.pollIntervalMs"))).toBe(true);
  });
});
```

> Note: use whatever the existing tests use to drive validation (e.g. they may load via `loadConfig` with a mocked file, or call `validateUserConfig`/`validateFinalConfig` directly). Adapt the three helpers (`validateUserConfig`, `collectUserConfigErrors`, `buildFinalConfigForTest`) to the file's existing harness; do not invent new exports if the file already tests these paths through `loadConfig`.

- [ ] **Step 3: Run tests to verify they fail**

Run: `npm test -- tests/config/loadConfig.test.ts`
Expected: FAIL (the new assertions fail — `execution`/`ai.batch` not yet validated; batch+non-openai does not throw).

- [ ] **Step 4: Add `execution` validation in `validateUserConfig`**

In `src/config/loadConfig.ts`, immediately AFTER the `ai.default.overrides` validation block (ends at line 355), add validation for `defaultConfig.execution`:

```typescript
  if ("execution" in defaultConfig && defaultConfig.execution !== undefined) {
    if (defaultConfig.execution !== "sync" && defaultConfig.execution !== "batch") {
      errors.push(`Invalid 'ai.default.execution' field (must be "sync" or "batch")`);
    }
  }
```

Immediately AFTER the `steps.*.aiConfig.overrides` validation block (ends at line 422), add (uses the same `aiConfig` and `stepName` variables in scope there):

```typescript
  if ("execution" in aiConfig && aiConfig.execution !== undefined) {
    if (aiConfig.execution !== "sync" && aiConfig.execution !== "batch") {
      errors.push(`Invalid 'steps.${stepName}.aiConfig.execution' field (must be "sync" or "batch")`);
    }
  }
```

- [ ] **Step 5: Add `ai.batch` validation in `validateUserConfig`**

In `src/config/loadConfig.ts`, in the section where `config.ai` is validated (add after the `ai.default` validation, still inside the `if (config.ai)` guard — confirm the guard variable name and place this block before that guard closes):

```typescript
  if ("batch" in config.ai && config.ai.batch !== undefined) {
    const batch = config.ai.batch as Record<string, unknown>;
    if (typeof batch !== "object" || batch === null) {
      errors.push("Invalid 'ai.batch' field (must be an object)");
    } else {
      if ("pollIntervalMs" in batch &&
          (typeof batch.pollIntervalMs !== "number" || batch.pollIntervalMs <= 0)) {
        errors.push("Invalid 'ai.batch.pollIntervalMs' field (must be a positive number)");
      }
      if ("maxWaitMs" in batch &&
          (typeof batch.maxWaitMs !== "number" || batch.maxWaitMs <= 0)) {
        errors.push("Invalid 'ai.batch.maxWaitMs' field (must be a positive number)");
      }
    }
  }
```

- [ ] **Step 6: Add batch+provider check in `validateFinalConfig`**

In `src/config/loadConfig.ts`, after the per-step provider-pool checks (the `for (const stepName of validStepNames)` block ending at line 586), add a second loop that resolves `execution` and `provider` per AI step and requires openai for batch:

```typescript
  // Batch execution requires the openai provider (resolved per step).
  {
    const aiSteps = ["cleaning", "handout", "summary"] as const;
    const defaultProvider = config.ai?.default?.provider;
    const defaultExecution = config.ai?.default?.execution;
    for (const stepName of aiSteps) {
      const stepAi = config.steps?.[stepName]?.aiConfig;
      const execution = stepAi?.execution ?? defaultExecution ?? "sync";
      const provider = stepAi?.provider ?? defaultProvider;
      if (execution === "batch" && provider !== "openai") {
        errors.push(`Step '${stepName}': execution 'batch' requires provider 'openai'`);
      }
    }
  }
```

- [ ] **Step 7: Run tests to verify they pass**

Run: `npm test -- tests/config/loadConfig.test.ts`
Expected: PASS.

- [ ] **Step 8: Type-check**

Run: `npm run build`
Expected: no type errors.

- [ ] **Step 9: Commit**

```bash
git add src/config/config.types.ts src/config/loadConfig.ts tests/config/loadConfig.test.ts
git commit -m "feat(config): add execution mode and ai.batch tuning with validation"
```

---

### Task 2: Neighbor-context fields + reference-only formatters

**Files:**
- Modify: `src/services/ai/ai.types.ts`
- Modify: `src/config/profilePresets.ts`
- Test: `tests/config/profilePresets.test.ts` (extend)

- [ ] **Step 1: Add neighbor fields to `AiGenerateOptions`**

In `src/services/ai/ai.types.ts`, add two optional fields to `interface AiGenerateOptions` (after `previousOutputExcerpt?: string;` at line 6):

```typescript
  // Optional reference-only neighbor excerpts (batch mode cross-part continuity).
  // Presence/absence encodes position: no previousChunkExcerpt => first part;
  // no nextChunkExcerpt => last part.
  previousChunkExcerpt?: string;
  nextChunkExcerpt?: string;
```

- [ ] **Step 2: Write failing formatter tests**

Append to `tests/config/profilePresets.test.ts`:

```typescript
import {
  formatPrecedingContextPrompt,
  formatFollowingContextPrompt,
} from "../../src/config/profilePresets.js";

describe("neighbor context formatters", () => {
  it("wraps preceding context as reference-only and includes the text", () => {
    const out = formatPrecedingContextPrompt("tail of previous part");
    expect(out).toContain("tail of previous part");
    expect(out).toMatch(/PRECEDING/i);
    expect(out).toMatch(/do NOT include/i);
  });

  it("wraps following context as reference-only and includes the text", () => {
    const out = formatFollowingContextPrompt("head of next part");
    expect(out).toContain("head of next part");
    expect(out).toMatch(/FOLLOWING/i);
    expect(out).toMatch(/do NOT include/i);
  });
});
```

- [ ] **Step 3: Run tests to verify they fail**

Run: `npm test -- tests/config/profilePresets.test.ts`
Expected: FAIL with "formatPrecedingContextPrompt is not a function" (or import error).

- [ ] **Step 4: Implement the formatters**

In `src/config/profilePresets.ts`, after `formatPreviousOutputExcerptPrompt` (ends at line 54), add:

```typescript
/**
 * Formats the preceding-part excerpt (tail of the previous part) as reference-only
 * context for batch mode. Used so a part cleaned/drafted in parallel can stay
 * terminology- and boundary-consistent with what came before it.
 */
export function formatPrecedingContextPrompt(text: string): string {
  return `
END of the PRECEDING part (REFERENCE ONLY — for continuity, do NOT include it in your output)

---
${text}
---
  `.trim();
}

/**
 * Formats the following-part excerpt (head of the next part) as reference-only
 * context for batch mode.
 */
export function formatFollowingContextPrompt(text: string): string {
  return `
START of the FOLLOWING part (REFERENCE ONLY — for continuity, do NOT include it in your output)

---
${text}
---
  `.trim();
}
```

- [ ] **Step 5: Run tests to verify they pass**

Run: `npm test -- tests/config/profilePresets.test.ts`
Expected: PASS.

- [ ] **Step 6: Commit**

```bash
git add src/services/ai/ai.types.ts src/config/profilePresets.ts tests/config/profilePresets.test.ts
git commit -m "feat(ai): add neighbor-context options and reference-only formatters"
```

---

### Task 3: Shared `buildResponsesRequest` builder (refactor, no behaviour change)

**Files:**
- Create: `src/services/ai/openai/buildResponsesRequest.ts`
- Modify: `src/services/ai/openai/openaiAiService.ts`
- Test: `tests/services/ai/openai/buildResponsesRequest.test.ts`
- Test: `tests/services/ai/openai/openaiAiService.test.ts` (must stay green)

- [ ] **Step 1: Write failing builder unit test**

Create `tests/services/ai/openai/buildResponsesRequest.test.ts`:

```typescript
import { describe, it, expect } from "@jest/globals";
import type { AiGenerateOptions } from "../../../../src/services/ai/ai.types.js";
import { buildResponsesRequest } from "../../../../src/services/ai/openai/buildResponsesRequest.js";

const base: AiGenerateOptions = { systemPrompt: "SYS", userPrompt: "BODY" };

function roles(req: any): string[] {
  return (req.input as Array<{ role: string }>).map((m) => m.role);
}
function contents(req: any): string[] {
  return (req.input as Array<{ content: string }>).map((m) => m.content);
}

describe("buildResponsesRequest", () => {
  it("includes temperature for standard models when set", () => {
    const req = buildResponsesRequest({ ...base, temperature: 0.5 }, "gpt-4o-mini");
    expect(req.temperature).toBe(0.5);
    expect(req.model).toBe("gpt-4o-mini");
  });

  it("omits temperature for reasoning models even when set", () => {
    const req = buildResponsesRequest({ ...base, temperature: 0.5 }, "gpt-5-mini");
    expect(req.temperature).toBeUndefined();
  });

  it("includes max_output_tokens only when maxTokens is set", () => {
    expect(buildResponsesRequest(base, "gpt-4o-mini").max_output_tokens).toBeUndefined();
    expect(buildResponsesRequest({ ...base, maxTokens: 1000 }, "gpt-4o-mini").max_output_tokens).toBe(1000);
  });

  it("renders neighbor excerpts as reference-only messages in the documented order", () => {
    const req = buildResponsesRequest(
      {
        systemPrompt: "SYS",
        manualContextText: "MANUAL",
        previousChunkExcerpt: "PREV",
        nextChunkExcerpt: "NEXT",
        previousOutputExcerpt: "OUT",
        userPrompt: "BODY",
      },
      "gpt-4o-mini",
    );
    // order: system -> manualContext -> precedingContext -> followingContext -> previousOutputExcerpt -> userPrompt
    expect(roles(req)).toEqual(["system", "user", "user", "user", "user", "user"]);
    const joined = contents(req);
    expect(joined[2]).toContain("PREV");
    expect(joined[2]).toMatch(/PRECEDING/i);
    expect(joined[3]).toContain("NEXT");
    expect(joined[3]).toMatch(/FOLLOWING/i);
    expect(joined[5]).toContain("BODY");
  });

  it("omits the preceding block when previousChunkExcerpt is absent (first part)", () => {
    const req = buildResponsesRequest({ ...base, nextChunkExcerpt: "NEXT" }, "gpt-4o-mini");
    const joined = contents(req).join("\n");
    expect(joined).not.toMatch(/PRECEDING/i);
    expect(joined).toMatch(/FOLLOWING/i);
  });

  it("omits the following block when nextChunkExcerpt is absent (last part)", () => {
    const req = buildResponsesRequest({ ...base, previousChunkExcerpt: "PREV" }, "gpt-4o-mini");
    const joined = contents(req).join("\n");
    expect(joined).toMatch(/PRECEDING/i);
    expect(joined).not.toMatch(/FOLLOWING/i);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npm test -- tests/services/ai/openai/buildResponsesRequest.test.ts`
Expected: FAIL with module-not-found for `buildResponsesRequest.js`.

- [ ] **Step 3: Implement the builder**

Create `src/services/ai/openai/buildResponsesRequest.ts`:

```typescript
import OpenAI from "openai";
import type { AiGenerateOptions } from "../ai.types.js";
import {
  formatInputContentPrompt,
  formatManualContextPrompt,
  formatPreviousOutputExcerptPrompt,
  formatPrecedingContextPrompt,
  formatFollowingContextPrompt,
} from "../../../config/profilePresets.js";

/**
 * OpenAI reasoning models do NOT support the `temperature` parameter.
 * Reasoning families: gpt-5*, o1*, o3*, o4*.
 */
const OPENAI_REASONING_MODEL_PREFIXES = ["gpt-5", "o1", "o3", "o4"];

export function isReasoningModel(model: string): boolean {
  const lower = model.toLowerCase();
  return OPENAI_REASONING_MODEL_PREFIXES.some((prefix) => lower.startsWith(prefix));
}

/**
 * Builds the OpenAI Responses API request body from provider-independent options.
 * Shared by the sync service and the batch JSONL builder so prompt shape is identical.
 *
 * Input-item order: system -> manualContext -> precedingContext -> followingContext
 * -> previousOutputExcerpt -> userPrompt. Neighbor blocks are emitted only when the
 * corresponding excerpt is present (omission encodes first/last part — see design §2).
 */
export function buildResponsesRequest(
  options: AiGenerateOptions,
  model: string,
): Parameters<OpenAI.Responses["create"]>[0] {
  const input: OpenAI.Responses.ResponseInputItem[] = [];

  // 1. System prompt (always present)
  input.push({ role: "system", content: options.systemPrompt });

  // 2. Optional manual context
  if (options.manualContextText?.trim()) {
    input.push({ role: "user", content: formatManualContextPrompt(options.manualContextText) });
  }

  // 3. Optional preceding-part excerpt (absent => first part)
  if (options.previousChunkExcerpt?.trim()) {
    input.push({ role: "user", content: formatPrecedingContextPrompt(options.previousChunkExcerpt) });
  }

  // 4. Optional following-part excerpt (absent => last part)
  if (options.nextChunkExcerpt?.trim()) {
    input.push({ role: "user", content: formatFollowingContextPrompt(options.nextChunkExcerpt) });
  }

  // 5. Optional previous output excerpt (sync continuity)
  if (options.previousOutputExcerpt?.trim()) {
    input.push({ role: "user", content: formatPreviousOutputExcerptPrompt(options.previousOutputExcerpt) });
  }

  // 6. Main input content (mandatory)
  input.push({ role: "user", content: formatInputContentPrompt(options.userPrompt) });

  const reasoning = isReasoningModel(model);

  return {
    model,
    input,
    ...(!reasoning && options.temperature !== undefined && { temperature: options.temperature }),
    ...(options.maxTokens !== undefined && { max_output_tokens: options.maxTokens }),
  };
}
```

- [ ] **Step 4: Run builder test to verify it passes**

Run: `npm test -- tests/services/ai/openai/buildResponsesRequest.test.ts`
Expected: PASS.

- [ ] **Step 5: Refactor `openaiAiService.ts` to use the builder**

Replace the body of `generateTextAsync` and the file's top-of-file `isReasoningModel`/prefix block in `src/services/ai/openai/openaiAiService.ts` so the file becomes:

```typescript
import OpenAI from "openai";
import type { AiService, AiGenerateOptions } from "../ai.types.js";
import { buildResponsesRequest } from "./buildResponsesRequest.js";

export class OpenAiService implements AiService {
  private client: OpenAI;
  private model: string;

  constructor(apiKey: string, model: string) {
    this.client = new OpenAI({ apiKey });
    this.model = model;
  }

  async generateTextAsync(options: AiGenerateOptions): Promise<string> {
    const requestParams = buildResponsesRequest(options, this.model);

    const response = (await this.client.responses.create(requestParams)) as OpenAI.Responses.Response;

    // Guard against incomplete responses (e.g. reasoning model exhausted the token budget)
    if (response.status === "incomplete") {
      const reason = response.incomplete_details?.reason ?? "unknown";
      throw new Error(
        `OpenAI response incomplete (reason: ${reason}). ` +
          `Model '${this.model}' with max_output_tokens=${options.maxTokens ?? "default"} ` +
          `did not produce a complete answer. Consider increasing or removing maxTokens.`,
      );
    }

    return response.output_text;
  }
}
```

- [ ] **Step 6: Run the existing service test + builder test**

Run: `npm test -- tests/services/ai/openai/openaiAiService.test.ts tests/services/ai/openai/buildResponsesRequest.test.ts`
Expected: BOTH PASS (sync behaviour unchanged — the existing test still green).

- [ ] **Step 7: Type-check**

Run: `npm run build`
Expected: no type errors.

- [ ] **Step 8: Commit**

```bash
git add src/services/ai/openai/buildResponsesRequest.ts src/services/ai/openai/openaiAiService.ts tests/services/ai/openai/buildResponsesRequest.test.ts
git commit -m "refactor(ai): extract shared buildResponsesRequest used by sync service"
```

---

### Task 4: Batch service types

**Files:**
- Create: `src/services/ai/batch/batch.types.ts`

- [ ] **Step 1: Create the types file**

Create `src/services/ai/batch/batch.types.ts`:

```typescript
import type { AiGenerateOptions } from "../ai.types.js";

/** A single batch request: a stable custom id plus the same options sync would use. */
export interface BatchRequest {
  customId: string;
  options: AiGenerateOptions;
}

/** OpenAI batch lifecycle status (mirrors client.batches status values). */
export type BatchJobStatus =
  | "validating"
  | "in_progress"
  | "finalizing"
  | "completed"
  | "failed"
  | "expired"
  | "cancelling"
  | "cancelled";

export interface BatchPollResult {
  status: BatchJobStatus;
  requestCounts?: { completed: number; failed: number; total: number };
}

/** One collected result keyed by customId; `text` on success, `error` on failure. */
export interface BatchResult {
  customId: string;
  text?: string;
  error?: string;
}

/** Provider-agnostic batch service abstraction (only OpenAI implements it in v1). */
export interface BatchAiService {
  /** Submit requests; returns the provider batch id. */
  submit(requests: BatchRequest[]): Promise<string>;
  /** Poll a batch's status. */
  poll(batchId: string): Promise<BatchPollResult>;
  /** Collect results after the batch has completed. */
  collect(batchId: string): Promise<BatchResult[]>;
}
```

- [ ] **Step 2: Type-check**

Run: `npm run build`
Expected: no type errors.

- [ ] **Step 3: Commit**

```bash
git add src/services/ai/batch/batch.types.ts
git commit -m "feat(batch): add BatchAiService types"
```

---

### Task 5: OpenAI batch service implementation

**Files:**
- Create: `src/services/ai/openai/openaiBatchService.ts`
- Test: `tests/services/ai/openai/openaiBatchService.test.ts`

- [ ] **Step 1: Write failing tests**

Create `tests/services/ai/openai/openaiBatchService.test.ts`:

```typescript
import { describe, it, expect, beforeEach, jest } from "@jest/globals";
import type { BatchRequest } from "../../../../src/services/ai/batch/batch.types.js";

const mockFilesCreate = jest.fn();
const mockFilesContent = jest.fn();
const mockBatchesCreate = jest.fn();
const mockBatchesRetrieve = jest.fn();
const mockToFile = jest.fn(async (buf: any, name: any) => ({ buf, name }));

jest.unstable_mockModule("openai", () => {
  const MockOpenAI = jest.fn().mockImplementation(() => ({
    files: { create: mockFilesCreate, content: mockFilesContent },
    batches: { create: mockBatchesCreate, retrieve: mockBatchesRetrieve },
  }));
  return { default: MockOpenAI, toFile: mockToFile };
});

describe("OpenAiBatchService", () => {
  let OpenAiBatchService: any;
  let service: any;

  beforeEach(async () => {
    jest.clearAllMocks();
    const mod = await import("../../../../src/services/ai/openai/openaiBatchService.js");
    OpenAiBatchService = mod.OpenAiBatchService;
    service = new OpenAiBatchService("sk-test", "gpt-5-mini");
  });

  it("submit uploads JSONL with /v1/responses lines and creates a 24h batch", async () => {
    mockFilesCreate.mockResolvedValue({ id: "file_123" });
    mockBatchesCreate.mockResolvedValue({ id: "batch_abc" });

    const requests: BatchRequest[] = [
      { customId: "cleaning::part-01", options: { systemPrompt: "S", userPrompt: "A" } },
      { customId: "cleaning::part-02", options: { systemPrompt: "S", userPrompt: "B" } },
    ];

    const id = await service.submit(requests);
    expect(id).toBe("batch_abc");

    // JSONL passed to toFile
    const jsonlArg = mockToFile.mock.calls[0][0];
    const jsonlText = Buffer.isBuffer(jsonlArg) ? jsonlArg.toString("utf-8") : String(jsonlArg);
    const lines = jsonlText.trim().split("\n").map((l) => JSON.parse(l));
    expect(lines[0].custom_id).toBe("cleaning::part-01");
    expect(lines[0].method).toBe("POST");
    expect(lines[0].url).toBe("/v1/responses");
    expect(lines[0].body.model).toBe("gpt-5-mini");

    expect(mockFilesCreate).toHaveBeenCalledWith(
      expect.objectContaining({ purpose: "batch" }),
    );
    expect(mockBatchesCreate).toHaveBeenCalledWith(
      expect.objectContaining({
        input_file_id: "file_123",
        endpoint: "/v1/responses",
        completion_window: "24h",
      }),
    );
  });

  it("poll maps status and request_counts", async () => {
    mockBatchesRetrieve.mockResolvedValue({
      status: "in_progress",
      request_counts: { completed: 3, failed: 0, total: 9 },
    });
    const res = await service.poll("batch_abc");
    expect(res.status).toBe("in_progress");
    expect(res.requestCounts).toEqual({ completed: 3, failed: 0, total: 9 });
  });

  it("collect parses output JSONL into customId -> text", async () => {
    mockBatchesRetrieve.mockResolvedValue({
      status: "completed",
      output_file_id: "out_1",
      error_file_id: null,
    });
    const outJsonl =
      JSON.stringify({
        custom_id: "cleaning::part-01",
        response: { status_code: 200, body: { status: "completed", output_text: "CLEANED A" } },
      }) + "\n";
    mockFilesContent.mockResolvedValue({ text: async () => outJsonl });

    const results = await service.collect("batch_abc");
    expect(results).toEqual([{ customId: "cleaning::part-01", text: "CLEANED A" }]);
  });

  it("collect marks customIds from the error file with an error", async () => {
    mockBatchesRetrieve.mockResolvedValue({
      status: "completed",
      output_file_id: "out_1",
      error_file_id: "err_1",
    });
    const outJsonl =
      JSON.stringify({
        custom_id: "cleaning::part-01",
        response: { status_code: 200, body: { status: "completed", output_text: "OK" } },
      }) + "\n";
    const errJsonl =
      JSON.stringify({
        custom_id: "cleaning::part-02",
        error: { message: "rate limited" },
      }) + "\n";
    mockFilesContent
      .mockResolvedValueOnce({ text: async () => outJsonl })
      .mockResolvedValueOnce({ text: async () => errJsonl });

    const results = await service.collect("batch_abc");
    expect(results).toContainEqual({ customId: "cleaning::part-01", text: "OK" });
    expect(results).toContainEqual({
      customId: "cleaning::part-02",
      error: expect.stringContaining("rate limited"),
    });
  });
});
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `npm test -- tests/services/ai/openai/openaiBatchService.test.ts`
Expected: FAIL with module-not-found for `openaiBatchService.js`.

- [ ] **Step 3: Implement the batch service**

Create `src/services/ai/openai/openaiBatchService.ts`:

```typescript
import OpenAI, { toFile } from "openai";
import type {
  BatchAiService,
  BatchJobStatus,
  BatchPollResult,
  BatchRequest,
  BatchResult,
} from "../batch/batch.types.js";
import { buildResponsesRequest } from "./buildResponsesRequest.js";

export class OpenAiBatchService implements BatchAiService {
  private client: OpenAI;
  private model: string;

  constructor(apiKey: string, model: string) {
    this.client = new OpenAI({ apiKey });
    this.model = model;
  }

  async submit(requests: BatchRequest[]): Promise<string> {
    const jsonl = requests
      .map((r) =>
        JSON.stringify({
          custom_id: r.customId,
          method: "POST",
          url: "/v1/responses",
          body: buildResponsesRequest(r.options, this.model),
        }),
      )
      .join("\n");

    const file = await this.client.files.create({
      file: await toFile(Buffer.from(jsonl, "utf-8"), "batch.jsonl"),
      purpose: "batch",
    });

    const batch = await this.client.batches.create({
      input_file_id: file.id,
      endpoint: "/v1/responses",
      completion_window: "24h",
    });

    return batch.id;
  }

  async poll(batchId: string): Promise<BatchPollResult> {
    const batch = await this.client.batches.retrieve(batchId);
    const counts = batch.request_counts;
    return {
      status: batch.status as BatchJobStatus,
      requestCounts: counts
        ? { completed: counts.completed, failed: counts.failed, total: counts.total }
        : undefined,
    };
  }

  async collect(batchId: string): Promise<BatchResult[]> {
    const batch = await this.client.batches.retrieve(batchId);
    const results: BatchResult[] = [];

    if (batch.output_file_id) {
      const content = await this.client.files.content(batch.output_file_id);
      const text = await content.text();
      for (const line of text.split("\n")) {
        const trimmed = line.trim();
        if (!trimmed) continue;
        const parsed = JSON.parse(trimmed) as {
          custom_id: string;
          response?: { status_code?: number; body?: { status?: string; output_text?: string } };
          error?: { message?: string } | null;
        };
        if (parsed.error) {
          results.push({ customId: parsed.custom_id, error: parsed.error.message ?? "unknown error" });
          continue;
        }
        const body = parsed.response?.body;
        if (body?.status === "incomplete") {
          results.push({ customId: parsed.custom_id, error: "OpenAI response incomplete" });
          continue;
        }
        results.push({ customId: parsed.custom_id, text: body?.output_text ?? "" });
      }
    }

    if (batch.error_file_id) {
      const content = await this.client.files.content(batch.error_file_id);
      const text = await content.text();
      for (const line of text.split("\n")) {
        const trimmed = line.trim();
        if (!trimmed) continue;
        const parsed = JSON.parse(trimmed) as {
          custom_id: string;
          error?: { message?: string } | null;
          response?: { body?: { error?: { message?: string } } };
        };
        const message =
          parsed.error?.message ?? parsed.response?.body?.error?.message ?? "batch request failed";
        results.push({ customId: parsed.custom_id, error: message });
      }
    }

    return results;
  }
}
```

> Note: `client.files.content(...)` returns a `Response`-like object; `.text()` reads the JSONL body. If a type error appears on `.text()`, cast via `as unknown as { text(): Promise<string> }` — keep the runtime call identical to the test mock.

- [ ] **Step 4: Run tests to verify they pass**

Run: `npm test -- tests/services/ai/openai/openaiBatchService.test.ts`
Expected: PASS.

- [ ] **Step 5: Type-check**

Run: `npm run build`
Expected: no type errors.

- [ ] **Step 6: Commit**

```bash
git add src/services/ai/openai/openaiBatchService.ts tests/services/ai/openai/openaiBatchService.test.ts
git commit -m "feat(batch): implement OpenAiBatchService over /v1/responses"
```

---

### Task 6: Batch state persistence

**Files:**
- Create: `src/services/batch/batchState.ts`
- Test: `tests/services/batch/batchState.test.ts`

- [ ] **Step 1: Write failing tests**

Create `tests/services/batch/batchState.test.ts`:

```typescript
import { describe, it, expect, beforeEach, jest } from "@jest/globals";

const mockExistsSync = jest.fn();
const mockReadFileSync = jest.fn();
const mockWriteFileSync = jest.fn();
const mockMkdirSync = jest.fn();

jest.unstable_mockModule("node:fs", () => ({
  default: {
    existsSync: mockExistsSync,
    readFileSync: mockReadFileSync,
    writeFileSync: mockWriteFileSync,
    mkdirSync: mockMkdirSync,
  },
  existsSync: mockExistsSync,
  readFileSync: mockReadFileSync,
  writeFileSync: mockWriteFileSync,
  mkdirSync: mockMkdirSync,
}));

describe("batchState", () => {
  let readBatchState: any, writeBatchJob: any, clearBatchJob: any;

  beforeEach(async () => {
    jest.clearAllMocks();
    const mod = await import("../../../src/services/batch/batchState.js");
    readBatchState = mod.readBatchState;
    writeBatchJob = mod.writeBatchJob;
    clearBatchJob = mod.clearBatchJob;
  });

  it("returns empty state when the file does not exist", () => {
    mockExistsSync.mockReturnValue(false);
    const state = readBatchState("/out");
    expect(state).toEqual({ version: 1, jobs: {} });
  });

  it("reads and parses an existing state file", () => {
    mockExistsSync.mockReturnValue(true);
    mockReadFileSync.mockReturnValue(
      JSON.stringify({ version: 1, jobs: { cleaning: { batchId: "batch_x", submittedAt: "t", customIds: ["cleaning::part-01"] } } }),
    );
    const state = readBatchState("/out");
    expect(state.jobs.cleaning.batchId).toBe("batch_x");
  });

  it("writeBatchJob creates .batch dir and persists the job", () => {
    mockExistsSync.mockReturnValue(false);
    writeBatchJob("/out", "cleaning", { batchId: "batch_x", submittedAt: "t", customIds: ["cleaning::part-01"] });
    expect(mockMkdirSync).toHaveBeenCalledWith(expect.stringContaining(".batch"), { recursive: true });
    const written = JSON.parse(mockWriteFileSync.mock.calls[0][1] as string);
    expect(written.jobs.cleaning.batchId).toBe("batch_x");
  });

  it("clearBatchJob removes the job and rewrites state", () => {
    mockExistsSync.mockReturnValue(true);
    mockReadFileSync.mockReturnValue(
      JSON.stringify({ version: 1, jobs: { cleaning: { batchId: "batch_x", submittedAt: "t", customIds: [] } } }),
    );
    clearBatchJob("/out", "cleaning");
    const written = JSON.parse(mockWriteFileSync.mock.calls[0][1] as string);
    expect(written.jobs.cleaning).toBeUndefined();
  });
});
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `npm test -- tests/services/batch/batchState.test.ts`
Expected: FAIL with module-not-found for `batchState.js`.

- [ ] **Step 3: Implement the state module**

Create `src/services/batch/batchState.ts`:

```typescript
import fs from "node:fs";
import path from "node:path";

export interface BatchJobRecord {
  batchId: string;
  submittedAt: string;
  customIds: string[];
}

export interface BatchState {
  version: 1;
  jobs: Record<string, BatchJobRecord | undefined>;
}

const STATE_DIR = ".batch";
const STATE_FILE = "state.json";

function stateDir(outputDir: string): string {
  return path.join(outputDir, STATE_DIR);
}
function statePath(outputDir: string): string {
  return path.join(stateDir(outputDir), STATE_FILE);
}

export function readBatchState(outputDir: string): BatchState {
  const file = statePath(outputDir);
  if (!fs.existsSync(file)) {
    return { version: 1, jobs: {} };
  }
  const raw = fs.readFileSync(file, "utf-8");
  const parsed = JSON.parse(raw) as BatchState;
  return { version: 1, jobs: parsed.jobs ?? {} };
}

function writeState(outputDir: string, state: BatchState): void {
  fs.mkdirSync(stateDir(outputDir), { recursive: true });
  fs.writeFileSync(statePath(outputDir), JSON.stringify(state, null, 2), "utf-8");
}

export function writeBatchJob(outputDir: string, step: string, job: BatchJobRecord): void {
  const state = readBatchState(outputDir);
  state.jobs[step] = job;
  writeState(outputDir, state);
}

export function clearBatchJob(outputDir: string, step: string): void {
  const state = readBatchState(outputDir);
  delete state.jobs[step];
  writeState(outputDir, state);
}
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `npm test -- tests/services/batch/batchState.test.ts`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add src/services/batch/batchState.ts tests/services/batch/batchState.test.ts
git commit -m "feat(batch): add .batch/state.json persistence"
```

---

### Task 7: Batch coordinator (submit/resume + auto-watch)

**Files:**
- Create: `src/pipeline/batch/batchCoordinator.ts`
- Test: `tests/pipeline/batch/batchCoordinator.test.ts`

- [ ] **Step 1: Write failing tests**

Create `tests/pipeline/batch/batchCoordinator.test.ts`:

```typescript
import { describe, it, expect, beforeEach, jest } from "@jest/globals";

const mockReadBatchState = jest.fn();
const mockWriteBatchJob = jest.fn();
const mockClearBatchJob = jest.fn();

jest.unstable_mockModule("../../../src/services/batch/batchState.js", () => ({
  readBatchState: mockReadBatchState,
  writeBatchJob: mockWriteBatchJob,
  clearBatchJob: mockClearBatchJob,
}));

const logger = { info: jest.fn(), warn: jest.fn(), error: jest.fn(), debug: jest.fn(), silly: jest.fn() } as any;

function makeService(overrides: any = {}) {
  return {
    submit: jest.fn(async () => "batch_new"),
    poll: jest.fn(),
    collect: jest.fn(async () => [{ customId: "c::1", text: "OUT" }]),
    ...overrides,
  };
}

describe("runBatchStep", () => {
  let runBatchStep: any;

  beforeEach(async () => {
    jest.clearAllMocks();
    const mod = await import("../../../src/pipeline/batch/batchCoordinator.js");
    runBatchStep = mod.runBatchStep;
  });

  it("submits, persists state, watches to completion, then clears state", async () => {
    mockReadBatchState.mockReturnValue({ version: 1, jobs: {} });
    const service = makeService();
    service.poll
      .mockResolvedValueOnce({ status: "in_progress", requestCounts: { completed: 0, failed: 0, total: 1 } })
      .mockResolvedValueOnce({ status: "completed", requestCounts: { completed: 1, failed: 0, total: 1 } });

    const results = await runBatchStep({
      step: "cleaning",
      outputDir: "/out",
      batchService: service,
      requests: [{ customId: "c::1", options: { systemPrompt: "S", userPrompt: "A" } }],
      pollIntervalMs: 1,
      logger,
    });

    expect(service.submit).toHaveBeenCalledTimes(1);
    expect(mockWriteBatchJob).toHaveBeenCalledWith("/out", "cleaning", expect.objectContaining({ batchId: "batch_new" }));
    expect(service.collect).toHaveBeenCalledWith("batch_new");
    expect(mockClearBatchJob).toHaveBeenCalledWith("/out", "cleaning");
    expect(results).toEqual([{ customId: "c::1", text: "OUT" }]);
  });

  it("resumes a stored batchId instead of resubmitting", async () => {
    mockReadBatchState.mockReturnValue({
      version: 1,
      jobs: { cleaning: { batchId: "batch_stored", submittedAt: "t", customIds: ["c::1"] } },
    });
    const service = makeService();
    service.poll.mockResolvedValueOnce({ status: "completed", requestCounts: { completed: 1, failed: 0, total: 1 } });

    await runBatchStep({
      step: "cleaning",
      outputDir: "/out",
      batchService: service,
      requests: [{ customId: "c::1", options: { systemPrompt: "S", userPrompt: "A" } }],
      pollIntervalMs: 1,
      logger,
    });

    expect(service.submit).not.toHaveBeenCalled();
    expect(service.collect).toHaveBeenCalledWith("batch_stored");
  });

  it("clears state and throws on terminal failure", async () => {
    mockReadBatchState.mockReturnValue({ version: 1, jobs: {} });
    const service = makeService();
    service.poll.mockResolvedValueOnce({ status: "failed", requestCounts: { completed: 0, failed: 1, total: 1 } });

    await expect(
      runBatchStep({
        step: "cleaning",
        outputDir: "/out",
        batchService: service,
        requests: [{ customId: "c::1", options: { systemPrompt: "S", userPrompt: "A" } }],
        pollIntervalMs: 1,
        logger,
      }),
    ).rejects.toThrow(/failed/);
    expect(mockClearBatchJob).toHaveBeenCalledWith("/out", "cleaning");
  });

  it("leaves state and throws when maxWaitMs is exceeded", async () => {
    mockReadBatchState.mockReturnValue({ version: 1, jobs: {} });
    const service = makeService();
    service.poll.mockResolvedValue({ status: "in_progress", requestCounts: { completed: 0, failed: 0, total: 1 } });

    await expect(
      runBatchStep({
        step: "cleaning",
        outputDir: "/out",
        batchService: service,
        requests: [{ customId: "c::1", options: { systemPrompt: "S", userPrompt: "A" } }],
        pollIntervalMs: 1,
        maxWaitMs: 0,
        logger,
      }),
    ).rejects.toThrow(/re-run to resume/);
    expect(mockClearBatchJob).not.toHaveBeenCalled();
  });
});
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `npm test -- tests/pipeline/batch/batchCoordinator.test.ts`
Expected: FAIL with module-not-found for `batchCoordinator.js`.

- [ ] **Step 3: Implement the coordinator**

Create `src/pipeline/batch/batchCoordinator.ts`:

```typescript
import type { Logger } from "../../services/logger.js";
import type { ProgressReporter } from "../../services/progress.js";
import type { BatchAiService, BatchRequest, BatchResult } from "../../services/ai/batch/batch.types.js";
import { readBatchState, writeBatchJob, clearBatchJob } from "../../services/batch/batchState.js";

export interface RunBatchStepArgs {
  step: string;
  outputDir: string;
  batchService: BatchAiService;
  requests: BatchRequest[];
  pollIntervalMs: number;
  maxWaitMs?: number;
  logger: Logger;
  progress?: ProgressReporter;
  /** Injectable for tests; defaults to a real setTimeout-based delay. */
  sleep?: (ms: number) => Promise<void>;
  /** Injectable for tests; defaults to performance.now(). */
  now?: () => number;
}

const TERMINAL_FAILURES = new Set(["failed", "expired", "cancelled"]);

function defaultSleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

export async function runBatchStep(args: RunBatchStepArgs): Promise<BatchResult[]> {
  const {
    step, outputDir, batchService, requests, pollIntervalMs, maxWaitMs, logger, progress,
  } = args;
  const sleep = args.sleep ?? defaultSleep;
  const now = args.now ?? (() => Date.now());

  // 1. Resume an existing job, or submit a new one.
  const state = readBatchState(outputDir);
  const existing = state.jobs[step];
  let batchId: string;
  if (existing?.batchId) {
    batchId = existing.batchId;
    logger.info(`Resuming batch job for step '${step}' (batchId=${batchId})`);
  } else {
    logger.info(`Submitting batch job for step '${step}' (${requests.length} requests)`);
    batchId = await batchService.submit(requests);
    writeBatchJob(outputDir, step, {
      batchId,
      submittedAt: new Date(now()).toISOString(),
      customIds: requests.map((r) => r.customId),
    });
    logger.info(`Batch submitted for step '${step}' (batchId=${batchId})`);
  }

  // 2. Auto-watch loop.
  const start = now();
  // eslint-disable-next-line no-constant-condition
  while (true) {
    const result = await batchService.poll(batchId);
    const counts = result.requestCounts;
    if (counts) {
      progress?.updateMessage(
        `Batch '${step}' ${result.status}: ${counts.completed}/${counts.total} done` +
          (counts.failed ? `, ${counts.failed} failed` : ""),
      );
    }

    if (result.status === "completed") {
      const collected = await batchService.collect(batchId);
      clearBatchJob(outputDir, step);
      logger.info(`Batch completed for step '${step}' (batchId=${batchId})`);
      return collected;
    }

    if (TERMINAL_FAILURES.has(result.status)) {
      clearBatchJob(outputDir, step);
      throw new Error(
        `Batch for step '${step}' ${result.status} (batchId=${batchId}` +
          (counts ? `, ${counts.failed}/${counts.total} failed` : "") +
          `). Re-run to resubmit.`,
      );
    }

    if (maxWaitMs !== undefined && now() - start >= maxWaitMs) {
      throw new Error(
        `Batch for step '${step}' still ${result.status} after ${maxWaitMs}ms ` +
          `(batchId=${batchId}). Pending — re-run to resume.`,
      );
    }

    await sleep(pollIntervalMs);
  }
}
```

> Note: the `maxWaitMs: 0` test asserts the loop throws on the first non-terminal poll before sleeping — the check `now() - start >= maxWaitMs` with `maxWaitMs=0` is satisfied immediately. Keep the order: poll → terminal checks → maxWait check → sleep.

- [ ] **Step 4: Run tests to verify they pass**

Run: `npm test -- tests/pipeline/batch/batchCoordinator.test.ts`
Expected: PASS.

- [ ] **Step 5: Type-check**

Run: `npm run build`
Expected: no type errors.

- [ ] **Step 6: Commit**

```bash
git add src/pipeline/batch/batchCoordinator.ts tests/pipeline/batch/batchCoordinator.test.ts
git commit -m "feat(batch): add batchCoordinator with submit/resume and auto-watch"
```

---

### Task 8: Service factory wiring (`execution`, `createBatchAiService`, `getBatchTuning`)

**Files:**
- Modify: `src/services/ai/aiServiceFactory.ts`
- Test: `tests/services/ai/aiServiceFactory.test.ts` (create if absent, else extend)

- [ ] **Step 1: Write failing tests**

Create/extend `tests/services/ai/aiServiceFactory.test.ts`:

```typescript
import { describe, it, expect, beforeEach, jest } from "@jest/globals";

jest.unstable_mockModule("openai", () => ({
  default: jest.fn().mockImplementation(() => ({})),
  toFile: jest.fn(),
}));

describe("aiServiceFactory batch wiring", () => {
  let resolveStepConfig: any, createBatchAiService: any, getBatchTuning: any;

  beforeEach(async () => {
    jest.clearAllMocks();
    const mod = await import("../../../src/services/ai/aiServiceFactory.js");
    resolveStepConfig = mod.resolveStepConfig;
    createBatchAiService = mod.createBatchAiService;
    getBatchTuning = mod.getBatchTuning;
  });

  it("resolveStepConfig defaults execution to 'sync'", () => {
    const cfg = { profile: "lecture", ai: { default: { provider: "openai", model: "gpt-5-mini" } } } as any;
    expect(resolveStepConfig(cfg, "cleaning").execution).toBe("sync");
  });

  it("resolveStepConfig honors a per-step execution override", () => {
    const cfg = {
      profile: "lecture",
      ai: { default: { provider: "openai", model: "gpt-5-mini" } },
      steps: { cleaning: { aiConfig: { execution: "batch" } } },
    } as any;
    expect(resolveStepConfig(cfg, "cleaning").execution).toBe("batch");
  });

  it("createBatchAiService returns an OpenAiBatchService for openai", () => {
    const cfg = {
      profile: "lecture",
      ai: { providers: { openai: { apiKey: "sk-x" } }, default: { provider: "openai", model: "gpt-5-mini" } },
    } as any;
    const svc = createBatchAiService(cfg, "cleaning");
    expect(typeof svc.submit).toBe("function");
    expect(typeof svc.poll).toBe("function");
    expect(typeof svc.collect).toBe("function");
  });

  it("createBatchAiService throws for a non-openai provider", () => {
    const cfg = {
      profile: "lecture",
      ai: { providers: { deepseek: { apiKey: "dk" } }, default: { provider: "deepseek", model: "deepseek-chat" } },
    } as any;
    expect(() => createBatchAiService(cfg, "cleaning")).toThrow(/openai/i);
  });

  it("getBatchTuning returns defaults when ai.batch is unset", () => {
    expect(getBatchTuning({ profile: "lecture" } as any)).toEqual({ pollIntervalMs: 30000, maxWaitMs: undefined });
  });

  it("getBatchTuning reads configured values", () => {
    const cfg = { profile: "lecture", ai: { batch: { pollIntervalMs: 5000, maxWaitMs: 60000 } } } as any;
    expect(getBatchTuning(cfg)).toEqual({ pollIntervalMs: 5000, maxWaitMs: 60000 });
  });
});
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `npm test -- tests/services/ai/aiServiceFactory.test.ts`
Expected: FAIL (`execution` undefined; `createBatchAiService`/`getBatchTuning` not exported).

- [ ] **Step 3: Add `execution` to `resolveStepConfig`**

In `src/services/ai/aiServiceFactory.ts`, update the returned object in `resolveStepConfig` (lines 193-200) to include `execution`:

```typescript
  // Merge default with step override
  const resolved: StepAiConfig = {
    provider: stepOverride?.provider ?? defaultConfig.provider,
    model: stepOverride?.model ?? defaultConfig.model,
    execution: stepOverride?.execution ?? defaultConfig.execution ?? "sync",
    overrides: {
      ...defaultConfig.overrides,
      ...stepOverride?.overrides,
    },
  };

  return resolved;
```

- [ ] **Step 4: Add `createBatchAiService` and `getBatchTuning`**

In `src/services/ai/aiServiceFactory.ts`, add the import near the top (after the `OpenAiService` import at line 10):

```typescript
import { OpenAiBatchService } from "./openai/openaiBatchService.js";
import type { BatchAiService } from "./batch/batch.types.js";
```

After `createAiService` (ends at line 262), add:

```typescript
/**
 * Creates a batch AI service for a specific step. OpenAI-only in v1.
 */
export function createBatchAiService(config: PipelineConfig, step: AiStepName): BatchAiService {
  const stepConfig = resolveStepConfig(config, step);
  if (stepConfig.provider !== "openai") {
    throw new Error(
      `Batch execution is only supported for the 'openai' provider (step '${step}' uses '${stepConfig.provider}')`,
    );
  }
  const apiKey = getApiKey(config, "openai");
  return new OpenAiBatchService(apiKey, stepConfig.model);
}

/**
 * Returns batch tuning (poll interval and max wait) from config, with defaults.
 */
export function getBatchTuning(config: PipelineConfig): { pollIntervalMs: number; maxWaitMs?: number } {
  return {
    pollIntervalMs: config.ai?.batch?.pollIntervalMs ?? 30000,
    maxWaitMs: config.ai?.batch?.maxWaitMs,
  };
}
```

- [ ] **Step 5: Run tests to verify they pass**

Run: `npm test -- tests/services/ai/aiServiceFactory.test.ts`
Expected: PASS.

- [ ] **Step 6: Type-check**

Run: `npm run build`
Expected: no type errors.

- [ ] **Step 7: Commit**

```bash
git add src/services/ai/aiServiceFactory.ts tests/services/ai/aiServiceFactory.test.ts
git commit -m "feat(batch): wire execution resolution, createBatchAiService, getBatchTuning"
```

---

### Task 9: Cleaning step batch mode

**Files:**
- Modify: `src/pipeline/steps/cleaningStep.ts`
- Test: `tests/pipeline/steps/cleaningStep.test.ts` (extend)

- [ ] **Step 1: Add the batch addendum + neighbor constant (no behaviour change yet)**

In `src/pipeline/steps/cleaningStep.ts`, after `PREVIOUS_OUTPUT_EXCERPT_CHARS = 2000;` (line 15), add:

```typescript
const NEIGHBOR_EXCERPT_CHARS = 2000;

/** Appended to the cleaning system prompt in batch mode. */
const CLEANING_BATCH_ADDENDUM = `

BATCH MODE (MULTI-PART)
This is one part of a multi-part transcript processed in parallel. Keep terminology and formatting consistent with the surrounding excerpts, but output ONLY the cleaned version of THIS part — never reproduce the neighbor excerpts. If no PRECEDING excerpt is provided, treat this as the FIRST part of the document; if no FOLLOWING excerpt is provided, treat this as the LAST part.`;
```

- [ ] **Step 2: Write a failing batch test**

Add to `tests/pipeline/steps/cleaningStep.test.ts` a test that runs cleaning with `execution: "batch"` and asserts requests carry neighbor excerpts and the addendum. Mock `createBatchAiService`/`getBatchTuning`/`runBatchStep` at the module boundary. Skeleton (adapt to the file's existing fs-mock + ctx-building harness):

```typescript
it("batch mode submits one request per file with neighbor excerpts and addendum", async () => {
  // three raw parts present; none cleaned yet
  // config.steps.cleaning.aiConfig.execution = "batch", provider openai
  // mock runBatchStep to capture the `requests` array and return one BatchResult per customId

  const captured = await runCleaningInBatchModeForTest(/* harness helper */);

  const reqs = captured.requests;
  expect(reqs.map((r: any) => r.customId)).toEqual([
    "cleaning::part-01", "cleaning::part-02", "cleaning::part-03",
  ]);
  // first part: no previous excerpt; has next
  expect(reqs[0].options.previousChunkExcerpt).toBeUndefined();
  expect(reqs[0].options.nextChunkExcerpt).toBeDefined();
  // middle part: both present
  expect(reqs[1].options.previousChunkExcerpt).toBeDefined();
  expect(reqs[1].options.nextChunkExcerpt).toBeDefined();
  // last part: has previous; no next
  expect(reqs[2].options.previousChunkExcerpt).toBeDefined();
  expect(reqs[2].options.nextChunkExcerpt).toBeUndefined();
  // no sync previousOutputExcerpt in batch mode
  expect(reqs[1].options.previousOutputExcerpt).toBeUndefined();
  // addendum applied
  expect(reqs[0].options.systemPrompt).toContain("BATCH MODE");
});
```

> The existing cleaningStep test file already mocks `node:fs` and the AI factory. Mirror that: add `jest.unstable_mockModule` entries for `createBatchAiService`, `getBatchTuning` (from `aiServiceFactory.js`) and `runBatchStep` (from `batchCoordinator.js`), capturing the `requests` argument.

- [ ] **Step 3: Run test to verify it fails**

Run: `npm test -- tests/pipeline/steps/cleaningStep.test.ts`
Expected: FAIL (batch path not implemented).

- [ ] **Step 4: Implement the batch branch in `runAsync`**

In `src/pipeline/steps/cleaningStep.ts`, add the batch imports at the top:

```typescript
import {
  buildMetadataHeader,
  createAiService,
  createBatchAiService,
  getBatchTuning,
  getLocalizedStepLabel,
  resolveAiConfig,
  resolveStepConfig,
} from "../../services/ai/aiServiceFactory.js";
import { runBatchStep } from "../batch/batchCoordinator.js";
import type { BatchRequest } from "../../services/ai/batch/batch.types.js";
```

Replace the `if (filesToProcess.length > 0) { … } else { … }` block (lines 41-71) so it branches on execution. The sync branch is the existing code verbatim; add a batch branch:

```typescript
    if (filesToProcess.length > 0) {
      const execution = resolveStepConfig(config, "cleaning").execution;
      const aiOptions = resolveAiConfig(config, "cleaning") as Omit<AiGenerateOptions, "userPrompt">;
      const contextText = loadContextText(config.context?.textSources, baseDir);

      if (execution === "batch") {
        await this.processBatch(
          config, filesToProcess, transcriptsDir, cleanedDir, rawFiles,
          aiOptions, contextText, outputDir, logger, progress,
        );
      } else {
        const aiService = createAiService(config, "cleaning");
        progress?.start(filesToProcess.length, "Cleaning transcripts");
        let lastCleanedPath: string | undefined;
        for (const file of filesToProcess) {
          lastCleanedPath = await this.processFile(
            config, file, transcriptsDir, cleanedDir, rawFiles, lastCleanedPath,
            aiService, aiOptions, contextText, logger, progress,
          );
        }
        progress?.stop();
      }
    } else {
      logger.info("All transcripts already cleaned, skipping");
    }
```

Add the `processBatch` method (after `processFile`, before `loadPreviousOutputExcerpt`):

```typescript
  private async processBatch(
    config: StepContext["config"],
    filesToProcess: string[],
    transcriptsDir: string,
    cleanedDir: string,
    rawFiles: string[],
    aiOptions: Omit<AiGenerateOptions, "userPrompt">,
    contextText: string | undefined,
    outputDir: string,
    logger: Logger,
    progress: ProgressReporter | undefined,
  ): Promise<void> {
    const systemPrompt = aiOptions.systemPrompt + CLEANING_BATCH_ADDENDUM;

    const requests: BatchRequest[] = filesToProcess.map((file) => {
      const base = path.parse(file).name;
      const rawText = fs.readFileSync(path.join(transcriptsDir, file), "utf-8");
      const idx = rawFiles.indexOf(file);

      const previousChunkExcerpt =
        idx > 0
          ? fs.readFileSync(path.join(transcriptsDir, rawFiles[idx - 1]), "utf-8")
              .slice(-NEIGHBOR_EXCERPT_CHARS).trim() || undefined
          : undefined;
      const nextChunkExcerpt =
        idx < rawFiles.length - 1
          ? fs.readFileSync(path.join(transcriptsDir, rawFiles[idx + 1]), "utf-8")
              .slice(0, NEIGHBOR_EXCERPT_CHARS).trim() || undefined
          : undefined;

      return {
        customId: `cleaning::${base}`,
        options: {
          systemPrompt,
          manualContextText: contextText || undefined,
          previousChunkExcerpt,
          nextChunkExcerpt,
          userPrompt: rawText,
          temperature: aiOptions.temperature,
          maxTokens: aiOptions.maxTokens,
        },
      };
    });

    const batchService = createBatchAiService(config, "cleaning");
    const { pollIntervalMs, maxWaitMs } = getBatchTuning(config);

    progress?.start(requests.length, "Cleaning transcripts (batch)");
    const results = await runBatchStep({
      step: "cleaning",
      outputDir,
      batchService,
      requests,
      pollIntervalMs,
      maxWaitMs,
      logger,
      progress,
    });
    progress?.stop();

    const aiService = createAiService(config, "cleaning");
    for (const result of results) {
      const base = result.customId.replace(/^cleaning::/, "");
      if (result.error) {
        logger.warn(`Cleaning failed for '${base}': ${result.error} (will reprocess on re-run)`);
        continue;
      }
      const file = `${base}.txt`;
      const contentToWrite = await this.buildContentWithOptionalHeader(
        result.text ?? "",
        rawFiles.indexOf(file) === 0,
        config,
        aiService,
      );
      await fs.promises.writeFile(path.join(cleanedDir, `${base}.md`), contentToWrite, "utf-8");
    }
  }
```

> Note: the raw transcript extension is `.txt` (see `getRawTranscriptFiles` filter at `:95`). `rawFiles.indexOf(file)` therefore needs the `.txt` filename — reconstruct it as `${base}.txt`. If the codebase ever changes the raw extension, derive it from `rawFiles` by matching `path.parse(f).name === base` instead.

- [ ] **Step 5: Run tests to verify they pass**

Run: `npm test -- tests/pipeline/steps/cleaningStep.test.ts`
Expected: PASS (batch test + existing sync tests).

- [ ] **Step 6: Type-check**

Run: `npm run build`
Expected: no type errors.

- [ ] **Step 7: Commit**

```bash
git add src/pipeline/steps/cleaningStep.ts tests/pipeline/steps/cleaningStep.test.ts
git commit -m "feat(cleaning): add batch execution with raw neighbor excerpts"
```

---

### Task 10: Handout step map-reduce batch mode

**Files:**
- Modify: `src/pipeline/steps/handoutStep.ts`
- Test: `tests/pipeline/steps/handoutStep.test.ts` (extend)

- [ ] **Step 1: Add the draft addendum, merge-prompt builder, and neighbor constant**

In `src/pipeline/steps/handoutStep.ts`, add module-level constants/functions (before the class, after imports):

```typescript
const NEIGHBOR_EXCERPT_CHARS = 2000;

/** Appended to the handout system prompt for Stage-1 batch drafts. */
const HANDOUT_DRAFT_ADDENDUM = `

BATCH DRAFT MODE (ONE PART)
You are drafting ONE part of a larger multi-part handout. Produce structured notes for THIS part only. Do NOT write a global introduction or conclusion, and do NOT assume global section numbering — parts are merged and renumbered afterward. Never reproduce the neighbor excerpts. If no PRECEDING excerpt is provided, treat this as the FIRST part; if no FOLLOWING excerpt is provided, treat this as the LAST part.`;

/** Builds the Stage-2 sync merge system prompt, with the output-language instruction. */
export function buildHandoutMergePrompt(langCode: string): string {
  const code = (langCode ?? "en").trim().toLowerCase();
  const languageInstruction = `\n\nIMPORTANT: Output language is specified by ISO 639-1 two-letter code "${code}". All output must be written in that language. Write all content, including headings, annotations, and any text, exclusively in the language identified by code "${code}".`;
  return (
    `ROLE
You merge independently drafted parts of a multi-part academic handout into a single, unified document.

TASK
You receive several handout drafts (in order). Combine them into one coherent handout that reads as if written in a single pass.

RULES
- Unify the parts into one document; preserve ALL content (no omissions, no summaries).
- Apply a single, global, hierarchical numbered heading scheme, renumbering sections from 1.
- Remove duplicated material that appears across adjacent drafts.
- Smooth the transitions between parts so boundaries are invisible.
- Do NOT add a title, metadata, or table of contents (the header is added post-processing).
- Do NOT invent new content or commentary.

OUTPUT
Return ONLY the merged handout in Markdown.` + languageInstruction
  );
}
```

- [ ] **Step 2: Write failing batch tests**

Add to `tests/pipeline/steps/handoutStep.test.ts`:
- A unit test for `buildHandoutMergePrompt`:

```typescript
import { buildHandoutMergePrompt } from "../../../src/pipeline/steps/handoutStep.js";

describe("buildHandoutMergePrompt", () => {
  it("includes renumbering instruction and the language code", () => {
    const p = buildHandoutMergePrompt("it");
    expect(p).toMatch(/renumber/i);
    expect(p).toContain('"it"');
  });
});
```

- A batch-mode test (mirroring the file's existing harness; mock `runBatchStep`, `createBatchAiService`, `getBatchTuning`, and the sync `createAiService`):

```typescript
it("batch mode drafts each part then merges sync", async () => {
  // 3 cleaned parts; config handout execution = batch, provider openai
  // mock runBatchStep to capture Stage-1 requests and return drafts
  // mock the sync aiService.generateTextAsync to capture the Stage-2 merge call

  const { stage1Requests, mergeCall } = await runHandoutBatchForTest(/* harness */);

  expect(stage1Requests.map((r: any) => r.customId)).toEqual([
    "handout::part-01", "handout::part-02", "handout::part-03",
  ]);
  // draft addendum on Stage-1
  expect(stage1Requests[0].options.systemPrompt).toContain("BATCH DRAFT MODE");
  // neighbor excerpts: first omits previous, last omits next
  expect(stage1Requests[0].options.previousChunkExcerpt).toBeUndefined();
  expect(stage1Requests[2].options.nextChunkExcerpt).toBeUndefined();
  // Stage-2 merge runs sync with the merge prompt
  expect(mergeCall.systemPrompt).toMatch(/renumber/i);
});
```

- [ ] **Step 3: Run tests to verify they fail**

Run: `npm test -- tests/pipeline/steps/handoutStep.test.ts`
Expected: FAIL (batch path + `buildHandoutMergePrompt` consumption not implemented).

- [ ] **Step 4: Implement the batch branch in `runAsync`**

In `src/pipeline/steps/handoutStep.ts`, add imports:

```typescript
import {
  buildMetadataHeader,
  createAiService,
  createBatchAiService,
  getBatchTuning,
  getLocalizedStepLabel,
  resolveAiConfig,
  resolveStepConfig,
} from "../../services/ai/aiServiceFactory.js";
import { runBatchStep } from "../batch/batchCoordinator.js";
import type { BatchRequest } from "../../services/ai/batch/batch.types.js";
```

Replace the handout-generation call in `runAsync` (lines 35-43) to branch:

```typescript
    const execution = resolveStepConfig(config, "handout").execution;
    const handout =
      execution === "batch"
        ? await this.generateHandoutMapReduce(
            config, aiOptions, cleanedFiles, outputDir, contextText, logger, progress,
          )
        : await this.generateHandoutIncremental(
            aiService, aiOptions, cleanedFiles, outputDir, contextText, logger, progress,
          );
```

Add the map-reduce method (after `generateHandoutIncremental`):

```typescript
  private async generateHandoutMapReduce(
    config: StepContext["config"],
    aiOptions: Omit<HandoutAiGenerateOptions, "userPrompt">,
    cleanedFiles: string[],
    outputDir: string,
    contextText: string | undefined,
    logger: Logger,
    progress: ProgressReporter | undefined,
  ): Promise<string> {
    const cleanedDir = path.join(outputDir, "cleaned");
    const contents = cleanedFiles.map((f) => fs.readFileSync(path.join(cleanedDir, f), "utf-8"));
    const draftSystemPrompt = aiOptions.systemPrompt + HANDOUT_DRAFT_ADDENDUM;

    // Stage 1 (batch): one independent draft per part.
    const requests: BatchRequest[] = cleanedFiles.map((file, i) => {
      const base = path.parse(file).name;
      const previousChunkExcerpt =
        i > 0 ? contents[i - 1].slice(-NEIGHBOR_EXCERPT_CHARS).trim() || undefined : undefined;
      const nextChunkExcerpt =
        i < contents.length - 1
          ? contents[i + 1].slice(0, NEIGHBOR_EXCERPT_CHARS).trim() || undefined
          : undefined;
      return {
        customId: `handout::${base}`,
        options: {
          systemPrompt: draftSystemPrompt,
          manualContextText: contextText || undefined,
          previousChunkExcerpt,
          nextChunkExcerpt,
          userPrompt: contents[i],
          temperature: aiOptions.temperature,
        },
      };
    });

    const batchService = createBatchAiService(config, "handout");
    const { pollIntervalMs, maxWaitMs } = getBatchTuning(config);

    progress?.start(requests.length, "Handout drafts (batch)");
    const results = await runBatchStep({
      step: "handout",
      outputDir,
      batchService,
      requests,
      pollIntervalMs,
      maxWaitMs,
      logger,
      progress,
    });
    progress?.stop();

    // Order drafts by the numeric file order; fail loudly if any draft errored.
    const byId = new Map(results.map((r) => [r.customId, r]));
    const drafts: string[] = [];
    for (const file of cleanedFiles) {
      const base = path.parse(file).name;
      const r = byId.get(`handout::${base}`);
      if (!r || r.error || !r.text) {
        throw new Error(
          `Handout draft missing/failed for part '${base}'` +
            (r?.error ? `: ${r.error}` : "") + ". Re-run to retry.",
        );
      }
      drafts.push(r.text);
    }

    // Stage 2 (sync merge): single call.
    const mergeService = createAiService(config, "handout");
    const langCode = config.language?.output ?? "en";
    const merged = await mergeService.generateTextAsync({
      systemPrompt: buildHandoutMergePrompt(langCode),
      manualContextText: contextText || undefined,
      userPrompt: drafts.map((d, i) => `--- DRAFT PART ${i + 1} ---\n\n${d}`).join("\n\n"),
      temperature: aiOptions.temperature,
    });

    return merged;
  }
```

- [ ] **Step 5: Run tests to verify they pass**

Run: `npm test -- tests/pipeline/steps/handoutStep.test.ts`
Expected: PASS (batch test, merge-prompt test, existing incremental tests).

- [ ] **Step 6: Type-check**

Run: `npm run build`
Expected: no type errors.

- [ ] **Step 7: Commit**

```bash
git add src/pipeline/steps/handoutStep.ts tests/pipeline/steps/handoutStep.test.ts
git commit -m "feat(handout): add map-reduce batch mode with sync merge"
```

---

### Task 11: Summary step batch mode

**Files:**
- Modify: `src/pipeline/steps/summaryStep.ts`
- Test: `tests/pipeline/steps/summaryStep.test.ts` (extend)

- [ ] **Step 1: Write failing batch tests**

Add to `tests/pipeline/steps/summaryStep.test.ts` (mock `runBatchStep`, `createBatchAiService`, `getBatchTuning`, sync `createAiService`):

```typescript
it("batch single-pass submits one request 'summary::main' and writes summary.md", async () => {
  // input under 90k tokens; execution = batch, provider openai
  // mock runBatchStep to return [{ customId: "summary::main", text: "SUM" }]
  const { requests, written } = await runSummaryBatchSinglePassForTest(/* harness */);
  expect(requests.map((r: any) => r.customId)).toEqual(["summary::main"]);
  expect(written).toContain("SUM");
});

it("batch chunked submits one request per chunk then merges sync", async () => {
  // input over 90k tokens (force chunking); execution = batch
  // mock runBatchStep to capture chunk requests; mock sync merge call
  const { requests, mergeCalled } = await runSummaryBatchChunkedForTest(/* harness */);
  expect(requests.length).toBeGreaterThan(1);
  expect(requests[0].customId).toMatch(/^summary::chunk-/);
  expect(mergeCalled).toBe(true); // mergeChunkSummaries runs sync
});
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `npm test -- tests/pipeline/steps/summaryStep.test.ts`
Expected: FAIL (batch path not implemented).

- [ ] **Step 3: Implement the batch branches**

In `src/pipeline/steps/summaryStep.ts`, add imports for `createBatchAiService`, `getBatchTuning`, `resolveStepConfig` (from `aiServiceFactory.js`), `runBatchStep` (from `../batch/batchCoordinator.js`), and `BatchRequest` type.

In `runAsync`, after `aiOptions`/`aiService`/`contextText` are resolved, branch on execution before the single-pass vs chunked decision. Implement:

- **Single-pass batch:** build one `BatchRequest` `{ customId: "summary::main", options: { systemPrompt: aiOptions.systemPrompt, manualContextText: contextText || undefined, userPrompt: inputContent, temperature: aiOptions.temperature, maxTokens: aiOptions.maxTokens } }`, call `runBatchStep({ step: "summary", … })`, take `results[0].text` (throw if missing/errored), then run the existing header/write path that `generateSinglePassSummary` uses (factor the write into a shared helper or inline the existing `buildContentWith…` + `fs.promises.writeFile(summaryPath, …)` from `:70`).

```typescript
    const execution = resolveStepConfig(config, "summary").execution;
    if (execution === "batch") {
      const batchService = createBatchAiService(config, "summary");
      const { pollIntervalMs, maxWaitMs } = getBatchTuning(config);

      if (estimatedInputTokens > MAX_SAFE_INPUT_TOKENS) {
        // CHUNKED BATCH: batch the per-chunk summaries, merge sync.
        const chunks = this.splitIntoChunks(inputContent /* use the existing chunker */);
        const requests: BatchRequest[] = chunks.map((chunk, i) => {
          const chunkWordCountTarget = Math.ceil(wordCount / chunks.length);
          const baseSystemPrompt = aiOptions.systemPrompt.replace(/\n\nIMPORTANT:.*$/, "");
          const chunkSystemPrompt = this.enhancePromptWithWordCount(baseSystemPrompt, chunkWordCountTarget);
          return {
            customId: `summary::chunk-${String(i + 1).padStart(2, "0")}`,
            options: {
              systemPrompt: chunkSystemPrompt,
              manualContextText: contextText || undefined,
              userPrompt: chunk,
              temperature: aiOptions.temperature,
              maxTokens: aiOptions.maxTokens,
            },
          };
        });

        progress?.start(requests.length, "Summary chunks (batch)");
        const results = await runBatchStep({
          step: "summary", outputDir, batchService, requests, pollIntervalMs, maxWaitMs, logger, progress,
        });
        progress?.stop();

        const byId = new Map(results.map((r) => [r.customId, r]));
        const chunkSummaries = requests.map((req) => {
          const r = byId.get(req.customId);
          if (!r || r.error || !r.text) {
            throw new Error(`Summary chunk failed (${req.customId})${r?.error ? `: ${r.error}` : ""}. Re-run to retry.`);
          }
          return r.text;
        });

        // Existing sync merge (one call) — reuse mergeChunkSummaries.
        const finalSummary = await this.mergeChunkSummaries(
          createAiService(config, "summary"), aiOptions, chunkSummaries, wordCount, contextText, /* … */,
        );
        await this.writeSummary(config, outputDir, finalSummary /* + header path */);
        return;
      }

      // SINGLE-PASS BATCH
      const requests: BatchRequest[] = [{
        customId: "summary::main",
        options: {
          systemPrompt: aiOptions.systemPrompt,
          manualContextText: contextText || undefined,
          userPrompt: inputContent,
          temperature: aiOptions.temperature,
          maxTokens: aiOptions.maxTokens,
        },
      }];
      progress?.start(1, "Summary (batch)");
      const results = await runBatchStep({
        step: "summary", outputDir, batchService, requests, pollIntervalMs, maxWaitMs, logger, progress,
      });
      progress?.stop();
      const r = results.find((x) => x.customId === "summary::main");
      if (!r || r.error || !r.text) {
        throw new Error(`Summary batch failed${r?.error ? `: ${r.error}` : ""}. Re-run to retry.`);
      }
      await this.writeSummary(config, outputDir, r.text /* + header path */);
      return;
    }
```

> Implementation notes for the worker:
> - Use the step's existing chunker (the same one `generateSummaryWithChunking` calls; reuse that method's chunk-splitting, do not invent a new tokenizer). If chunk splitting is currently inline inside `generateSummaryWithChunking`, extract it into a private `splitIntoChunks` and call it from both the sync and batch paths (DRY).
> - `mergeChunkSummaries` is already a single sync call (`:406-440`); call it as-is for the batch-chunked merge. Match its exact current signature.
> - Factor the header-building + `fs.promises.writeFile(summaryPath, …)` currently at the end of the sync path (`:60-70`) into a private `writeSummary(config, outputDir, summaryText)` and call it from sync single-pass, sync chunked, batch single-pass, and batch chunked (DRY). Keep the localized step label + `buildMetadataHeader` behaviour identical to today.

- [ ] **Step 4: Run tests to verify they pass**

Run: `npm test -- tests/pipeline/steps/summaryStep.test.ts`
Expected: PASS (batch single-pass + chunked + existing sync tests).

- [ ] **Step 5: Type-check**

Run: `npm run build`
Expected: no type errors.

- [ ] **Step 6: Commit**

```bash
git add src/pipeline/steps/summaryStep.ts tests/pipeline/steps/summaryStep.test.ts
git commit -m "feat(summary): add batch execution for single-pass and chunked paths"
```

---

### Task 12: Documentation + full verification

**Files:**
- Modify: `docs/configuration.md`
- Modify: `docs/pipeline-steps.md`

- [ ] **Step 1: Document `execution` and `ai.batch` in `docs/configuration.md`**

Add a "Batch execution mode" section covering: `steps.<step>.aiConfig.execution: "sync" | "batch"` (default `sync`), `ai.default.execution`, `ai.batch.pollIntervalMs` (default 30000) and `ai.batch.maxWaitMs` (default: wait indefinitely); that batch requires the `openai` provider (validated at load); that batch is ~50% cheaper with overnight turnaround; and that a killed run resumes automatically by re-running the same command (state in `<outputDir>/.batch/state.json`). Include a JSON example:

```json
{
  "profile": "lecture",
  "ai": {
    "providers": { "openai": { "apiKey": "" } },
    "default": { "provider": "openai", "model": "gpt-5-mini", "execution": "batch" },
    "batch": { "pollIntervalMs": 30000 }
  }
}
```

- [ ] **Step 2: Document batch behaviour per step in `docs/pipeline-steps.md`**

Add notes: cleaning submits one request per part with raw neighbor excerpts; handout uses map-reduce (parallel drafts + one sync merge, renumbered globally); summary batches single-pass or per-chunk with a sync merge; the `.batch/state.json` resume contract; partial failures leave the corresponding output files missing so a re-run reprocesses only those.

- [ ] **Step 3: Run the full test suite**

Run: `npm test`
Expected: all suites green.

- [ ] **Step 4: Full type-check / build**

Run: `npm run build`
Expected: no type errors.

- [ ] **Step 5: Commit**

```bash
git add docs/configuration.md docs/pipeline-steps.md
git commit -m "docs: document batch execution mode"
```

- [ ] **Step 6 (manual, optional — costs money + waits): end-to-end batch run**

On a small transcript set, set `execution: "batch"` for one step, run `spoken-to-text`, and confirm: batch submitted, `<outputDir>/.batch/state.json` written, auto-watch polling logs request counts, outputs produced and `.batch/state.json` job cleared. Kill mid-watch and re-run → confirm it resumes the same `batchId` (idempotency).

---

## Self-Review (completed against the spec)

**Spec coverage:**
- §1 Config types & validation → Task 1.
- §2 Neighbor-context fields + formatters + position encoding → Task 2 (fields/formatters) and Task 3 (omission-encodes-position rendering + tests).
- §3 Shared request builder → Task 3.
- §4 Batch types → Task 4.
- §5 OpenAI batch implementation → Task 5.
- §6 State persistence → Task 6.
- §7 Batch coordinator → Task 7.
- §8 Service factory wiring → Task 8.
- §9 Per-step behaviour: cleaning → Task 9; handout map-reduce → Task 10; summary → Task 11.
- CLI/error handling (no new flags; batch+non-openai error; terminal failure clears+throws; partial failures leave files missing; dryRun never submits) → covered by Task 1 (validation), Task 7 (failure/clear), Tasks 9–11 (partial-failure skip), and the existing `runPipeline.ts:85` dryRun guard (unchanged).
- Docs → Task 12.

**Type consistency:** `BatchRequest`/`BatchResult`/`BatchAiService` (Task 4) are used identically in Tasks 5, 7, 9–11. `runBatchStep` arg shape (Task 7) matches every call site (Tasks 9–11). `resolveStepConfig().execution` (Task 8) is read by Tasks 9–11. `buildResponsesRequest` (Task 3) is used by both `OpenAiService` (Task 3) and `OpenAiBatchService` (Task 5). `getBatchTuning` returns `{ pollIntervalMs, maxWaitMs? }` consumed consistently.

**Known worker adaptations (called out inline, not placeholders):** the test harness helpers in Tasks 9–11 must mirror each step test file's existing fs/AI mocking style; the summary chunker must reuse the step's existing splitting logic (extract to `splitIntoChunks` if currently inline); `writeSummary`/`mergeChunkSummaries` must match their current signatures. These are integration points with code not fully quoted here — the worker should open the file and match the existing shapes, not improvise new ones.
