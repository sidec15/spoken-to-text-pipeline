import fs from "node:fs";
import path from "node:path";
import type { Step, StepContext } from "../step.js";
import { OpenAiService } from "../../services/ai/openai/openaiAiService.js";
import { resolveOpenAiConfig } from "../../services/ai/openai/resolveOpenAiConfig.js";
import { resolveOutputDir } from "../../utils/resolveOutputDir.js";

export class HandoutStep implements Step {
  readonly name = "handout";

  async runAsync(ctx: StepContext): Promise<void> {
    const { config, logger, progress } = ctx;

    // Handout is only for lecture profile
    if (config.profile !== "lecture") {
      logger.info(
        `Handout step skipped for profile '${config.profile}' (only available for lecture)`,
      );
      return;
    }

    logger.info("Starting Handout step");

    const outputDir = resolveOutputDir(config);
    const handoutPath = path.join(outputDir, "handout.md");

    // Idempotency check
    if (fs.existsSync(handoutPath)) {
      logger.info("Handout already exists, skipping Handout step");
      return;
    }

    // Read all cleaned files and sort by numeric part index
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
      logger.warn("No cleaned transcript files found, skipping Handout step");
      return;
    }

    logger.info(`Found ${cleanedFiles.length} cleaned transcript parts to merge`);

    // Merge all cleaned files with clear separators
    const mergedContent = cleanedFiles
      .map((file, index) => {
        const content = fs.readFileSync(path.join(outputDir, file), "utf-8");
        return `---\n## Part ${index + 1}\n\n${content}\n`;
      })
      .join("\n\n");

    // Check token limits (rough estimate: 1 token ≈ 4 characters)
    const estimatedInputTokens = Math.ceil(mergedContent.length / 4);
    logger.info(`Estimated input tokens: ${estimatedInputTokens}`);

    const aiOptions = resolveOpenAiConfig(config, "handout");

    // Conservative context limit: most models support at least 100K tokens
    // Reserve space for system prompt (~500 tokens) and output buffer
    const MAX_SAFE_INPUT_TOKENS = 90000; // Leave room for system prompt and output

    const aiService =
      config.ai.provider === "openai" && "openai" in config.ai.config
        ? new OpenAiService(config.ai.config.openai.apiKey, config.ai.config.openai.model)
        : (() => {
            throw new Error("Unsupported AI provider");
          })();

    // Estimate maxTokens based on input length
    // For handout, output is typically similar or slightly longer than input
    const calculatedMaxTokens = Math.ceil(estimatedInputTokens * 1.5);
    const maxTokens = aiOptions.maxTokens ?? calculatedMaxTokens;

    let handout: string;

    if (estimatedInputTokens > MAX_SAFE_INPUT_TOKENS) {
      logger.warn(
        `Input content (${estimatedInputTokens} tokens) exceeds safe limit (${MAX_SAFE_INPUT_TOKENS} tokens). Using chunking strategy.`,
      );
      handout = await this.generateHandoutWithChunking(
        aiService,
        aiOptions,
        cleanedFiles,
        outputDir,
        logger,
        maxTokens,
        progress,
      );
    } else {
      // Single pass - process all content at once
      logger.info("Processing input content in a single pass");
      handout = await aiService.generateTextAsync({
        systemPrompt: aiOptions.systemPrompt,
        userPrompt: mergedContent,
        temperature: aiOptions.temperature,
        maxTokens,
      });
    }

    await fs.promises.writeFile(handoutPath, handout, "utf-8");

    logger.info(`Handout saved to '${handoutPath}'`);
  }

  /**
   * Generates handout using chunking strategy when content exceeds token limits.
   * Uses a two-pass approach:
   * 1. Process chunks to identify themes and structure
   * 2. Reorganize and merge into final handout
   */
  private async generateHandoutWithChunking(
    aiService: OpenAiService,
    aiOptions: { systemPrompt: string; temperature?: number },
    cleanedFiles: string[],
    outputDir: string,
    logger: StepContext["logger"],
    maxTokens: number,
    progress?: StepContext["progress"],
  ): Promise<string> {
    logger.info(`Processing ${cleanedFiles.length} files in chunks`);

    // Read all file contents
    const fileContents = cleanedFiles.map((file) => ({
      name: file,
      content: fs.readFileSync(path.join(outputDir, file), "utf-8"),
    }));

    const chunks = this.groupFilesIntoChunks(fileContents, logger, progress);
    const chunkResults = await this.processChunks(
      aiService,
      aiOptions,
      chunks,
      maxTokens,
      logger,
      progress,
    );

    if (chunkResults.length === 1) {
      return chunkResults[0];
    }

    return this.mergeChunkResults(aiService, aiOptions, chunkResults);
  }

  /**
   * Groups files into chunks based on token limits.
   */
  private groupFilesIntoChunks(
    fileContents: Array<{ name: string; content: string }>,
    logger: StepContext["logger"],
    progress?: StepContext["progress"],
  ): Array<Array<{ name: string; content: string }>> {
    const CHUNK_SIZE_TOKENS = 80000; // Safe chunk size
    const CHUNK_SIZE_CHARS = CHUNK_SIZE_TOKENS * 4; // Rough conversion

    const chunks: Array<Array<(typeof fileContents)[0]>> = [];
    let currentChunk: typeof fileContents = [];
    let currentChunkSize = 0;
    const totalFiles = fileContents.length;

    // Start progress bar for grouping files
    progress?.start(totalFiles, "Grouping files into chunks");

    for (let i = 0; i < fileContents.length; i++) {
      const file = fileContents[i];
      const fileSize = file.content.length;
      const separatorSize = 50; // Size of separator text

      if (
        currentChunkSize + fileSize + separatorSize > CHUNK_SIZE_CHARS &&
        currentChunk.length > 0
      ) {
        chunks.push([...currentChunk]);
        currentChunk = [file];
        currentChunkSize = fileSize;
        progress?.updateMessage(`Grouping files into chunks - Created ${chunks.length} chunk(s)`);
      } else {
        currentChunk.push(file);
        currentChunkSize += fileSize + separatorSize;
      }

      progress?.increment();
    }

    if (currentChunk.length > 0) {
      chunks.push(currentChunk);
    }

    progress?.stop();
    logger.info(`Split into ${chunks.length} chunks`);

    return chunks;
  }

  /**
   * Processes each chunk independently to generate handout sections.
   */
  private async processChunks(
    aiService: OpenAiService,
    aiOptions: { systemPrompt: string; temperature?: number },
    chunks: Array<Array<{ name: string; content: string }>>,
    maxTokens: number,
    logger: StepContext["logger"],
    progress?: StepContext["progress"],
  ): Promise<string[]> {
    // Total steps: chunks + final merge (if multiple chunks)
    const totalSteps = chunks.length + (chunks.length > 1 ? 1 : 0);
    progress?.start(totalSteps, "Generating handout (chunking)");

    const chunkResults: string[] = [];

    for (let i = 0; i < chunks.length; i++) {
      const chunk = chunks[i];
      const chunkContent = chunk
        .map((file, index) => {
          const globalIndex = chunks.slice(0, i).reduce((sum, c) => sum + c.length, 0) + index;
          return `---\n## Part ${globalIndex + 1}\n\n${file.content}\n`;
        })
        .join("\n\n");

      progress?.updateMessage(
        `Generating handout (chunking) - Chunk ${i + 1}/${chunks.length} (${chunk.length} files)`,
      );

      const chunkHandout = await aiService.generateTextAsync({
        systemPrompt: aiOptions.systemPrompt,
        userPrompt: chunkContent,
        temperature: aiOptions.temperature,
        maxTokens: Math.ceil((chunkContent.length / 4) * 1.5),
      });

      chunkResults.push(chunkHandout);
      progress?.increment();
    }

    // Stop progress bar if single chunk (no merge needed)
    if (chunkResults.length === 1) {
      progress?.stop();
    }

    return chunkResults;
  }

  /**
   * Merges multiple chunk results into a single cohesive handout.
   */
  private async mergeChunkResults(
    aiService: OpenAiService,
    aiOptions: { systemPrompt: string; temperature?: number },
    chunkResults: string[],
  ): Promise<string> {
    const mergedChunks = chunkResults
      .map((content, index) => `---\n## Chunk ${index + 1}\n\n${content}\n`)
      .join("\n\n");

    const mergeSystemPrompt = `You are merging multiple handout sections into a single, cohesive handout.

The following sections were generated from different parts of a lecture.
Your task is to:
1. Merge them into a single, well-structured handout
2. Remove duplicate content
3. Ensure smooth transitions between sections
4. Maintain the table of contents structure
5. Preserve all important content

Output a complete, unified handout with table of contents.`;

    const finalHandout = await aiService.generateTextAsync({
      systemPrompt: mergeSystemPrompt,
      userPrompt: mergedChunks,
      temperature: aiOptions.temperature,
      maxTokens: Math.ceil((mergedChunks.length / 4) * 1.5),
    });

    return finalHandout;
  }
}
