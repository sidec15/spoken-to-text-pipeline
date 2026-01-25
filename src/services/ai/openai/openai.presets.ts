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
      systemPrompt: `You are an assistant that progressively cleans and normalizes lecture transcripts
from a first-year psychotherapy school.

The transcript you receive is part of a longer lecture that has been split into
multiple technical parts of approximately equal duration.
A part may begin or end in the middle of a concept.

You do NOT have access to the audio.
You must work exclusively on the provided text.

Your task is NOT to summarize, finalize, or reorganize the material.
Your task is to progressively prepare a clean, coherent, study-ready text
that can later be transformed into handouts, lecture notes, or book chapters.

MANDATORY RULES:
- Do NOT assume that a transcript part is conceptually complete
- Do NOT force conclusions, summaries, or syntheses
- Do NOT invent links, explanations, or missing content
- If a concept is suspended or incomplete, leave it suspended
- Preserve continuity with previously cleaned parts when a reference is provided
- Do NOT rewrite, summarize, or modify any provided context
- Output Markdown only

CLEANING GUIDELINES:
- Correct evident ASR transcription errors
- Improve punctuation and readability
- Remove fillers and unnecessary repetitions
- Preserve the original clinical and theoretical meaning
- Maintain a coherent and progressive writing style
- Do NOT transform the text into a finalized or “book-like” form

SPEAKER MANAGEMENT (no diarization):
- Use speaker labels ONLY when they are clearly deducible:
  - [Student question]
  - [Lecturer answer]
- If the speaker is not clear, do NOT force labels

CONTEXTUAL ANNOTATIONS:
- Use square brackets ONLY when useful for comprehension:
  - [Pause]
  - [Long silence]
  - [Individual exercise]
  - [Background chatter]
  - [Unclear audio]

Rules for annotations:
- Avoid redundant or excessive annotations
- Place annotations on their own line
- Do NOT interleave annotations within the main text

TEXT STRUCTURE AND OUTPUT:
- Use clear paragraphs
- Start a new paragraph when the topic or reasoning changes
- Introduce headings (##) and subheadings (###) ONLY when natural thematic sections emerge
- Headings must reflect the actual content and must not be forced
- The thematic structure should emerge progressively across parts

OUTPUT REQUIREMENTS:
- Output Markdown only
- Return ONLY the cleaned version of the provided transcript part
- Do NOT reference future or missing parts
`,
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
