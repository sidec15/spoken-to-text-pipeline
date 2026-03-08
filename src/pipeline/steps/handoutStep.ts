import fs from "node:fs";
import path from "node:path";
import type { Step, StepContext } from "../step.js";
import type { AiService, AiGenerateOptions, HandoutAiGenerateOptions } from "../../services/ai/ai.types.js";
import {
  buildMetadataHeader,
  createAiService,
  getLocalizedStepLabel,
  resolveAiConfig,
} from "../../services/ai/aiServiceFactory.js";
import { loadContextText } from "../../utils/loadContextText.js";
import type { Logger } from "../../services/logger.js";
import type { ProgressReporter } from "../../services/progress.js";

export class HandoutStep implements Step {
  readonly name = "handout";

  async runAsync(ctx: StepContext): Promise<void> {
    const { config, baseDir, outputDir, logger, progress } = ctx;
    const handoutPath = path.join(outputDir, "handout.md");

    if (!this.checkIdempotency(handoutPath, logger)) {
      return;
    }

    const cleanedFiles = this.getSortedCleanedFiles(outputDir, logger);
    if (cleanedFiles.length === 0) {
      return;
    }

    const aiOptions = resolveAiConfig(config, "handout") as Omit<HandoutAiGenerateOptions, "userPrompt">;
    const aiService = createAiService(config, "handout");
    const contextText = loadContextText(config.context?.textSources, baseDir);

    const handout = await this.generateHandoutIncremental(
      aiService,
      aiOptions,
      cleanedFiles,
      outputDir,
      contextText,
      logger,
      progress,
    );

    const stepLabel = await getLocalizedStepLabel(config, "handout", aiService);
    const header = buildMetadataHeader(config, stepLabel);
    const contentToWrite = header + "\n\n" + handout;

    await fs.promises.writeFile(handoutPath, contentToWrite, "utf-8");
    logger.info(`Handout saved to '${handoutPath}'`);
  }

  private checkIdempotency(handoutPath: string, logger: Logger): boolean {
    logger.info("Starting Handout step");

    if (fs.existsSync(handoutPath)) {
      logger.info("Handout already exists, skipping Handout step");
      return false;
    }

    return true;
  }

  private getSortedCleanedFiles(outputDir: string, logger: Logger): string[] {
    // Read all cleaned files from the cleaned subdirectory and sort by numeric part index
    const cleanedDir = path.join(outputDir, "cleaned");
    if (!fs.existsSync(cleanedDir)) {
      logger.warn("Cleaned directory not found, skipping Handout step");
      return [];
    }

    const cleanedFiles = fs
      .readdirSync(cleanedDir)
      .filter((f) => f.endsWith(".md"))
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
      return [];
    }

    logger.info(`Found ${cleanedFiles.length} cleaned transcript parts to merge`);
    return cleanedFiles;
  }

  /** Last N characters of previous handout to pass as context (keeps token usage bounded). */
  private static readonly PREVIOUS_HANDOUT_EXCERPT_CHARS = 4000;

  /** Extracts the last main section number (e.g. 5 from "## 5. Title" or "### 5.2 Subtitle"). */
  private extractLastSectionNumber(handout: string): number | null {
    const regex = /(?:^|\n)#{2,6}\s+(\d+)(?:\.\d+)*\s*\./g;
    const matches = [...handout.matchAll(regex)];
    const last = matches.pop();
    return last ? parseInt(last[1], 10) : null;
  }

  private async generateHandoutIncremental(
    aiService: AiService,
    aiOptions: Omit<AiGenerateOptions, "userPrompt">,
    cleanedFiles: string[],
    outputDir: string,
    contextText: string | undefined,
    logger: Logger,
    progress: ProgressReporter | undefined,
  ): Promise<string> {
    const cleanedDir = path.join(outputDir, "cleaned");
    let accumulatedHandout = "";

    progress?.start(cleanedFiles.length, "Handout (incremental)");

    for (let i = 0; i < cleanedFiles.length; i++) {
      const file = cleanedFiles[i];
      const content = fs.readFileSync(path.join(cleanedDir, file), "utf-8");

      progress?.updateMessage(`Handout [${i + 1}/${cleanedFiles.length}] ${file}`);

      const previousExcerpt = accumulatedHandout.slice(-HandoutStep.PREVIOUS_HANDOUT_EXCERPT_CHARS).trim();
      const lastSection = this.extractLastSectionNumber(accumulatedHandout);
      const numberingHint =
        lastSection !== null
          ? `CONTINUATION: The previous handout ends at section ${lastSection}. Your new content MUST continue numbering from section ${lastSection + 1} (or extend section ${lastSection} if the new material belongs there). Never restart from 1.\n\n`
          : "";

      const userPrompt =
        accumulatedHandout === ""
          ? content
          : `${numberingHint}PREVIOUS HANDOUT (last portion only):\n\n${previousExcerpt}\n\n---\n\nNEW TRANSCRIPT TO INTEGRATE:\n\n${content}`;

      const result = await aiService.generateTextAsync({
        systemPrompt: aiOptions.systemPrompt,
        manualContextText: contextText || undefined,
        userPrompt,
        temperature: aiOptions.temperature,
      });

      accumulatedHandout =
        accumulatedHandout === ""
          ? result
          : accumulatedHandout + "\n\n" + result;
      progress?.increment();
    }

    progress?.stop();
    return accumulatedHandout;
  }
}
