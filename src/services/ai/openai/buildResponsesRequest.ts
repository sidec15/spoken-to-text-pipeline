import OpenAI from "openai";
import type { AiGenerateOptions } from "../ai.types.js";
import {
  formatInputContentPrompt,
  formatManualContextPrompt,
  formatPreviousOutputExcerptPrompt,
  formatPrecedingContextPrompt,
  formatFollowingContextPrompt,
} from "../../../config/profilePresets.js";

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

export function isReasoningModel(model: string): boolean {
  const lower = model.toLowerCase();
  return OPENAI_REASONING_MODEL_PREFIXES.some((prefix) => lower.startsWith(prefix));
}

/**
 * Builds the OpenAI Responses API request body from provider-independent options.
 * Shared by the sync service and the batch JSONL builder so prompt shape is identical.
 *
 * Input-item order: system -> manualContext -> precedingContext -> followingContext
 * -> previousOutputExcerpt -> userPrompt. Neighbor blocks are emitted only when the
 * corresponding excerpt is present (omission encodes first/last part — see design §2).
 */
export function buildResponsesRequest(
  options: AiGenerateOptions,
  model: string,
): Parameters<OpenAI.Responses["create"]>[0] {
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
      content: formatManualContextPrompt(options.manualContextText),
    });
  }

  // 3. Optional preceding-part excerpt (absent => first part)
  if (options.previousChunkExcerpt?.trim()) {
    input.push({
      role: "user",
      content: formatPrecedingContextPrompt(options.previousChunkExcerpt),
    });
  }

  // 4. Optional following-part excerpt (absent => last part)
  if (options.nextChunkExcerpt?.trim()) {
    input.push({
      role: "user",
      content: formatFollowingContextPrompt(options.nextChunkExcerpt),
    });
  }

  // 5. Optional previous output excerpt (sync continuity)
  if (options.previousOutputExcerpt?.trim()) {
    input.push({
      role: "user",
      content: formatPreviousOutputExcerptPrompt(options.previousOutputExcerpt),
    });
  }

  // 6. Main input content (mandatory)
  input.push({
    role: "user",
    content: formatInputContentPrompt(options.userPrompt),
  });

  // Reasoning models (gpt-5*, o1*, o3*, o4*) do NOT support temperature.
  // Sending it causes a 400 "Unsupported parameter" error from the API.
  const reasoning = isReasoningModel(model);

  // max_output_tokens is intentionally omitted by default.
  // The model stops naturally when done and billing is based on actual usage.
  // For reasoning models the budget includes internal reasoning tokens, so
  // setting it too low causes empty responses.  Only pass it when explicitly
  // configured by the user.
  return {
    model,
    input,
    ...(!reasoning && options.temperature !== undefined && {
      temperature: options.temperature,
    }),
    ...(options.maxTokens !== undefined && {
      max_output_tokens: options.maxTokens,
    }),
  };
}
