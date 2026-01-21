import fs from "node:fs";
import path from "node:path";
import type { Logger } from "../logger.js";
import type { AsrService, AsrTranscribeOptions } from "./asr.types.js";

function buildQuery(opts: AsrTranscribeOptions): string {
  const q = new URLSearchParams();

  q.set("task", opts.task);
  q.set("output", opts.outputFormat);

  if (opts.language) q.set("language", opts.language);
  if (opts.temperature !== undefined) q.set("temperature", String(opts.temperature));
  if (opts.beamSize !== undefined) q.set("beam_size", String(opts.beamSize));
  if (opts.bestOf !== undefined) q.set("best_of", String(opts.bestOf));

  if (opts.vad?.enabled) {
    q.set("vad_filter", "true");
    if (opts.vad.threshold !== undefined) q.set("vad_threshold", String(opts.vad.threshold));
    if (opts.vad.minSilenceMs !== undefined)
      q.set("vad_min_silence_duration_ms", String(opts.vad.minSilenceMs));
    if (opts.vad.maxSpeechS !== undefined)
      q.set("vad_max_speech_duration_s", String(opts.vad.maxSpeechS));
  }

  return q.toString();
}

export class WhisperAsrService implements AsrService {
  private readonly serverUrl: string;
  private readonly logger: Logger;

  constructor(serverUrl: string, logger: Logger) {
    this.serverUrl = serverUrl;
    this.logger = logger.withContext({ service: "whisper-asr" });
  }

  async transcribeFileAsync(inputPath: string, opts: AsrTranscribeOptions): Promise<Buffer> {
    const fileName = path.basename(inputPath);
    const query = buildQuery(opts);
    const url = query ? `${this.serverUrl}?${query}` : this.serverUrl;

    const timeoutMs = opts.timeoutMs ?? 60 * 60 * 1000; // 1 hour default
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), timeoutMs);

    try {
      this.logger.debug(`POST ${url}`);
      this.logger.debug(`Uploading file: ${fileName}`);

      const form = new FormData();
      const fileBuffer = await fs.promises.readFile(inputPath);

      form.append("audio_file", new Blob([fileBuffer]), fileName);

      const res = await fetch(url, {
        method: "POST",
        body: form,
        signal: controller.signal,
      });

      if (!res.ok) {
        const body = await res.text().catch(() => "");
        throw new Error(
          `Whisper server error: HTTP ${res.status} ${res.statusText} | ${body}`.trim(),
        );
      }

      const arrayBuf = await res.arrayBuffer();
      return Buffer.from(arrayBuf);
    } catch (err) {
      if (err instanceof Error && err.name === "AbortError") {
        throw new Error(`Whisper request timed out after ${timeoutMs}ms for file: ${fileName}`);
      }
      throw err;
    } finally {
      clearTimeout(timeout);
    }
  }
}
