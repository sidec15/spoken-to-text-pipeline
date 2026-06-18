import path from "node:path";

/**
 * Centralizes the on-disk layout of all auxiliary/progress artifacts the
 * pipeline writes to avoid losing work on failure. Everything lives under a
 * single `.cache` folder inside the output directory so it can be dropped in
 * one shot at the end of a successful run (see `output.dropCache`).
 *
 * Layout (everything is grouped per step so artifacts can't be confused):
 *   <outputDir>/.cache/
 *     <step>/batch/state.json                (that step's batch job state)
 *     handout/batch/drafts/<base>.md         (handout Stage-1 batch drafts)
 *     handout/incremental/drafts/<base>.md   (handout incremental fragments)
 *
 * e.g. `.cache/cleaning/batch/state.json`, `.cache/handout/batch/state.json`.
 *
 * These are NOT user-facing outputs — the real outputs (cleaned/, handout.md,
 * summary.md, …) stay at the output-dir root and are never placed here.
 */
export const CACHE_DIR_NAME = ".cache";

/** Absolute path to the auxiliary cache root: `<outputDir>/.cache`. */
export function cacheRoot(outputDir: string): string {
  return path.join(outputDir, CACHE_DIR_NAME);
}

/** Per-step batch directory: `.cache/<step>/batch` (holds that step's state.json). */
export function stepBatchDir(outputDir: string, step: string): string {
  return path.join(cacheRoot(outputDir), step, "batch");
}

/** Handout execution modes that persist per-part draft fragments. */
export type HandoutMode = "batch" | "incremental";

/**
 * Directory holding handout draft fragments for a given execution mode:
 * `.cache/handout/<mode>/drafts` (alongside `.cache/handout/batch/state.json`).
 * Batch and incremental are kept in separate subtrees because their fragments
 * are not interchangeable (batch drafts are independent and unnumbered;
 * incremental fragments are continuation-numbered).
 */
export function handoutDraftsDir(outputDir: string, mode: HandoutMode): string {
  return path.join(cacheRoot(outputDir), "handout", mode, "drafts");
}
