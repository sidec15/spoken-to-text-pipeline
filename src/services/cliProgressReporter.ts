import cliProgress from "cli-progress";
import type { ProgressReporter } from "./progress.js";

export class CliProgressReporter implements ProgressReporter {
  private bar?: cliProgress.SingleBar;

  start(total: number, label?: string): void {
    this.bar = new cliProgress.SingleBar(
      {
        format: `${label ?? "Progress"} |{bar}| {value}/{total} - {percentage}%`,
        clearOnComplete: true,
      },
      cliProgress.Presets.shades_classic,
    );

    this.bar.start(total, 0);
  }

  increment(step = 1): void {
    this.bar?.increment(step);
  }

  stop(): void {
    this.bar?.stop();
  }
}
