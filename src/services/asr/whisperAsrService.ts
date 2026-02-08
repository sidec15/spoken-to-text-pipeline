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
      this.logger.silly(`POST ${url}`);
      this.logger.silly(`Uploading file: ${fileName}`);

      const form = new FormData();
      const fileBuffer = await fs.promises.readFile(inputPath);

      // FormData in Node.js 18+ accepts Blob or File
      // Convert Buffer to Blob for FormData compatibility
      const blob = new Blob([fileBuffer], { type: "audio/wav" });
      form.append("audio_file", blob, fileName);

      this.logger.debug(`File size: ${fileBuffer.length} bytes`);

      let res: Response;
      try {
        res = await fetch(url, {
          method: "POST",
          body: form,
          signal: controller.signal,
        });
      } catch (fetchErr) {
        // Check if this is an abort/timeout error
        if (fetchErr instanceof Error && fetchErr.name === "AbortError") {
          throw new Error(`Whisper request timed out after ${timeoutMs}ms for file: ${fileName}`);
        }
        const errorMessage = fetchErr instanceof Error ? fetchErr.message : String(fetchErr);
        const errorName = fetchErr instanceof Error ? fetchErr.name : "UnknownError";
        this.logger.error(`Fetch request failed: ${errorName} - ${errorMessage}`);
        throw new Error(
          `Failed to connect to Whisper server for file '${fileName}': ${errorMessage}. ` +
          `URL: ${url}. ` +
          `This may indicate a network issue, server unavailability, or connection timeout.`
        );
      }

      if (!res.ok) {
        const body = await res.text().catch(() => "");
        throw new Error(
          `Whisper server error: HTTP ${res.status} ${res.statusText} | ${body}`.trim(),
        );
      }

      // Log response details for debugging
      this.logger.debug(`Response status: ${res.status} ${res.statusText}`);
      if (res.headers) {
        this.logger.debug(`Response content-type: ${res.headers.get("content-type") || "unknown"}`);
        this.logger.debug(`Response content-length: ${res.headers.get("content-length") || "unknown"}`);
      }

      let arrayBuf: ArrayBuffer;
      try {
        arrayBuf = await res.arrayBuffer();
      } catch (err) {
        const errorMessage = err instanceof Error ? err.message : String(err);
        this.logger.error(`Failed to read response body: ${errorMessage}`);
        throw new Error(
          `Failed to read Whisper response body for file '${fileName}': ${errorMessage}. ` +
          `Response status was ${res.status} ${res.statusText}. ` +
          `This may indicate a network issue or that the server closed the connection prematurely.`
        );
      }

      if (arrayBuf.byteLength === 0) {
        throw new Error(
          `Whisper server returned empty response for file '${fileName}'. ` +
          `Response status was ${res.status} ${res.statusText}.`
        );
      }

      this.logger.debug(`Received ${arrayBuf.byteLength} bytes from Whisper server`);
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
