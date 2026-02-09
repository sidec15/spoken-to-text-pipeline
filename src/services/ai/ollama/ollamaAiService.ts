import OpenAI from "openai";
import type { AiService, AiGenerateOptions } from "../ai.types.js";
import {
  formatInputContentPrompt,
  formatManualContextPrompt,
  formatPreviousOutputExcerptPrompt,
} from "../../../config/aiPrompts.js";

/**
 * Ollama AI provider.
 *
 * Ollama exposes an OpenAI-compatible chat completions API, so we reuse
 * the `openai` SDK with a custom base URL.  No API key is required;
 * a dummy value is sent to satisfy the SDK validation.
 *
 * All models served by Ollama support `temperature`.
 */

const OLLAMA_DEFAULT_BASE_URL = "http://localhost:11434/v1";

export class OllamaAiService implements AiService {
  private client: OpenAI;
  private model: string;

  constructor(model: string, baseUrl?: string) {
    this.client = new OpenAI({
      apiKey: "ollama",          // dummy – Ollama ignores this
      baseURL: baseUrl ?? OLLAMA_DEFAULT_BASE_URL,
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

    try {
      const response = await this.client.chat.completions.create({
        model: this.model,
        messages,
        ...(options.temperature !== undefined && {
          temperature: options.temperature,
        }),
        ...(options.maxTokens !== undefined && {
          max_tokens: options.maxTokens,
        }),
      });

      return response.choices[0]?.message?.content ?? "";
    } catch (error: unknown) {
      // Surface meaningful errors for common Ollama failure modes.
      if (error instanceof Error) {
        const msg = error.message ?? "";

        // Connection refused → server not running
        if (msg.includes("ECONNREFUSED") || msg.includes("fetch failed")) {
          throw new Error(
            `Ollama server is not reachable. ` +
            `Make sure Ollama is running (e.g. 'ollama serve') and accessible at the configured URL. ` +
            `Original error: ${msg}`,
          );
        }

        // Model not found (Ollama returns 404 for unknown models)
        if (msg.includes("404") || msg.toLowerCase().includes("model") && msg.toLowerCase().includes("not found")) {
          throw new Error(
            `Ollama model '${this.model}' not found. ` +
            `Pull it first with 'ollama pull ${this.model}'. ` +
            `Original error: ${msg}`,
          );
        }
      }

      // Re-throw anything else as-is
      throw error;
    }
  }
}
