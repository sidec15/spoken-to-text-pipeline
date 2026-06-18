import OpenAI from "openai";
import type { AiService, AiGenerateOptions } from "../ai.types.js";
import { buildResponsesRequest } from "./buildResponsesRequest.js";

/**
 * Default per-request timeout for synchronous Responses API calls.
 *
 * The OpenAI SDK default is 10 minutes, which is too short for a large
 * single-pass handout merge (all part drafts concatenated into one request):
 * a long lecture timed out with "Request timed out." mid-merge. 30 minutes
 * gives a reasoning model room to finish; override via config when needed.
 */
export const DEFAULT_OPENAI_TIMEOUT_MS = 30 * 60 * 1000;

export class OpenAiService implements AiService {
  private client: OpenAI;
  private model: string;

  constructor(apiKey: string, model: string, timeoutMs?: number) {
    this.client = new OpenAI({ apiKey, timeout: timeoutMs ?? DEFAULT_OPENAI_TIMEOUT_MS });
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
