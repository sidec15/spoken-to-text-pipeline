import fs from "node:fs";
import path from "node:path";
import type { Step, StepContext } from "../step.js";
import { WhisperAsrService } from "../../services/asr/whisperAsrService.js";
import { resolveWhisperConfig } from "../../services/asr/resolveWhisperConfig.js";
import { resolveOutputDir } from "../../utils/resolveOutputDir.js";
import type { ProgressReporter } from "../../types.js";

export class AsrStep implements Step {
  readonly name = "asr";

  async runAsync(ctx: StepContext): Promise<void> {
    const { config, logger, progress } = ctx;

    const inputDir = config.paths?.inputDir ?? "";
    if (inputDir === "") {
      throw new Error("Input directory is not set");
    }
    const outputDir = resolveOutputDir(config);
    if (outputDir === "") {
      throw new Error("Output directory is not set");
    }

    logger.info("Starting ASR step");
    logger.debug(`Audio input dir: ${inputDir}`);
    logger.debug(`Output dir: ${outputDir}`);

    fs.mkdirSync(outputDir, { recursive: true });

    const audioFiles = fs.readdirSync(inputDir).filter((f) => f.toLowerCase().endsWith(".wav"));

    if (audioFiles.length === 0) {
      logger.warn("No audio files found, skipping ASR step");
      return;
    }

    const filesToProcess = audioFiles.filter((file) => {
      const base = path.parse(file).name;
      const outputFile = path.join(outputDir, `${base}.txt`);
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

    progress?.start(filesToProcess.length, "Transcribing audio");

    for (const file of filesToProcess) {
      const base = path.parse(file).name;
      const inputPath = path.join(inputDir, file);
      const outputPath = path.join(outputDir, `${base}.txt`);

      const fileLogger = logger.withContext({ file });

      await this.transcribeFileAsync(inputPath, outputPath, whisperConfig, fileLogger, progress);

      progress?.increment();
    }

    progress?.stop();

    logger.debug("ASR step completed");
  }

  private async transcribeFileAsync(
    inputPath: string,
    outputPath: string,
    whisperConfig: ReturnType<typeof resolveWhisperConfig>,
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

    await fs.promises.writeFile(outputPath, transcriptionBuffer);

    logger.silly(`Transcription saved to '${outputPath}'`);
  }
}
