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
  /** Injectable for tests; defaults to Date.now(). */
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
  let lastProgressMsg: string | undefined;

  // eslint-disable-next-line no-constant-condition
  while (true) {
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
