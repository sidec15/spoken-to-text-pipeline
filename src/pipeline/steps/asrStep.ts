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
  readonly mergedFileName = "raw-transcripts.txt";

  async runAsync(ctx: StepContext): Promise<void> {
    const { config, baseDir, logger, progress } = ctx;

    const inputDir = this.resolveInputDir(config.paths?.inputDir ?? "", baseDir);
    const outputDir = ctx.outputDir;
    const transcriptsDir = path.join(outputDir, "transcripts");

    logger.info("Starting ASR step");
    logger.debug(`Audio input dir: ${inputDir}`);
    logger.debug(`Output dir: ${outputDir}`);

    fs.mkdirSync(transcriptsDir, { recursive: true });

    const audioFiles = this.getAudioFiles(inputDir);
    if (audioFiles.length === 0) {
      logger.warn("No audio files found, skipping ASR step");
      return;
    }

    const filesToProcess = this.getFilesToProcess(audioFiles, transcriptsDir);
    const aiServiceForLabel = this.createAiServiceForLabelIfNeeded(config);

    if (filesToProcess.length > 0) {
      await this.transcribePendingFiles(
        inputDir,
        transcriptsDir,
        audioFiles,
        filesToProcess,
        config,
        aiServiceForLabel,
        logger,
        progress,
      );
    } else {
      logger.info("All audio files already transcribed, skipping transcription");
    }

    // Merge into general output dir root (not inside transcripts/ or cleaned/)
    await this.mergeTranscripts(
      transcriptsDir,
      outputDir,
      config,
      aiServiceForLabel,
      logger,
    );

    logger.debug("ASR step completed");
  }

  private resolveInputDir(inputDirRaw: string, baseDir?: string): string {
    if (inputDirRaw === "") {
      throw new Error("Input directory is not set");
    }
    const resolvedBaseDir = baseDir ?? process.cwd();
    return path.isAbsolute(inputDirRaw)
      ? inputDirRaw
      : path.resolve(resolvedBaseDir, inputDirRaw);
  }

  private getAudioFiles(inputDir: string): string[] {
    return fs
      .readdirSync(inputDir)
      .filter((f) => {
        const ext = path.extname(f).toLowerCase();
        return ext === ".wav" || ext === ".mp3";
      });
  }

  private getFilesToProcess(
    audioFiles: string[],
    transcriptsDir: string,
  ): string[] {
    return audioFiles.filter((file) => {
      const base = path.parse(file).name;
      const outputFile = path.join(transcriptsDir, `${base}.txt`);
      return !fs.existsSync(outputFile);
    });
  }

  private createAiServiceForLabelIfNeeded(
    config: StepContext["config"],
  ): AiService | undefined {
    const outputLang = (config.language?.output ?? "en").toLowerCase().trim();
    if (outputLang === "en" || outputLang === "english") {
      return undefined;
    }
    try {
      return createAiService(config, "cleaning");
    } catch {
      return undefined;
    }
  }

  private async transcribePendingFiles(
    inputDir: string,
    transcriptsDir: string,
    audioFiles: string[],
    filesToProcess: string[],
    config: StepContext["config"],
    aiServiceForLabel: AiService | undefined,
    logger: StepContext["logger"],
    progress: ProgressReporter | undefined,
  ): Promise<void> {
    const whisperConfig = resolveWhisperConfig(config);

    logger.info(
      `Found ${audioFiles.length} audio files, ${filesToProcess.length} to transcribe`,
    );
    progress?.start(filesToProcess.length, "Transcribing audio");

    for (let i = 0; i < filesToProcess.length; i++) {
      const file = filesToProcess[i];
      const base = path.parse(file).name;
      const inputPath = path.join(inputDir, file);
      const outputPath = path.join(transcriptsDir, `${base}.txt`);

      await this.transcribeFileAsync(
        inputPath,
        outputPath,
        whisperConfig,
        config,
        i === 0,
        aiServiceForLabel,
        logger.withContext({ file }),
        progress,
      );

      progress?.increment();
    }

    progress?.stop();
  }

  private async mergeTranscripts(
    transcriptsDir: string,
    generalOutputDir: string,
    config: StepContext["config"],
    aiServiceForLabel: AiService | undefined,
    logger: StepContext["logger"],
  ): Promise<void> {
    const transcriptFiles = this.getSortedTranscriptFiles(transcriptsDir);
    if (transcriptFiles.length === 0) {
      return;
    }

    const stepLabel = await getLocalizedStepLabelForAsr(
      config,
      aiServiceForLabel,
    );
    const header = buildMetadataHeader(config, stepLabel);
    const parts = transcriptFiles.map((file) => {
      const filePath = path.join(transcriptsDir, file);
      const content = fs.readFileSync(filePath, "utf-8");
      return this.stripMetadataHeader(content).trim();
    });

    // Write merged file to general output dir root (alongside handout.md), not inside transcripts/
    const mergedPath = path.join(generalOutputDir, this.mergedFileName);
    const mergedContent = header + "\n\n" + parts.join("\n\n");
    await fs.promises.writeFile(mergedPath, mergedContent, "utf-8");
    logger.info(`Merged transcripts saved to '${mergedPath}'`);
  }

  private getSortedTranscriptFiles(transcriptsDir: string): string[] {
    return fs
      .readdirSync(transcriptsDir)
      .filter((f) => f.endsWith(".txt"))
      .sort((a, b) => a.localeCompare(b, undefined, { numeric: true }));
  }

  private stripMetadataHeader(content: string): string {
    const headerMatch = content.match(/^[\s\S]*?\*\*\*[^*]+\*\*\*\s*\n\n/);
    return headerMatch ? content.slice(headerMatch[0].length) : content;
  }

  private async transcribeFileAsync(
    inputPath: string,
    outputPath: string,
    whisperConfig: ReturnType<typeof resolveWhisperConfig>,
    config: StepContext["config"],
    isFirstFile: boolean,
    aiServiceForLabel: AiService | undefined,
    logger: StepContext["logger"],
    progress: ProgressReporter | undefined,
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
