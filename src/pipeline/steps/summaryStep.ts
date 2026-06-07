import fs from "node:fs";
import path from "node:path";
import type { Step, StepContext } from "../step.js";
import {
  buildMetadataHeader,
  createAiService,
  createBatchAiService,
  getBatchTuning,
  getLocalizedStepLabel,
  resolveAiConfig,
  resolveStepConfig,
} from "../../services/ai/aiServiceFactory.js";
import { runBatchStep } from "../batch/batchCoordinator.js";
import type { BatchRequest } from "../../services/ai/batch/batch.types.js";
import { loadContextText } from "../../utils/loadContextText.js";
import type { AiService, AiGenerateOptions } from "../../services/ai/ai.types.js";
import type { SupportedProfile, PipelineConfig } from "../../config/config.types.js";
import type { Logger } from "../../services/logger.js";
import type { ProgressReporter } from "../../services/progress.js";

export class SummaryStep implements Step {
  readonly name = "summary";

  private static readonly MAX_SAFE_INPUT_TOKENS = 90000;

  async runAsync(ctx: StepContext): Promise<void> {
    const { config, baseDir, outputDir, logger, progress } = ctx;

    logger.info("Starting Summary step");
    const summaryPath = path.join(outputDir, "summary.md");

    if (!this.checkIdempotency(summaryPath, logger)) {
      return;
    }

    const inputResult = this.getInputContent(config, outputDir, logger);
    if (!inputResult) {
      logger.warn("No input content found, skipping Summary step");
      return;
    }

    const { content: inputContent, inputType } = inputResult;
    const estimatedInputTokens = this.estimateTokens(inputContent, logger);
    const aiOptions = resolveAiConfig(config, "summary") as Omit<
      AiGenerateOptions,
      "userPrompt"
    >;
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
    const contextText = loadContextText(config.context?.textSources, baseDir);

    const execution = resolveStepConfig(config, "summary").execution;

    let summary: string;
    if (execution === "batch") {
      summary = await this.generateSummaryBatch(
        config,
        { ...aiOptions, systemPrompt: enhancedSystemPrompt },
        inputContent,
        estimatedInputTokens,
        wordCount,
        contextText,
        aiService,
        outputDir,
        logger,
        progress,
      );
    } else {
      summary = await this.generateSummary(
        aiService,
        { ...aiOptions, systemPrompt: enhancedSystemPrompt },
        inputContent,
        estimatedInputTokens,
        wordCount,
        contextText,
        logger,
        progress,
      );
    }

    await this.writeSummary(config, outputDir, summary, aiService, logger);
  }

  /**
   * Writes the summary to disk with a localized metadata header.
   */
  private async writeSummary(
    config: PipelineConfig,
    outputDir: string,
    summaryText: string,
    aiService: AiService,
    logger: Logger,
  ): Promise<void> {
    const summaryPath = path.join(outputDir, "summary.md");
    const stepLabel = await getLocalizedStepLabel(config, "summary", aiService);
    const header = buildMetadataHeader(config, stepLabel);
    const contentToWrite = header + "\n\n" + summaryText;
    await fs.promises.writeFile(summaryPath, contentToWrite, "utf-8");
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

  private async generateSummary(
    aiService: AiService,
    aiOptions: Omit<AiGenerateOptions, "userPrompt">,
    inputContent: string,
    estimatedInputTokens: number,
    wordCount: number,
    contextText: string | undefined,
    logger: Logger,
    progress: ProgressReporter | undefined,
  ): Promise<string> {
    if (estimatedInputTokens > SummaryStep.MAX_SAFE_INPUT_TOKENS) {
      logger.warn(
        `Input content (${estimatedInputTokens} tokens) exceeds safe limit (${SummaryStep.MAX_SAFE_INPUT_TOKENS} tokens). Using chunking strategy.`,
      );
      return await this.generateSummaryWithChunking(
        aiService,
        aiOptions,
        inputContent,
        wordCount,
        logger,
        progress,
        contextText,
      );
    }

    return await this.generateSinglePassSummary(
      aiService,
      aiOptions,
      inputContent,
      contextText,
      logger,
      progress,
    );
  }

  /**
   * Batch execution path: single-pass or chunked depending on input size.
   */
  private async generateSummaryBatch(
    config: PipelineConfig,
    aiOptions: Omit<AiGenerateOptions, "userPrompt">,
    inputContent: string,
    estimatedInputTokens: number,
    wordCount: number,
    contextText: string | undefined,
    aiService: AiService,
    outputDir: string,
    logger: Logger,
    progress: ProgressReporter | undefined,
  ): Promise<string> {
    const batchService = createBatchAiService(config, "summary");
    const { pollIntervalMs, maxWaitMs } = getBatchTuning(config);

    const pad = (i: number) => String(i).padStart(4, "0");

    if (estimatedInputTokens > SummaryStep.MAX_SAFE_INPUT_TOKENS) {
      // Batch-chunked path
      logger.warn(
        `Input content (${estimatedInputTokens} tokens) exceeds safe limit (${SummaryStep.MAX_SAFE_INPUT_TOKENS} tokens). Using chunking strategy.`,
      );
      const chunks = this.splitContentIntoChunks(inputContent, logger, progress);

      const requests: BatchRequest[] = chunks.map((chunk, i) => ({
        customId: `summary::chunk-${pad(i)}`,
        options: {
          systemPrompt: this.buildChunkSystemPrompt(aiOptions.systemPrompt, wordCount, chunks.length),
          manualContextText: contextText || undefined,
          userPrompt: chunk,
          temperature: aiOptions.temperature,
          maxTokens: aiOptions.maxTokens,
        },
      }));

      logger.info(`Processing input content in chunks (batch mode, ${chunks.length} chunks)`);
      progress?.start(requests.length, "Summary chunks (batch)");
      const results = await runBatchStep({
        step: "summary",
        outputDir,
        batchService,
        requests,
        pollIntervalMs,
        maxWaitMs,
        logger,
        progress,
      });
      progress?.stop();

      const byId = new Map(results.map((r) => [r.customId, r]));
      const chunkSummaries: string[] = [];
      for (let i = 0; i < chunks.length; i++) {
        const customId = `summary::chunk-${pad(i)}`;
        const r = byId.get(customId);
        if (!r || r.error || !r.text) {
          throw new Error(
            `Summary batch chunk missing/failed for chunk ${i}` +
              (r?.error ? `: ${r.error}` : "") + ". Re-run to retry.",
          );
        }
        chunkSummaries.push(r.text);
      }

      if (chunkSummaries.length === 1) {
        return chunkSummaries[0];
      }

      // Merge via existing sync mergeChunkSummaries (single AI call at full price)
      return this.mergeChunkSummaries(aiService, aiOptions, chunkSummaries, wordCount, contextText);
    }

    // Batch single-pass path
    logger.info("Processing input content in a single pass (batch mode)");
    const requests: BatchRequest[] = [
      {
        customId: "summary::main",
        options: {
          systemPrompt: aiOptions.systemPrompt,
          manualContextText: contextText || undefined,
          userPrompt: inputContent,
          temperature: aiOptions.temperature,
          maxTokens: aiOptions.maxTokens,
        },
      },
    ];

    progress?.start(1, "Summary (batch)");
    const results = await runBatchStep({
      step: "summary",
      outputDir,
      batchService,
      requests,
      pollIntervalMs,
      maxWaitMs,
      logger,
      progress,
    });
    progress?.stop();

    const main = results.find((r) => r.customId === "summary::main");
    if (!main || main.error || !main.text) {
      throw new Error(
        `Summary batch result missing/failed` +
          (main?.error ? `: ${main.error}` : "") + ". Re-run to retry.",
      );
    }
    return main.text;
  }

  private async generateSinglePassSummary(
    aiService: AiService,
    aiOptions: Omit<AiGenerateOptions, "userPrompt">,
    inputContent: string,
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
      maxTokens: aiOptions.maxTokens,
    });
    progress?.increment();
    progress?.stop();
    return summary;
  }

  /**
   * Gets input content for summary. All profiles use handout.md when available;
   * otherwise falls back to merged cleaned files (e.g. when handout step is disabled).
   */
  private getInputContent(
    _config: StepContext["config"],
    outputDir: string,
    logger: StepContext["logger"],
  ): { content: string; inputType: "handout" | "transcript" } | null {
    const handoutPath = path.join(outputDir, "handout.md");
    if (fs.existsSync(handoutPath)) {
      logger.info("Reading handout.md for summary input");
      const content = fs.readFileSync(handoutPath, "utf-8");
      return { content, inputType: "handout" };
    }

    const cleanedDir = path.join(outputDir, "cleaned");
    if (!fs.existsSync(cleanedDir)) {
      logger.warn("Cleaned directory not found, cannot generate summary");
      return null;
    }

    const cleanedFiles = fs
      .readdirSync(cleanedDir)
      .filter((f) => f.endsWith(".md"))
      .sort((a, b) => {
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
    const mergedContent = cleanedFiles
      .map((file, index) => {
        const content = fs.readFileSync(path.join(cleanedDir, file), "utf-8");
        return `---\n## Part ${index + 1}\n\n${content}\n`;
      })
      .join("\n\n");

    return { content: mergedContent, inputType: "transcript" };
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
   * Builds a per-chunk system prompt with a proportional word count target.
   * Strips any existing word count instruction before re-applying.
   */
  private buildChunkSystemPrompt(systemPrompt: string, wordCount: number, chunkCount: number): string {
    const chunkWordCountTarget = Math.ceil(wordCount / chunkCount);
    const baseSystemPrompt = systemPrompt.replace(/\n\nIMPORTANT:.*$/, "");
    return this.enhancePromptWithWordCount(baseSystemPrompt, chunkWordCountTarget);
  }

  /**
   * Generates summary using chunking strategy when content exceeds token limits.
   * Uses a two-pass approach:
   * 1. Summarize each chunk independently
   * 2. Merge summaries into final cohesive summary
   */
  private async generateSummaryWithChunking(
    aiService: AiService,
    aiOptions: { systemPrompt: string; temperature?: number; maxTokens?: number },
    inputContent: string,
    wordCount: number,
    logger: StepContext["logger"],
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
      progress,
      contextText,
    );

    if (chunkSummaries.length === 1) {
      return chunkSummaries[0];
    }

    return this.mergeChunkSummaries(aiService, aiOptions, chunkSummaries, wordCount, contextText);
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
    aiOptions: { systemPrompt: string; temperature?: number; maxTokens?: number },
    chunks: string[],
    wordCount: number,
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
      const chunkSystemPrompt = this.buildChunkSystemPrompt(aiOptions.systemPrompt, wordCount, chunks.length);

      const chunkSummary = await aiService.generateTextAsync({
        systemPrompt: chunkSystemPrompt,
        manualContextText: contextText || undefined,
        userPrompt: chunk,
        temperature: aiOptions.temperature,
        maxTokens: aiOptions.maxTokens,
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
    aiOptions: { systemPrompt: string; temperature?: number; maxTokens?: number },
    chunkSummaries: string[],
    wordCount: number,
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
      maxTokens: aiOptions.maxTokens,
    });

    return finalSummary;
  }
}
