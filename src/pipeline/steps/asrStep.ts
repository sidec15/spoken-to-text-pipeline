import fs from "node:fs";
import path from "node:path";
import type { Step, StepContext } from "../step.js";
import {
  buildMetadataHeader,
  createAiService,
  getLocalizedStepLabelForAsr,
} from "../../services/ai/aiServiceFactory.js";
import type { AiService } from "../../services/ai/ai.types.js";
import { WhisperAsrService } from "../../services/asr/whisperAsrService.js";
import { resolveWhisperConfig } from "../../services/asr/resolveWhisperConfig.js";
import type { ProgressReporter } from "../../types.js";

export class AsrStep implements Step {
  readonly name = "asr";

  async runAsync(ctx: StepContext): Promise<void> {
    const { config, baseDir, logger, progress } = ctx;

    const inputDirRaw = config.paths?.inputDir ?? "";
    if (inputDirRaw === "") {
      throw new Error("Input directory is not set");
    }
    // Resolve inputDir relative to baseDir if provided, otherwise relative to process.cwd()
    const resolvedBaseDir = baseDir ?? process.cwd();
    const inputDir = path.isAbsolute(inputDirRaw) ? inputDirRaw : path.resolve(resolvedBaseDir, inputDirRaw);
    
    const outputDir = ctx.outputDir;

    logger.info("Starting ASR step");
    logger.debug(`Audio input dir: ${inputDir}`);
    logger.debug(`Output dir: ${outputDir}`);

    fs.mkdirSync(outputDir, { recursive: true });
    const transcriptsDir = path.join(outputDir, "transcripts");
    fs.mkdirSync(transcriptsDir, { recursive: true });

    const audioFiles = fs.readdirSync(inputDir).filter((f) => f.toLowerCase().endsWith(".wav"));

    if (audioFiles.length === 0) {
      logger.warn("No audio files found, skipping ASR step");
      return;
    }

    const filesToProcess = audioFiles.filter((file) => {
      const base = path.parse(file).name;
      const outputFile = path.join(transcriptsDir, `${base}.txt`);
      return !fs.existsSync(outputFile);
    });

    if (filesToProcess.length === 0) {
      logger.info("All audio files already transcribed, skipping ASR step");
      return;
    }

    logger.info(`Found ${audioFiles.length} audio files, ${filesToProcess.length} to transcribe`);

    // Validate Whisper config (will throw if serverUrl is missing)
    // Only called when there are files to process, not when step is skipped
    const whisperConfig = resolveWhisperConfig(config);

    // Create AI service only when needed for label localization (non-English output)
    const outputLang = (config.language?.output ?? "en").toLowerCase().trim();
    const needsAiForLabel = outputLang !== "en" && outputLang !== "english";
    let aiServiceForLabel: AiService | undefined;
    if (needsAiForLabel) {
      try {
        aiServiceForLabel = createAiService(config, "cleaning");
      } catch {
        // No AI config; will fall back to English label
      }
    }

    progress?.start(filesToProcess.length, "Transcribing audio");

    for (let i = 0; i < filesToProcess.length; i++) {
      const file = filesToProcess[i];
      const base = path.parse(file).name;
      const inputPath = path.join(inputDir, file);
      const outputPath = path.join(transcriptsDir, `${base}.txt`);
      const isFirstFile = i === 0;

      const fileLogger = logger.withContext({ file });

      await this.transcribeFileAsync(
        inputPath,
        outputPath,
        whisperConfig,
        config,
        isFirstFile,
        aiServiceForLabel,
        fileLogger,
        progress,
      );

      progress?.increment();
    }

    progress?.stop();

    logger.debug("ASR step completed");
  }

  private async transcribeFileAsync(
    inputPath: string,
    outputPath: string,
    whisperConfig: ReturnType<typeof resolveWhisperConfig>,
    config: StepContext["config"],
    isFirstFile: boolean,
    aiServiceForLabel: AiService | undefined,
    logger: StepContext["logger"],
    progress: ProgressReporter,
  ): Promise<void> {
    const inputFileName = path.basename(inputPath);

    logger.silly(`Transcribing '${inputFileName}'`);
    progress?.updateMessage(`Transcribing '${inputFileName}'`);

    const asrService = new WhisperAsrService(whisperConfig.serverUrl, logger);

    const transcriptionBuffer = await asrService.transcribeFileAsync(
      inputPath,
      whisperConfig.options,
    );

    const text = transcriptionBuffer.toString("utf-8");
    let contentToWrite = text;
    if (isFirstFile) {
      const stepLabel = await getLocalizedStepLabelForAsr(config, aiServiceForLabel);
      const header = buildMetadataHeader(config, stepLabel);
      contentToWrite = header + "\n\n" + text;
    }

    await fs.promises.writeFile(outputPath, contentToWrite, "utf-8");

    logger.silly(`Transcription saved to '${outputPath}'`);
  }
}
