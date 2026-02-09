/**
 * AI prompt templates used across all AI service implementations.
 * These prompts structure the messages sent to AI models for text processing.
 */

/**
 * Formats the optional manual context prompt.
 * Used to provide reference-only context that improves terminological accuracy
 * and theoretical coherence without being modified or repeated in the output.
 */
export function formatManualContextPrompt(contextText: string): string {
  return `
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
${contextText}
---
  `.trim();
}

/**
 * Formats the optional previous output excerpt prompt.
 * Used to preserve stylistic and conceptual continuity across processing steps.
 */
export function formatPreviousOutputExcerptPrompt(excerpt: string): string {
  return `
PREVIOUS OUTPUT EXCERPT (REFERENCE ONLY)

Provided only to preserve stylistic and conceptual continuity.
Do NOT rewrite, summarize, or repeat this content.

---
${excerpt}
---
  `.trim();
}

/**
 * Formats the main input content prompt.
 * This is the mandatory prompt containing the actual content to be processed.
 */
export function formatInputContentPrompt(userPrompt: string): string {
  return `
INPUT CONTENT

---
${userPrompt}
---
  `.trim();
}
