import type { Logger } from "../../services/logger.js";
import type { ProgressReporter } from "../../services/progress.js";
import type { BatchAiService, BatchRequest, BatchResult } from "../../services/ai/batch/batch.types.js";
import { readBatchJob, writeBatchJob, clearBatchJob } from "../../services/batch/batchState.js";

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
  /** Injectable for tests; defaults to Date.now(). */
  now?: () => number;
}

const TERMINAL_FAILURES = new Set(["failed", "expired", "cancelled"]);

function defaultSleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

/**
 * Submits (or resumes) a batch AI job for `step` and polls until it reaches a
 * terminal state, then returns the collected results.
 *
 * **`now` semantics:** `now` must return epoch-milliseconds (same contract as
 * `Date.now()`).  It is used both to timestamp `submittedAt` via
 * `new Date(now())` and to measure elapsed wall-clock time inside the poll
 * loop.  Tests may inject a deterministic implementation.
 *
 * **`maxWaitMs` budget:** the budget is measured from the moment the first poll
 * fires.  After every poll response — but *before* sleeping — the elapsed time
 * is compared against `maxWaitMs`.  A caller that sets `maxWaitMs <=
 * pollIntervalMs` will therefore typically time out on the very first
 * iteration.  State is NOT cleared on timeout (the job is still running
 * remotely); a subsequent call will resume via the persisted batchId.
 *
 * **`"cancelling"` status:** treated as in-progress and polled until the
 * remote status transitions to `"cancelled"` (a TERMINAL_FAILURE), at which
 * point state is cleared and an error is thrown.
 */
export async function runBatchStep(args: RunBatchStepArgs): Promise<BatchResult[]> {
  const {
    step, outputDir, batchService, requests, pollIntervalMs, maxWaitMs, logger, progress,
  } = args;
  const sleep = args.sleep ?? defaultSleep;
  const now = args.now ?? (() => Date.now());

  // 1. Resume an existing job, or submit a new one.
  const existing = readBatchJob(outputDir, step);
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
  let lastProgressMsg: string | undefined;

  for (;;) {
    const result = await batchService.poll(batchId);
    const counts = result.requestCounts;

    if (counts && progress) {
      const msg =
        `Batch '${step}' ${result.status}: ${counts.completed}/${counts.total} done` +
        (counts.failed ? `, ${counts.failed} failed` : "");
      if (msg !== lastProgressMsg) {
        progress.updateMessage(msg);
        lastProgressMsg = msg;
      }
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
