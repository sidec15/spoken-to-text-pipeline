import OpenAI from "openai";
import type { AiService, AiGenerateOptions } from "../ai.types.js";
import {
  formatInputContentPrompt,
  formatManualContextPrompt,
  formatPreviousOutputExcerptPrompt,
} from "../../../config/profilePresets.js";

/**
 * DeepSeek model parameter support:
 *
 * `deepseek-chat` (non-thinking mode):
 *   - Supports: temperature, top_p, frequency_penalty, presence_penalty, max_tokens
 *
 * `deepseek-reasoner` (thinking mode):
 *   - Does NOT support: temperature, top_p (silently ignored, no error)
 *   - Does NOT support: logprobs, top_logprobs (will error)
 *   - Does NOT support: function calling
 *   - Supports: max_tokens
 */
const DEEPSEEK_REASONING_MODELS = ["deepseek-reasoner"];

function isDeepSeekReasoningModel(model: string): boolean {
  return DEEPSEEK_REASONING_MODELS.includes(model.toLowerCase());
}

export class DeepSeekAiService implements AiService {
  private client: OpenAI;
  private model: string;

  constructor(apiKey: string, model: string) {
    this.client = new OpenAI({
      apiKey,
      baseURL: "https://api.deepseek.com",
    });
    this.model = model;
  }

  async generateTextAsync(options: AiGenerateOptions): Promise<string> {
    const messages: OpenAI.Chat.Completions.ChatCompletionMessageParam[] = [];

    // 1. System prompt (always present)
    messages.push({
      role: "system",
      content: options.systemPrompt,
    });

    // 2. Optional manual context (Prompt 2)
    if (options.manualContextText?.trim()) {
      messages.push({
        role: "user",
        content: formatManualContextPrompt(options.manualContextText),
      });
    }

    // 3. Optional previous output excerpt (Prompt 3)
    if (options.previousOutputExcerpt?.trim()) {
      messages.push({
        role: "user",
        content: formatPreviousOutputExcerptPrompt(options.previousOutputExcerpt),
      });
    }

    // 4. Main input content (Prompt 4 – mandatory)
    messages.push({
      role: "user",
      content: formatInputContentPrompt(options.userPrompt),
    });

    // deepseek-reasoner silently ignores temperature, but we omit it
    // for clarity and to avoid relying on undocumented behavior.
    const reasoning = isDeepSeekReasoningModel(this.model);

    const response = await this.client.chat.completions.create({
      model: this.model,
      messages,
      ...(!reasoning && options.temperature !== undefined && {
        temperature: options.temperature,
      }),
      ...(options.maxTokens !== undefined && {
        max_tokens: options.maxTokens,
      }),
    });

    return response.choices[0]?.message?.content ?? "";
  }
}
