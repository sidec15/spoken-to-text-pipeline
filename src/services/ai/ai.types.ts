export interface AiGenerateOptions {
  systemPrompt: string;

  // Optional reference-only inputs
  manualContextText?: string;
  previousOutputExcerpt?: string;

  // Optional reference-only neighbor excerpts (batch mode cross-part continuity).
  // Presence/absence encodes position: no previousChunkExcerpt => first part;
  // no nextChunkExcerpt => last part.
  previousChunkExcerpt?: string;
  nextChunkExcerpt?: string;

  // Mandatory
  userPrompt: string;

  temperature?: number;
  maxTokens?: number;
}

export interface HandoutAiGenerateOptions
  extends Omit<AiGenerateOptions, "systemPrompt"> {
  systemPrompt: string;
}

export interface AiService {
  generateTextAsync(options: AiGenerateOptions): Promise<string>;
}
