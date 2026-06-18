import fs from "node:fs";
import path from "node:path";
import { Agent } from "undici";
import type { Logger } from "../logger.js";
import type { AsrService, AsrTranscribeOptions } from "./asr.types.js";

// Undici defaults: bodyTimeout 300s — client closes while waiting for long transcriptions.
// Use a dispatcher with bodyTimeout disabled so we only abort via our own timeout.
const LONG_REQUEST_DISPATCHER = new Agent({
  bodyTimeout: 0,
  headersTimeout: 0,
});

function getErrCode(err: unknown): string | undefined {
  if (err instanceof Error && "code" in err) return (err as NodeJS.ErrnoException).code;
  if (err instanceof Error && err.cause instanceof Error && "code" in err.cause)
    return (err.cause as NodeJS.ErrnoException).code;
  return undefined;
}

function getAudioMimeType(fileName: string): string {
  const ext = path.extname(fileName).toLowerCase();
  switch (ext) {
    case ".mp3":
      return "audio/mpeg";
    case ".wav":
    default:
      return "audio/wav";
  }
}

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

      const fileBuffer = await fs.promises.readFile(inputPath);
      this.logger.debug(`File size: ${fileBuffer.length} bytes`);

      const form = new FormData();
      const blob = new Blob([fileBuffer], { type: getAudioMimeType(fileName) });
      form.append("audio_file", blob, fileName);

      let res: Response;
      try {
        res = await fetch(url, {
          method: "POST",
          body: form,
          signal: controller.signal,
          // @ts-expect-error Node fetch accepts undici dispatcher
          dispatcher: LONG_REQUEST_DISPATCHER,
        });
      } catch (fetchErr) {
        if (fetchErr instanceof Error && fetchErr.name === "AbortError") {
          throw new Error(`Whisper request timed out after ${timeoutMs}ms for file: ${fileName}`);
        }
        const code = getErrCode(fetchErr);
        const errorMessage = fetchErr instanceof Error ? fetchErr.message : String(fetchErr);
        this.logger.error(`Fetch failed: ${errorMessage}${code ? ` [${code}]` : ""}`);
        const hint =
          code === "ECONNRESET"
            ? " Client or proxy may have closed the connection while waiting (e.g. bodyTimeout)."
            : "";
        throw new Error(
          `Failed to connect to Whisper server for file '${fileName}': ${errorMessage}. ` +
            `URL: ${url}.${code ? ` Code: ${code}.` : ""}${hint}`
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
