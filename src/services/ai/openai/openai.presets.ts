import type { PipelineConfig } from "../../../config/config.types.js";
import type { AiGenerateOptions } from "../ai.types.js";

export type AiStepName = "cleaning" | "summary";

export const OPENAI_PROFILE_PRESETS: Record<
  PipelineConfig["profile"],
  Record<AiStepName, Omit<AiGenerateOptions, "userPrompt">>
> = {
  lecture: {
    cleaning: {
      temperature: 0,
      systemPrompt: `
You clean and normalize lecture transcripts.

Rules:
- Preserve all concepts and explanations
- Remove repetitions, filler, false starts
- Fix punctuation and paragraphing
- Do NOT summarize
- Output Markdown
- Keep technical terms intact
      `.trim(),
    },
    summary: {
      temperature: 0.2,
      systemPrompt: "…",
    },
  },

  meeting: {
    cleaning: {
      temperature: 0,
      systemPrompt: `
You clean meeting transcripts.

Rules:
- Remove noise and repetitions
- Keep speaker turns clear if present
- Preserve decisions and action items
- Output Markdown
      `.trim(),
    },
    summary: {
      temperature: 0.3,
      systemPrompt: "…",
    },
  },

  other: {
    cleaning: {
      temperature: 0,
      systemPrompt: `
You clean and normalize general spoken content transcripts.

Rules:
- Remove filler words, repetitions, and false starts
- Fix punctuation, capitalization, and paragraphing
- Normalize speech patterns to readable text
- Preserve all meaning and important details
- Do NOT summarize or condense content
- Output Markdown format
- Maintain natural flow and readability
      `.trim(),
    },
    summary: {
      temperature: 0.3,
      systemPrompt: `
You create clear, structured summaries of general spoken content.

Rules:
- Capture main points and key information
- Preserve important details and context
- Organize content logically
- Use clear, concise language
- Output Markdown format
- Maintain readability and coherence
      `.trim(),
    },
  },
};
