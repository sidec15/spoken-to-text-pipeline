import fs from "node:fs";
import path from "node:path";
import type { Step, StepContext } from "../step.js";
import { createAiService, resolveAiConfig } from "../../services/ai/aiServiceFactory.js";
import { resolveOutputDir } from "../../utils/resolveOutputDir.js";
import { loadContextText } from "../../utils/loadContextText.js";
import type { AiService, AiGenerateOptions } from "../../services/ai/ai.types.js";
import type { SupportedProfile, PipelineConfig } from "../../config/config.types.js";
import type { Logger } from "../../services/logger.js";
import type { ProgressReporter } from "../../services/progress.js";

export class SummaryStep implements Step {
  readonly name = "summary";

  async runAsync(ctx: StepContext): Promise<void> {
    const { config, logger, progress } = ctx;

    logger.info("Starting Summary step");

    const outputDir = resolveOutputDir(config);
    const summaryPath = path.join(outputDir, "summary.md");

    if (!this.checkIdempotency(summaryPath, logger)) {
      return;
    }

    const inputContent = this.getInputContent(config, outputDir, logger);
    if (!inputContent) {
      logger.warn("No input content found, skipping Summary step");
      return;
    }

    const estimatedInputTokens = this.estimateTokens(inputContent, logger);
    const aiOptions = resolveAiConfig(config, "summary");
    const inputType = this.determineInputType(config.profile);
    const wordCount = this.calculateWordCount(
      config,
      inputContent,
      inputType,
      logger,
    );
    const enhancedSystemPrompt = this.enhancePromptWithWordCount(
      aiOptions.systemPrompt,
      wordCount,
    );

    const aiService = createAiService(config, "summary");
    const contextText = loadContextText(config.context?.textSources);
    const maxTokens = this.calculateMaxTokens(wordCount, aiOptions);

    const summary = await this.generateSummary(
      aiService,
      { ...aiOptions, systemPrompt: enhancedSystemPrompt },
      inputContent,
      estimatedInputTokens,
      wordCount,
      maxTokens,
      contextText,
      logger,
      progress,
    );

    await fs.promises.writeFile(summaryPath, summary, "utf-8");
    logger.info(`Summary saved to '${summaryPath}'`);
  }

  private checkIdempotency(summaryPath: string, logger: Logger): boolean {
    // Idempotency check
    if (fs.existsSync(summaryPath)) {
      logger.info("Summary already exists, skipping Summary step");
      return false;
    }
    return true;
  }

  private estimateTokens(content: string, logger: Logger): number {
    // Check token limits (rough estimate: 1 token ≈ 4 characters)
    const estimatedInputTokens = Math.ceil(content.length / 4);
    logger.info(`Estimated input tokens: ${estimatedInputTokens}`);
    return estimatedInputTokens;
  }

  private determineInputType(profile: SupportedProfile): "handout" | "transcript" {
    // Determine input type for dynamic calculation
    return profile === "lecture" ? "handout" : "transcript";
  }

  private calculateWordCount(
    config: PipelineConfig,
    inputContent: string,
    inputType: "handout" | "transcript",
    logger: Logger,
  ): number {
    // Calculate word count dynamically if not explicitly set
    const wordCount =
      config.output?.summaryWordCount ??
      this.calculateDynamicWordCount(inputContent, config.profile, inputType);

    logger.info(
      `Target summary word count: ${wordCount}${
        config.output?.summaryWordCount
          ? " (static override)"
          : " (calculated dynamically)"
      }`,
    );

    return wordCount;
  }

  private calculateMaxTokens(
    wordCount: number,
    aiOptions: Omit<AiGenerateOptions, "userPrompt">,
  ): number {
    // Estimate maxTokens based on word count target (roughly 1 word ≈ 1.3 tokens)
    const targetTokens = Math.ceil(wordCount * 1.3);
    return aiOptions.maxTokens ?? targetTokens;
  }

  private async generateSummary(
    aiService: AiService,
    aiOptions: Omit<AiGenerateOptions, "userPrompt">,
    inputContent: string,
    estimatedInputTokens: number,
    wordCount: number,
    maxTokens: number,
    contextText: string | undefined,
    logger: Logger,
    progress: ProgressReporter | undefined,
  ): Promise<string> {
    // Conservative context limit: most models support at least 100K tokens
    // Reserve space for system prompt (~500 tokens) and output buffer
    const MAX_SAFE_INPUT_TOKENS = 90000; // Leave room for system prompt and output

    if (estimatedInputTokens > MAX_SAFE_INPUT_TOKENS) {
      logger.warn(
        `Input content (${estimatedInputTokens} tokens) exceeds safe limit (${MAX_SAFE_INPUT_TOKENS} tokens). Using chunking strategy.`,
      );
      return await this.generateSummaryWithChunking(
        aiService,
        aiOptions,
        inputContent,
        wordCount,
        logger,
        maxTokens,
        progress,
        contextText,
      );
    }

    return await this.generateSinglePassSummary(
      aiService,
      aiOptions,
      inputContent,
      maxTokens,
      contextText,
      logger,
      progress,
    );
  }

  private async generateSinglePassSummary(
    aiService: AiService,
    aiOptions: Omit<AiGenerateOptions, "userPrompt">,
    inputContent: string,
    maxTokens: number,
    contextText: string | undefined,
    logger: Logger,
    progress: ProgressReporter | undefined,
  ): Promise<string> {
    // Single pass - process all content at once
    logger.info("Processing input content in a single pass");
    progress?.start(1, "Generating summary");
    const summary = await aiService.generateTextAsync({
      systemPrompt: aiOptions.systemPrompt,
      manualContextText: contextText || undefined,
      userPrompt: inputContent,
      temperature: aiOptions.temperature,
      maxTokens,
    });
    progress?.increment();
    progress?.stop();
    return summary;
  }

  /**
   * Gets input content based on profile:
   * - Lecture: reads handout.md
   * - Meeting/Other: reads and merges all part-XX.md files
   */
  private getInputContent(
    config: StepContext["config"],
    outputDir: string,
    logger: StepContext["logger"],
  ): string | null {
    if (config.profile === "lecture") {
      const handoutPath = path.join(outputDir, "handout.md");
      if (!fs.existsSync(handoutPath)) {
        logger.warn("Handout not found, cannot generate summary for lecture profile");
        return null;
      }
      logger.info("Reading handout.md for summary input");
      return fs.readFileSync(handoutPath, "utf-8");
    } else {
      // Meeting/Other: read and merge all part-XX.md files
      const cleanedFiles = fs
        .readdirSync(outputDir)
        .filter((f) => f.endsWith(".md") && f !== "handout.md" && f !== "summary.md")
        .sort((a, b) => {
          // Extract numeric part from filenames (e.g., "part-1.md" -> 1, "part-01.md" -> 1, "part-10.md" -> 10)
          const extractNumber = (filename: string): number => {
            const match = filename.match(/(\d+)/);
            return match ? parseInt(match[1], 10) : Infinity;
          };
          return extractNumber(a) - extractNumber(b);
        });

      if (cleanedFiles.length === 0) {
        logger.warn("No cleaned transcript files found, cannot generate summary");
        return null;
      }

      logger.info(`Found ${cleanedFiles.length} cleaned transcript parts to merge for summary`);

      // Merge all cleaned files with clear separators
      const mergedContent = cleanedFiles
        .map((file, index) => {
          const content = fs.readFileSync(path.join(outputDir, file), "utf-8");
          return `---\n## Part ${index + 1}\n\n${content}\n`;
        })
        .join("\n\n");

      return mergedContent;
    }
  }

  /**
   * Calculates dynamic word count based on input content, profile, and input type.
   * Uses profile-specific compression ratios with bounds for safety.
   */
  private calculateDynamicWordCount(
    inputContent: string,
    profile: SupportedProfile,
    inputType: "handout" | "transcript",
  ): number {
    // Estimate word count from content (rough: 5 characters per word)
    const inputWordCount = Math.ceil(inputContent.length / 5);

    // Base compression ratios per profile
    const baseRatios = {
      lecture: inputType === "handout" ? 0.15 : 0.10, // Handout already condensed
      meeting: 0.50, // 50% - preserves more detail for meetings
      other: 0.50, // 50% - preserves more detail
    };

    // Calculate base word count
    let wordCount = Math.ceil(inputWordCount * baseRatios[profile]);

    // Adjust for very short content (minimum detail preservation)
    if (inputWordCount < 1000) {
      wordCount = Math.max(wordCount, Math.ceil(inputWordCount * 0.30)); // 30% minimum
    }

    // Adjust for very long content (prevent excessive length)
    if (inputWordCount > 50000) {
      wordCount = Math.min(wordCount, Math.ceil(inputWordCount * 0.08)); // 8% maximum
    }

    // Apply absolute bounds
    const MIN_WORD_COUNT = 200;
    const MAX_WORD_COUNT = 5000;

    return Math.max(MIN_WORD_COUNT, Math.min(MAX_WORD_COUNT, wordCount));
  }

  /**
   * Enhances system prompt with word count target
   */
  private enhancePromptWithWordCount(systemPrompt: string, wordCount: number): string {
    const wordCountInstruction = `\n\nIMPORTANT: Your output should be approximately ${wordCount} words. Aim for this target word count while maintaining quality and completeness.`;
    return systemPrompt + wordCountInstruction;
  }

  /**
   * Generates summary using chunking strategy when content exceeds token limits.
   * Uses a two-pass approach:
   * 1. Summarize each chunk independently
   * 2. Merge summaries into final cohesive summary
   */
  private async generateSummaryWithChunking(
    aiService: AiService,
    aiOptions: { systemPrompt: string; temperature?: number },
    inputContent: string,
    wordCount: number,
    logger: StepContext["logger"],
    maxTokens: number,
    progress?: StepContext["progress"],
    contextText?: string,
  ): Promise<string> {
    logger.info("Processing input content in chunks");

    const chunks = this.splitContentIntoChunks(inputContent, logger, progress);
    const chunkSummaries = await this.summarizeChunks(
      aiService,
      aiOptions,
      chunks,
      wordCount,
      maxTokens,
      progress,
      contextText,
    );

    if (chunkSummaries.length === 1) {
      return chunkSummaries[0];
    }

    return this.mergeChunkSummaries(aiService, aiOptions, chunkSummaries, wordCount, maxTokens, contextText);
  }

  /**
   * Splits input content into chunks based on token limits.
   */
  private splitContentIntoChunks(
    inputContent: string,
    logger: StepContext["logger"],
    progress?: StepContext["progress"],
  ): string[] {
    const CHUNK_SIZE_TOKENS = 80000; // Safe chunk size
    const CHUNK_SIZE_CHARS = CHUNK_SIZE_TOKENS * 4; // Rough conversion

    const chunks: string[] = [];
    let currentChunk = "";
    const lines = inputContent.split("\n");
    const totalLines = lines.length;

    // Start progress bar for chunking
    progress?.start(totalLines, "Splitting content into chunks");

    for (let i = 0; i < lines.length; i++) {
      const line = lines[i];
      const lineSize = line.length + 1; // +1 for newline

      if (currentChunk.length + lineSize > CHUNK_SIZE_CHARS && currentChunk.length > 0) {
        chunks.push(currentChunk);
        currentChunk = line + "\n";
        progress?.updateMessage(`Splitting content into chunks - Created ${chunks.length} chunk(s)`);
      } else {
        currentChunk += line + "\n";
      }

      // Update progress every 100 lines or at the end
      if ((i + 1) % 100 === 0) {
        progress?.increment(100);
      } else if (i === lines.length - 1) {
        // Increment remaining lines at the end
        const remaining = (i + 1) % 100;
        if (remaining > 0) {
          progress?.increment(remaining);
        }
      }
    }

    if (currentChunk.length > 0) {
      chunks.push(currentChunk);
    }

    progress?.stop();
    logger.info(`Split into ${chunks.length} chunks`);

    return chunks;
  }

  /**
   * Summarizes each chunk independently with proportional word count targets.
   */
  private async summarizeChunks(
    aiService: AiService,
    aiOptions: { systemPrompt: string; temperature?: number },
    chunks: string[],
    wordCount: number,
    maxTokens: number,
    progress?: StepContext["progress"],
    contextText?: string,
  ): Promise<string[]> {
    const totalSteps = chunks.length + (chunks.length > 1 ? 1 : 0);
    progress?.start(totalSteps, "Generating summary (chunking)");

    const chunkSummaries: string[] = [];

    for (let i = 0; i < chunks.length; i++) {
      const chunk = chunks[i];
      progress?.updateMessage(`Generating summary (chunking) - Chunk ${i + 1}/${chunks.length}`);

      // For chunk summaries, use a proportional word count target
      // Distribute word count target across chunks
      const chunkWordCountTarget = Math.ceil(wordCount / chunks.length);
      const baseSystemPrompt = aiOptions.systemPrompt.replace(/\n\nIMPORTANT:.*$/, ""); // Remove existing word count instruction
      const chunkSystemPrompt = this.enhancePromptWithWordCount(baseSystemPrompt, chunkWordCountTarget);

      const chunkSummary = await aiService.generateTextAsync({
        systemPrompt: chunkSystemPrompt,
        manualContextText: contextText || undefined,
        userPrompt: chunk,
        temperature: aiOptions.temperature,
        maxTokens: Math.ceil(maxTokens / chunks.length),
      });

      chunkSummaries.push(chunkSummary);
      progress?.increment();
    }

    // Stop progress bar if single chunk (no merge needed)
    if (chunkSummaries.length === 1) {
      progress?.stop();
    }

    return chunkSummaries;
  }

  /**
   * Merges multiple chunk summaries into a single cohesive summary.
   */
  private async mergeChunkSummaries(
    aiService: AiService,
    aiOptions: { systemPrompt: string; temperature?: number },
    chunkSummaries: string[],
    wordCount: number,
    maxTokens: number,
    contextText?: string,
  ): Promise<string> {
    const mergedSummaries = chunkSummaries
      .map((summary, index) => `---\n## Section ${index + 1}\n\n${summary}\n`)
      .join("\n\n");

    const mergeSystemPrompt = `You are merging multiple summary sections into a single, cohesive summary.

The following sections were generated from different parts of the content.
Your task is to:
1. Merge them into a single, well-structured summary
2. Remove duplicate content
3. Ensure smooth transitions between sections
4. Maintain logical organization
5. Preserve all important information

IMPORTANT: Your output should be approximately ${wordCount} words. Aim for this target word count while maintaining quality and completeness.

Output a complete, unified summary.`;

    const finalSummary = await aiService.generateTextAsync({
      systemPrompt: mergeSystemPrompt,
      manualContextText: contextText || undefined,
      userPrompt: mergedSummaries,
      temperature: aiOptions.temperature,
      maxTokens,
    });

    return finalSummary;
  }
}
