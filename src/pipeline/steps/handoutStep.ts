import fs from "node:fs";
import path from "node:path";
import type { Step, StepContext } from "../step.js";
import type { AiService, AiGenerateOptions, HandoutAiGenerateOptions } from "../../services/ai/ai.types.js";
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
import type { Logger } from "../../services/logger.js";
import type { ProgressReporter } from "../../services/progress.js";

const NEIGHBOR_EXCERPT_CHARS = 2000;

/** Appended to the handout system prompt for Stage-1 batch drafts. */
const HANDOUT_DRAFT_ADDENDUM = `

BATCH DRAFT MODE (ONE PART)
You are drafting ONE part of a larger multi-part handout. Produce structured notes for THIS part only. Do NOT write a global introduction or conclusion, and do NOT assume global section numbering — parts are merged and renumbered afterward. Never reproduce the neighbor excerpts. If no PRECEDING excerpt is provided, treat this as the FIRST part; if no FOLLOWING excerpt is provided, treat this as the LAST part.`;

/** Builds the Stage-2 sync merge system prompt, with the output-language instruction. */
export function buildHandoutMergePrompt(langCode: string): string {
  const code = (langCode ?? "en").trim().toLowerCase();
  const languageInstruction = `\n\nIMPORTANT: Output language is specified by ISO 639-1 two-letter code "${code}". All output must be written in that language. Write all content, including headings, annotations, and any text, exclusively in the language identified by code "${code}".`;
  return (
    `ROLE
You merge independently drafted parts of a multi-part academic handout into a single, unified document.

TASK
You receive several handout drafts (in order). Combine them into one coherent handout that reads as if written in a single pass.

RULES
- Unify the parts into one document; preserve ALL content (no omissions, no summaries).
- Apply a single, global, hierarchical numbered heading scheme, renumbering sections from 1.
- Remove duplicated material that appears across adjacent drafts.
- Smooth the transitions between parts so boundaries are invisible.
- Do NOT add a title, metadata, or table of contents (the header is added post-processing).
- Do NOT invent new content or commentary.

OUTPUT
Return ONLY the merged handout in Markdown.` + languageInstruction
  );
}

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

    const execution = resolveStepConfig(config, "handout").execution;
    const handout =
      execution === "batch"
        ? await this.generateHandoutMapReduce(
            config, aiService, aiOptions, cleanedFiles, outputDir, contextText, logger, progress,
          )
        : await this.generateHandoutIncremental(
            aiService, aiOptions, cleanedFiles, outputDir, contextText, logger, progress,
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

  private async generateHandoutMapReduce(
    config: StepContext["config"],
    aiService: AiService,
    aiOptions: Omit<HandoutAiGenerateOptions, "userPrompt">,
    cleanedFiles: string[],
    outputDir: string,
    contextText: string | undefined,
    logger: Logger,
    progress: ProgressReporter | undefined,
  ): Promise<string> {
    const cleanedDir = path.join(outputDir, "cleaned");
    const contents = cleanedFiles.map((f) => fs.readFileSync(path.join(cleanedDir, f), "utf-8"));
    const draftSystemPrompt = aiOptions.systemPrompt + HANDOUT_DRAFT_ADDENDUM;

    // Stage 1 (batch): one independent draft per part.
    const requests: BatchRequest[] = cleanedFiles.map((file, i) => {
      const base = path.parse(file).name;
      const previousChunkExcerpt =
        i > 0 ? contents[i - 1].slice(-NEIGHBOR_EXCERPT_CHARS).trim() || undefined : undefined;
      const nextChunkExcerpt =
        i < contents.length - 1
          ? contents[i + 1].slice(0, NEIGHBOR_EXCERPT_CHARS).trim() || undefined
          : undefined;
      return {
        customId: `handout::${base}`,
        options: {
          systemPrompt: draftSystemPrompt,
          manualContextText: contextText || undefined,
          previousChunkExcerpt,
          nextChunkExcerpt,
          userPrompt: contents[i],
          temperature: aiOptions.temperature,
        },
      };
    });

    const batchService = createBatchAiService(config, "handout");
    const { pollIntervalMs, maxWaitMs } = getBatchTuning(config);

    progress?.start(requests.length, "Handout drafts (batch)");
    const results = await runBatchStep({
      step: "handout",
      outputDir,
      batchService,
      requests,
      pollIntervalMs,
      maxWaitMs,
      logger,
      progress,
    });
    progress?.stop();

    // Order drafts by the numeric file order; fail loudly if any draft errored.
    const byId = new Map(results.map((r) => [r.customId, r]));
    const drafts: string[] = [];
    for (const file of cleanedFiles) {
      const base = path.parse(file).name;
      const r = byId.get(`handout::${base}`);
      if (!r || r.error || !r.text) {
        throw new Error(
          `Handout draft missing/failed for part '${base}'` +
            (r?.error ? `: ${r.error}` : "") + ". Re-run to retry.",
        );
      }
      drafts.push(r.text);
    }

    // Stage 2 (sync merge): single call using the shared aiService from runAsync.
    // v1 assumption: all concatenated drafts fit in one model context window;
    // a future size guard would mirror summaryStep chunking for very large sessions.
    const langCode = config.language?.output ?? "en";
    const merged = await aiService.generateTextAsync({
      systemPrompt: buildHandoutMergePrompt(langCode),
      manualContextText: contextText || undefined,
      userPrompt: drafts.map((d, i) => `--- DRAFT PART ${i + 1} ---\n\n${d}`).join("\n\n"),
      temperature: aiOptions.temperature,
    });

    return merged;
  }
}
