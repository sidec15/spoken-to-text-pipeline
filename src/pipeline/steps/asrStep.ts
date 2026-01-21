import fs from "node:fs";
import path from "node:path";
import type { Step, StepContext } from "../step.js";
import { WhisperAsrService } from "../../services/asr/whisperAsrService.js";

export class AsrStep implements Step {
  readonly name = "asr";

  async runAsync(ctx: StepContext): Promise<void> {
    const { config, logger, progress } = ctx;

    const inputDir = config.paths.audioInputDir;
    const outputDir = config.paths.rawOutputDir;

    logger.info("Starting ASR step");
    logger.debug(`Audio input dir: ${inputDir}`);
    logger.debug(`Raw output dir: ${outputDir}`);

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

    const asr = new WhisperAsrService(config.asr.whisper.serverUrl, logger);

    progress?.start(filesToProcess.length, "Transcribing audio");

    for (const file of filesToProcess) {
      const base = path.parse(file).name;
      const inputPath = path.join(inputDir, file);
      const outputPath = path.join(outputDir, `${base}.txt`);

      const fileLogger = logger.withContext({ file });

      await this.transcribeFileAsync(inputPath, outputPath, config, fileLogger);

      progress?.increment();
    }

    progress?.stop();

    logger.debug("ASR step completed");
  }

  private async transcribeFileAsync(
    inputPath: string,
    outputPath: string,
    config: StepContext["config"],
    logger: StepContext["logger"],
  ): Promise<void> {
    // Placeholder: real implementation will call Whisper
    logger.silly(`(mock) Transcribing ${inputPath} → ${outputPath}`);

    // add a random delay between 1 and 3 seconds
    await new Promise((resolve) => setTimeout(resolve, Math.random() * 2000 + 1000));

    // TEMPORARY mock to demonstrate idempotency
    await fs.promises.writeFile(
      outputPath,
      `TRANSCRIPTION PLACEHOLDER for ${path.basename(inputPath)}`,
      "utf-8",
    );
  }
}
