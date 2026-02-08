import OpenAI from "openai";
import type { AiService, AiGenerateOptions } from "../ai.types.js";

/**
 * OpenAI reasoning models do NOT support the `temperature` parameter.
 * Sending it causes a 400 "Unsupported parameter" error.
 *
 * Reasoning model families:
 *   - gpt-5 series  (gpt-5, gpt-5-mini, gpt-5-nano and any snapshot like gpt-5-mini-2025-08-07)
 *   - o-series       (o1, o3, o3-mini, o4-mini and any snapshot)
 *
 * Standard models that DO support temperature:
 *   - gpt-4o, gpt-4o-mini, gpt-4-turbo, gpt-4, gpt-3.5-turbo, etc.
 */
const OPENAI_REASONING_MODEL_PREFIXES = [
  "gpt-5",    // matches gpt-5, gpt-5-mini, gpt-5-nano, gpt-5-mini-2025-08-07, etc.
  "o1",       // matches o1, o1-mini, o1-preview, etc.
  "o3",       // matches o3, o3-mini, etc.
  "o4",       // matches o4-mini, etc.
];

function isReasoningModel(model: string): boolean {
  const lower = model.toLowerCase();
  return OPENAI_REASONING_MODEL_PREFIXES.some((prefix) => lower.startsWith(prefix));
}

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

    // Reasoning models (gpt-5*, o1*, o3*, o4*) do NOT support temperature.
    // Sending it causes a 400 "Unsupported parameter" error from the API.
    const reasoning = isReasoningModel(this.model);

    const requestParams: Parameters<typeof this.client.responses.create>[0] = {
      model: this.model,
      input,
      ...(!reasoning && options.temperature !== undefined && {
        temperature: options.temperature,
      }),
      ...(options.maxTokens !== undefined && {
        max_output_tokens: options.maxTokens,
      }),
    };

    const response = await this.client.responses.create(requestParams);

    // Type assertion: responses.create returns Response (not Stream) when not streaming
    return (response as OpenAI.Responses.Response).output_text;
  }
}
