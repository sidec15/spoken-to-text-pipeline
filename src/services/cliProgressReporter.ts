import type { ProgressReporter } from "./progress.js";

export interface CliProgressReporterOptions {
  /** Output stream for progress lines. Defaults to `process.stdout`. */
  out?: { write(chunk: string): boolean };
}

/**
 * Progress reporter that emits plain, newline-terminated lines.
 *
 * A live in-place progress bar was intentionally removed. `cli-progress` writes
 * to `process.stderr` while the logger writes to `process.stdout`; on a shared
 * terminal (and with TTY detection that varies across mintty/tmux/winpty) the
 * two streams collided and could not be coordinated, garbling the output. Plain
 * lines on the same stream as the logs are deterministic everywhere and never
 * interleave badly. Progress detail (e.g. batch counts) is carried in the
 * messages passed to {@link updateMessage}.
 */
export class CliProgressReporter implements ProgressReporter {
  private total = 0;
  private value = 0;
  private readonly out: { write(chunk: string): boolean };

  constructor(options: CliProgressReporterOptions = {}) {
    this.out = options.out ?? process.stdout;
  }

  start(total: number, label?: string): void {
    this.total = total;
    this.value = 1;
    if (label) {
      this.out.write(`${label}\n`);
    }
  }

  increment(step = 1): void {
    this.value += step;
  }

  updateMessage(message: string): void {
    // Append a running count only once increments have happened (per-file sync
    // path); in batch mode the value stays 0 and the message already carries
    // the real counts, so the suffix would be redundant.
    const suffix = this.value > 0 && this.total > 0 ? ` (${this.value}/${this.total})` : "";
    this.out.write(`${message}${suffix}\n`);
  }

  stop(): void {
    // No live bar to tear down.
  }
}
