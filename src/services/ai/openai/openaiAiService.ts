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
    const input: OpenAI.Responses.ResponseInputItem[] = [];

    // 1. System prompt (always present)
    input.push({
      role: "system",
      content: options.systemPrompt,
    });

    // 2. Optional manual context (Prompt 2)
    if (options.manualContextText?.trim()) {
      input.push({
        role: "user",
        content: `
OPTIONAL MANUAL CONTEXT (REFERENCE ONLY — DO NOT MODIFY)

The following text is provided only to improve terminological accuracy,
theoretical coherence, and contextual understanding.

IMPORTANT RULES:
- This content is REFERENCE ONLY
- Do NOT rewrite, summarize, or modify it
- Do NOT repeat it in the output
- Do NOT explicitly refer to it
- Use it only to better understand the content being processed

---
${options.manualContextText}
---
        `.trim(),
      });
    }

    // 3. Optional previous output excerpt (Prompt 3)
    if (options.previousOutputExcerpt?.trim()) {
      input.push({
        role: "user",
        content: `
PREVIOUS OUTPUT EXCERPT (REFERENCE ONLY)

Provided only to preserve stylistic and conceptual continuity.
Do NOT rewrite, summarize, or repeat this content.

---
${options.previousOutputExcerpt}
---
        `.trim(),
      });
    }

    // 4. Main input content (Prompt 4 – mandatory)
    input.push({
      role: "user",
      content: `
INPUT CONTENT

---
${options.userPrompt}
---
      `.trim(),
    });

    const response = await this.client.responses.create({
      model: this.model,
      input,
      temperature: options.temperature,
      ...(options.maxTokens !== undefined && {
        max_output_tokens: options.maxTokens,
      }),
    });

    return response.output_text;
  }
}
