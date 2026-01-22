import OpenAI from "openai";
import type { AiService, AiGenerateOptions } from "../ai.types.js";

export class OpenAiService implements AiService {
  private client: OpenAI;
  private model: string;

  constructor(apiKey: string, model: string) {
    this.client = new OpenAI({ apiKey });
    this.model = model;
  }

  async generateTextAsync(options: AiGenerateOptions): Promise<string> {
    const response = await this.client.responses.create({
      model: this.model,
      input: [
        {
          role: "system",
          content: options.systemPrompt ?? "",
        },
        {
          role: "user",
          content: options.userPrompt,
        },
      ],
      temperature: options.temperature,
      ...(options.maxTokens !== undefined && { max_output_tokens: options.maxTokens }),
    });

    return response.output_text;
  }
}
