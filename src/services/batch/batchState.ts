import fs from "node:fs";
import path from "node:path";
import { stepBatchDir } from "../../utils/cachePaths.js";

export interface BatchJobRecord {
  batchId: string;
  submittedAt: string;
  customIds: string[];
}

/** On-disk shape of a single step's batch state file. */
interface BatchStateFile {
  version: 1;
  job: BatchJobRecord;
}

const STATE_FILE = "state.json";

function statePath(outputDir: string, step: string): string {
  return path.join(stepBatchDir(outputDir, step), STATE_FILE);
}

/**
 * Reads the persisted batch job for `step`, or undefined if none is in flight.
 * Each step keeps its own file (`.cache/<step>/batch/state.json`) so states
 * cannot be confused across steps.
 */
export function readBatchJob(outputDir: string, step: string): BatchJobRecord | undefined {
  const file = statePath(outputDir, step);
  if (!fs.existsSync(file)) {
    return undefined;
  }
  const raw = fs.readFileSync(file, "utf-8");
  // A corrupt state.json intentionally throws here — resume treats it as a hard error rather than silently discarding progress.
  const parsed = JSON.parse(raw) as BatchStateFile;
  return parsed.job;
}

/** Persists the in-flight batch job for `step`. */
export function writeBatchJob(outputDir: string, step: string, job: BatchJobRecord): void {
  const dir = stepBatchDir(outputDir, step);
  fs.mkdirSync(dir, { recursive: true });
  const file: BatchStateFile = { version: 1, job };
  fs.writeFileSync(path.join(dir, STATE_FILE), JSON.stringify(file, null, 2), "utf-8");
}

/** Clears `step`'s batch job (removes its state file; a no-op if absent). */
export function clearBatchJob(outputDir: string, step: string): void {
  fs.rmSync(statePath(outputDir, step), { force: true });
}
