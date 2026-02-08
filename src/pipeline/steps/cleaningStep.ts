import fs from "node:fs";
import path from "node:path";
import type { Step, StepContext } from "../step.js";
import { createAiService, resolveAiConfig } from "../../services/ai/aiServiceFactory.js";
import type { AiService, AiGenerateOptions } from "../../services/ai/ai.types.js";
import type { Logger } from "../../services/logger.js";
import type { ProgressReporter } from "../../services/progress.js";
import { loadContextText } from "../../utils/loadContextText.js";
import { resolveOutputDir } from "../../utils/resolveOutputDir.js";

export class CleaningStep implements Step {
  readonly name = "cleaning";

  async runAsync(ctx: StepContext): Promise<void> {
    const { config, baseDir, logger, progress } = ctx;

    logger.info("Starting Cleaning step");

    const outputDir = resolveOutputDir(config, baseDir);

    fs.mkdirSync(outputDir, { recursive: true });

    const rawFiles = fs
      .readdirSync(outputDir)
      .filter((f) => f.endsWith(".txt"))
      .sort();

    if (rawFiles.length === 0) {
      logger.warn("No raw transcripts found, skipping Cleaning step");
      return;
    }

    const filesToProcess = rawFiles.filter((file) => {
      const base = path.parse(file).name;
      return !fs.existsSync(path.join(outputDir, `${base}.md`));
    });

    if (filesToProcess.length === 0) {
      logger.info("All transcripts already cleaned, skipping");
      return;
    }

    const aiOptions = resolveAiConfig(config, "cleaning");
    const aiService = createAiService(config, "cleaning");

    const contextText = loadContextText(config.context?.textSources, baseDir);

    progress?.start(filesToProcess.length, "Cleaning transcripts");

    // Track the last cleaned file to provide continuity between sequential processing
    let lastCleanedPath: string | undefined;

    for (let i = 0; i < filesToProcess.length; i++) {
      const file = filesToProcess[i];
      const outputPath = await this.processFile({
        file,
        outputDir,
        rawFiles,
        lastCleanedPath,
        aiService,
        aiOptions,
        contextText,
        logger,
        progress,
      });

      // Update the last cleaned path for the next iteration
      lastCleanedPath = outputPath;
    }

    progress?.stop();
    logger.info("Cleaning step completed");
  }

  private async processFile(params: {
    file: string;
    outputDir: string;
    rawFiles: string[];
    lastCleanedPath: string | undefined;
    aiService: AiService;
    aiOptions: Omit<AiGenerateOptions, "userPrompt">;
    contextText: string | undefined;
    logger: Logger;
    progress: ProgressReporter | undefined;
  }): Promise<string> {
    const {
      file,
      outputDir,
      rawFiles,
      lastCleanedPath,
      aiService,
      aiOptions,
      contextText,
      logger,
      progress,
    } = params;

    const base = path.parse(file).name;
    const inputPath = path.join(outputDir, file);
    const outputPath = path.join(outputDir, `${base}.md`);

    const fileLogger = logger.withContext({ file });

    progress?.updateMessage(`Cleaning '${file}'`);

    const rawText = fs.readFileSync(inputPath, "utf-8");

    // Load previous cleaned excerpt from the file cleaned in the previous iteration
    // This provides context from the immediately previous cleaned file to maintain style consistency
    let previousOutputExcerpt: string | undefined;
    if (lastCleanedPath && fs.existsSync(lastCleanedPath)) {
      const previousCleanedText = fs.readFileSync(lastCleanedPath, "utf-8");
      // Take the last ~2000 characters as excerpt (roughly last paragraph/section)
      // This provides context without overwhelming the prompt with full history
      previousOutputExcerpt = previousCleanedText.slice(-2000).trim() || undefined;
    } else {
      // If no previous file was cleaned in this run, check if there's a previous file in sequence
      const currentFileIndex = rawFiles.indexOf(file);
      if (currentFileIndex > 0) {
        const previousFile = rawFiles[currentFileIndex - 1];
        const previousBase = path.parse(previousFile).name;
        const previousCleanedPath = path.join(outputDir, `${previousBase}.md`);

        if (fs.existsSync(previousCleanedPath)) {
          const previousCleanedText = fs.readFileSync(previousCleanedPath, "utf-8");
          previousOutputExcerpt = previousCleanedText.slice(-2000).trim() || undefined;
        }
      }
    }

    // Estimate maxTokens based on input length
    // Rough estimate: 1 token ≈ 4 characters
    // For cleaning, output is typically similar to input, but let consider double the input length
    const estimatedInputTokens = Math.ceil(rawText.length / 4);
    const calculatedMaxTokens = Math.ceil(estimatedInputTokens * 2);
    const maxTokens = aiOptions.maxTokens ?? calculatedMaxTokens; // Use override if provided, otherwise calculated

    const cleaned = await aiService.generateTextAsync({
      systemPrompt: aiOptions.systemPrompt,
      manualContextText: contextText || undefined,
      previousOutputExcerpt,
      userPrompt: rawText,
      temperature: aiOptions.temperature,
      maxTokens,
    });

    await fs.promises.writeFile(outputPath, cleaned, "utf-8");

    fileLogger.silly(`Cleaned transcript saved to '${outputPath}'`);
    progress?.increment();

    return outputPath;
  }
}
