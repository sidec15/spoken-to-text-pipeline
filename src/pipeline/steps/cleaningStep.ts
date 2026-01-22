import fs from "node:fs";
import path from "node:path";
import type { Step, StepContext } from "../step.js";
import { OpenAiService } from "../../services/ai/openai/openaiAiService.js";
import { loadContextText } from "../../utils/loadContextText.js";
import { resolveOpenAiConfig } from "../../services/ai/openai/resolveOpenAiConfig.js";

export class CleaningStep implements Step {
  readonly name = "cleaning";

  async runAsync(ctx: StepContext): Promise<void> {
    const { config, logger, progress } = ctx;

    logger.info("Starting Cleaning step");

    const inputDir = config.paths.rawOutputDir;
    const outputDir = config.paths.cleanOutputDir;

    fs.mkdirSync(outputDir, { recursive: true });

    const rawFiles = fs.readdirSync(inputDir).filter((f) => f.endsWith(".txt"));

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

    const aiOptions = resolveOpenAiConfig(config, "cleaning");

    const aiService =
      config.ai.provider === "openai" && "openai" in config.ai.config
        ? new OpenAiService(config.ai.config.openai.apiKey, config.ai.config.openai.model)
        : (() => {
            throw new Error("Unsupported AI provider");
          })();

    const contextText = loadContextText(config.context?.textSources);

    progress?.start(filesToProcess.length, "Cleaning transcripts");

    for (const file of filesToProcess) {
      const base = path.parse(file).name;
      const inputPath = path.join(inputDir, file);
      const outputPath = path.join(outputDir, `${base}.md`);

      const fileLogger = logger.withContext({ file });

      const rawText = fs.readFileSync(inputPath, "utf-8");

      const userPrompt = `
Context:
${contextText}

Transcript:
${rawText}
      `.trim();

      // Estimate maxTokens based on input length
      // Rough estimate: 1 token ≈ 4 characters
      // For cleaning, output is typically similar to input, but let consider double the input length
      const estimatedInputTokens = Math.ceil(rawText.length / 4);
      const calculatedMaxTokens = Math.ceil(estimatedInputTokens * 2);
      const maxTokens = aiOptions.maxTokens ?? calculatedMaxTokens; // Use override if provided, otherwise calculated

      const cleaned = await aiService.generateTextAsync({
        ...aiOptions,
        userPrompt,
        maxTokens,
      });

      await fs.promises.writeFile(outputPath, cleaned, "utf-8");

      fileLogger.info(`Cleaned transcript saved to '${outputPath}'`);
      progress?.increment();
    }

    progress?.stop();
    logger.info("Cleaning step completed");
  }
}
