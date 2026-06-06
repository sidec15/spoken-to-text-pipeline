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

  /**
   * Reads the raw text from a file ID returned by the OpenAI Files API.
   *
   * The SDK types `files.content` as an API response wrapper object; casting to
   * `{ text(): Promise<string> }` accesses the standard Web API `.text()` method
   * that the underlying `Response` exposes for reading the body as a string.
   */
  private async readFileText(fileId: string): Promise<string> {
    const content = (await this.client.files.content(fileId)) as unknown as {
      text(): Promise<string>;
    };
    return content.text();
  }

  /**
   * Iterates the lines of a JSONL string, parsing each one and passing it to
   * `mapLine`. Malformed lines are caught: instead of aborting the whole loop
   * they produce an error result whose `customId` is "unknown" and whose
   * `error` contains a snippet of the offending text, so valid results are
   * still preserved.
   */
  private parseJsonlLines<T>(
    text: string,
    mapLine: (parsed: unknown) => T,
  ): (T | BatchResult)[] {
    const results: (T | BatchResult)[] = [];
    for (const line of text.split("\n")) {
      const trimmed = line.trim();
      if (!trimmed) continue;
      try {
        const parsed = JSON.parse(trimmed) as unknown;
        results.push(mapLine(parsed));
      } catch {
        results.push({
          customId: "unknown",
          error: `malformed JSONL line: ${trimmed.slice(0, 80)}`,
        });
      }
    }
    return results;
  }

  async collect(batchId: string): Promise<BatchResult[]> {
    const batch = await this.client.batches.retrieve(batchId);

    // No output or error file → batch produced no results.
    if (!batch.output_file_id && !batch.error_file_id) {
      return [];
    }

    const results: BatchResult[] = [];

    if (batch.output_file_id) {
      const text = await this.readFileText(batch.output_file_id);
      const mapped = this.parseJsonlLines(text, (parsed) => {
        const p = parsed as {
          custom_id: string;
          response?: { status_code?: number; body?: { status?: string; output_text?: string } };
          error?: { message?: string } | null;
        };
        if (p.error) {
          return { customId: p.custom_id, error: p.error.message ?? "unknown error" } satisfies BatchResult;
        }
        const body = p.response?.body;
        if (body?.status === "incomplete") {
          return { customId: p.custom_id, error: "OpenAI response incomplete" } satisfies BatchResult;
        }
        return { customId: p.custom_id, text: body?.output_text ?? "" } satisfies BatchResult;
      });
      results.push(...(mapped as BatchResult[]));
    }

    if (batch.error_file_id) {
      const text = await this.readFileText(batch.error_file_id);
      const mapped = this.parseJsonlLines(text, (parsed) => {
        const p = parsed as {
          custom_id: string;
          error?: { message?: string } | null;
          response?: { body?: { error?: { message?: string } } };
        };
        const message =
          p.error?.message ?? p.response?.body?.error?.message ?? "batch request failed";
        return { customId: p.custom_id, error: message } satisfies BatchResult;
      });
      results.push(...(mapped as BatchResult[]));
    }

    return results;
  }
}
