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
import type { AiService, AiGenerateOptions } from "../../services/ai/ai.types.js";
import type { Logger } from "../../services/logger.js";
import type { ProgressReporter } from "../../services/progress.js";
import { loadContextText } from "../../utils/loadContextText.js";

const PREVIOUS_OUTPUT_EXCERPT_CHARS = 2000;
const NEIGHBOR_EXCERPT_CHARS = 2000;

/** Appended to the cleaning system prompt in batch mode. */
const CLEANING_BATCH_ADDENDUM = `

BATCH MODE (MULTI-PART)
This is one part of a multi-part transcript processed in parallel. Keep terminology and formatting consistent with the surrounding excerpts, but output ONLY the cleaned version of THIS part — never reproduce the neighbor excerpts. If no PRECEDING excerpt is provided, treat this as the FIRST part of the document; if no FOLLOWING excerpt is provided, treat this as the LAST part.`;

export class CleaningStep implements Step {
  readonly name = "cleaning";
  readonly mergedFileName = "clean-transcripts.md";

  async runAsync(ctx: StepContext): Promise<void> {
    const { config, baseDir, outputDir, logger, progress } = ctx;

    logger.info("Starting Cleaning step");

    const { transcriptsDir, cleanedDir } = this.ensureOutputDirectories(outputDir);

    if (!fs.existsSync(transcriptsDir)) {
      logger.warn("Transcripts directory not found, skipping Cleaning step");
      return;
    }

    const rawFiles = this.getRawTranscriptFiles(transcriptsDir);
    if (rawFiles.length === 0) {
      logger.warn("No raw transcripts found, skipping Cleaning step");
      return;
    }

    const filesToProcess = this.getFilesToProcess(rawFiles, cleanedDir);

    if (filesToProcess.length > 0) {
      const execution = resolveStepConfig(config, "cleaning").execution;
      const aiOptions = resolveAiConfig(config, "cleaning") as Omit<
        AiGenerateOptions,
        "userPrompt"
      >;
      const contextText = loadContextText(config.context?.textSources, baseDir);

      if (execution === "batch") {
        await this.processBatch(
          config, filesToProcess, transcriptsDir, cleanedDir, rawFiles,
          aiOptions, contextText, outputDir, logger, progress,
        );
      } else {
        const aiService = createAiService(config, "cleaning");
        progress?.start(filesToProcess.length, "Cleaning transcripts");

        let lastCleanedPath: string | undefined;
        for (const file of filesToProcess) {
          lastCleanedPath = await this.processFile(
            config,
            file,
            transcriptsDir,
            cleanedDir,
            rawFiles,
            lastCleanedPath,
            aiService,
            aiOptions,
            contextText,
            logger,
            progress,
          );
        }

        progress?.stop();
      }
    } else {
      logger.info("All transcripts already cleaned, skipping");
    }

    // Merge into general output dir root (not inside cleaned/)
    await this.mergeCleanedFiles(cleanedDir, outputDir, config, logger);

    logger.info("Cleaning step completed");
  }

  private ensureOutputDirectories(outputDir: string): {
    transcriptsDir: string;
    cleanedDir: string;
  } {
    const cleanedDir = path.join(outputDir, "cleaned");
    fs.mkdirSync(outputDir, { recursive: true });
    fs.mkdirSync(cleanedDir, { recursive: true });
    return {
      transcriptsDir: path.join(outputDir, "transcripts"),
      cleanedDir,
    };
  }

  private getRawTranscriptFiles(transcriptsDir: string): string[] {
    return fs
      .readdirSync(transcriptsDir)
      .filter((f) => f.endsWith(".txt"))
      .sort((a, b) => a.localeCompare(b, undefined, { numeric: true }));
  }

  private getFilesToProcess(
    rawFiles: string[],
    cleanedDir: string,
  ): string[] {
    return rawFiles.filter((file) => {
      const base = path.parse(file).name;
      return !fs.existsSync(path.join(cleanedDir, `${base}.md`));
    });
  }

  private async processFile(
    config: StepContext["config"],
    file: string,
    transcriptsDir: string,
    cleanedDir: string,
    rawFiles: string[],
    lastCleanedPath: string | undefined,
    aiService: AiService,
    aiOptions: Omit<AiGenerateOptions, "userPrompt">,
    contextText: string | undefined,
    logger: Logger,
    progress: ProgressReporter | undefined,
  ): Promise<string> {
    const base = path.parse(file).name;
    const inputPath = path.join(transcriptsDir, file);
    const outputPath = path.join(cleanedDir, `${base}.md`);

    const fileLogger = logger.withContext({ file });
    progress?.updateMessage(`Cleaning '${file}'`);

    const rawText = fs.readFileSync(inputPath, "utf-8");
    const previousOutputExcerpt = this.loadPreviousOutputExcerpt(
      lastCleanedPath,
      rawFiles,
      file,
      cleanedDir,
    );

    const cleaned = await aiService.generateTextAsync({
      systemPrompt: aiOptions.systemPrompt,
      manualContextText: contextText || undefined,
      previousOutputExcerpt,
      userPrompt: rawText,
      temperature: aiOptions.temperature,
      maxTokens: aiOptions.maxTokens,
    });

    const contentToWrite = await this.buildContentWithOptionalHeader(
      cleaned,
      rawFiles.indexOf(file) === 0,
      config,
      aiService,
    );

    await fs.promises.writeFile(outputPath, contentToWrite, "utf-8");

    fileLogger.silly(`Cleaned transcript saved to '${outputPath}'`);
    progress?.increment();

    return outputPath;
  }

  private async processBatch(
    config: StepContext["config"],
    filesToProcess: string[],
    transcriptsDir: string,
    cleanedDir: string,
    rawFiles: string[],
    aiOptions: Omit<AiGenerateOptions, "userPrompt">,
    contextText: string | undefined,
    outputDir: string,
    logger: Logger,
    progress: ProgressReporter | undefined,
  ): Promise<void> {
    const systemPrompt = aiOptions.systemPrompt + CLEANING_BATCH_ADDENDUM;

    const requests: BatchRequest[] = filesToProcess.map((file) => {
      const base = path.parse(file).name;
      const rawText = fs.readFileSync(path.join(transcriptsDir, file), "utf-8");
      const idx = rawFiles.indexOf(file);

      const previousChunkExcerpt =
        idx > 0
          ? fs.readFileSync(path.join(transcriptsDir, rawFiles[idx - 1]), "utf-8")
              .slice(-NEIGHBOR_EXCERPT_CHARS).trim() || undefined
          : undefined;
      const nextChunkExcerpt =
        idx < rawFiles.length - 1
          ? fs.readFileSync(path.join(transcriptsDir, rawFiles[idx + 1]), "utf-8")
              .slice(0, NEIGHBOR_EXCERPT_CHARS).trim() || undefined
          : undefined;

      return {
        customId: `cleaning::${base}`,
        options: {
          systemPrompt,
          manualContextText: contextText || undefined,
          previousChunkExcerpt,
          nextChunkExcerpt,
          userPrompt: rawText,
          temperature: aiOptions.temperature,
          maxTokens: aiOptions.maxTokens,
        },
      };
    });

    const batchService = createBatchAiService(config, "cleaning");
    const { pollIntervalMs, maxWaitMs } = getBatchTuning(config);

    progress?.start(requests.length, "Cleaning transcripts (batch)");
    const results = await runBatchStep({
      step: "cleaning",
      outputDir,
      batchService,
      requests,
      pollIntervalMs,
      maxWaitMs,
      logger,
      progress,
    });

    const aiService = createAiService(config, "cleaning");
    for (const result of results) {
      const base = result.customId.replace(/^cleaning::/, "");
      if (result.error) {
        logger.warn(`Cleaning failed for '${base}': ${result.error} (will reprocess on re-run)`);
        continue;
      }
      const idx = rawFiles.findIndex((f) => path.parse(f).name === base);
      const contentToWrite = await this.buildContentWithOptionalHeader(
        result.text ?? "",
        idx === 0,
        config,
        aiService,
      );
      await fs.promises.writeFile(path.join(cleanedDir, `${base}.md`), contentToWrite, "utf-8");
    }
    progress?.stop();
  }

  private loadPreviousOutputExcerpt(
    lastCleanedPath: string | undefined,
    rawFiles: string[],
    currentFile: string,
    cleanedDir: string,
  ): string | undefined {
    if (lastCleanedPath && fs.existsSync(lastCleanedPath)) {
      const text = fs.readFileSync(lastCleanedPath, "utf-8");
      return text.slice(-PREVIOUS_OUTPUT_EXCERPT_CHARS).trim() || undefined;
    }

    const currentIndex = rawFiles.indexOf(currentFile);
    if (currentIndex <= 0) {
      return undefined;
    }

    const previousFile = rawFiles[currentIndex - 1];
    const previousBase = path.parse(previousFile).name;
    const previousCleanedPath = path.join(cleanedDir, `${previousBase}.md`);

    if (!fs.existsSync(previousCleanedPath)) {
      return undefined;
    }

    const text = fs.readFileSync(previousCleanedPath, "utf-8");
    return text.slice(-PREVIOUS_OUTPUT_EXCERPT_CHARS).trim() || undefined;
  }

  private async buildContentWithOptionalHeader(
    content: string,
    isFirstFile: boolean,
    config: StepContext["config"],
    aiService: AiService,
  ): Promise<string> {
    if (!isFirstFile) {
      return content;
    }
    const stepLabel = await getLocalizedStepLabel(config, "cleaning", aiService);
    const header = buildMetadataHeader(config, stepLabel);
    return header + "\n\n" + content;
  }

  private async mergeCleanedFiles(
    cleanedDir: string,
    generalOutputDir: string,
    config: StepContext["config"],
    logger: Logger,
  ): Promise<void> {
    
    logger.debug(`Merging cleaned files from '${cleanedDir}' to '${generalOutputDir}'`);

    const cleanedFiles = this.getSortedCleanedFiles(cleanedDir);
    if (cleanedFiles.length === 0) {
      return;
    }

    const aiService = createAiService(config, "cleaning");
    const stepLabel = await getLocalizedStepLabel(config, "cleaning", aiService);
    const header = buildMetadataHeader(config, stepLabel);

    const parts = cleanedFiles.map((file) => {
      const filePath = path.join(cleanedDir, file);
      const content = fs.readFileSync(filePath, "utf-8");
      return this.stripMetadataHeader(content).trim();
    });

    const mergedPath = path.join(generalOutputDir, this.mergedFileName);
    const mergedContent = header + "\n\n" + parts.join("\n\n");
    await fs.promises.writeFile(mergedPath, mergedContent, "utf-8");
    logger.info(`Merged cleaned transcripts saved to '${mergedPath}'`);
  }

  private getSortedCleanedFiles(cleanedDir: string): string[] {
    return fs
      .readdirSync(cleanedDir)
      .filter((f) => f.endsWith(".md"))
      .sort((a, b) => a.localeCompare(b, undefined, { numeric: true }));
  }

  private stripMetadataHeader(content: string): string {
    const headerMatch = content.match(/^[\s\S]*?\*\*\*[^*]+\*\*\*\s*\n\n/);
    return headerMatch ? content.slice(headerMatch[0].length) : content;
  }
}
