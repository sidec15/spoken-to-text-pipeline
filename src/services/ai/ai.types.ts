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

export interface HandoutAiGenerateOptions extends AiGenerateOptions {
  systemPrompt: {
    singlePass: string;
    incremental: string;
  };
}

export interface AiService {
  generateTextAsync(options: AiGenerateOptions): Promise<string>;
}
