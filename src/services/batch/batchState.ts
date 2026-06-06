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
  // A corrupt state.json intentionally throws here — resume treats it as a hard error rather than silently discarding progress.
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
