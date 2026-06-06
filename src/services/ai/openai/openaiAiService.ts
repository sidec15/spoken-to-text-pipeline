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
