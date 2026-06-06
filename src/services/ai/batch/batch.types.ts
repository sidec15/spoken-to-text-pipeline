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
