export interface AiGenerateOptions {
  systemPrompt?: string;
  userPrompt: string;
  temperature?: number;
  maxTokens?: number;
}

export interface AiService {
  generateTextAsync(options: AiGenerateOptions): Promise<string>;
}
