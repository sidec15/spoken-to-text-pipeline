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
      const content = (await this.client.files.content(batch.output_file_id)) as unknown as {
        text(): Promise<string>;
      };
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
      const content = (await this.client.files.content(batch.error_file_id)) as unknown as {
        text(): Promise<string>;
      };
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
