export interface AiGenerateOptions {
  systemPrompt: string;

  // Optional reference-only inputs
  manualContextText?: string;
  previousOutputExcerpt?: string;

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
