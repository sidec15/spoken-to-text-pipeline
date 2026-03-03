import cliProgress from "cli-progress";
import type { ProgressReporter } from "./progress.js";

export class CliProgressReporter implements ProgressReporter {
  private bar?: cliProgress.SingleBar;
  private currentMessage: string = "Progress";

  start(total: number, label?: string): void {
    this.currentMessage = label ?? "Progress";
    this.bar = new cliProgress.SingleBar(
      {
        format: (_options, params) => {
          const percentage = Math.round((params.value / params.total) * 100);
          const bar = "█".repeat(Math.floor((params.value / params.total) * 20)).padEnd(20, "░");
          return `|${bar}| ${params.value}/${params.total} ${percentage}% · ${this.currentMessage}`;
        },
        clearOnComplete: true,
        linewrap: false,
      },
      cliProgress.Presets.shades_classic,
    );

    this.bar.start(total, 0);
  }

  increment(step = 1): void {
    this.bar?.increment(step);
  }

  updateMessage(message: string): void {
    this.currentMessage = message;
    // Trigger a redraw by updating with current value
    if (this.bar) {
      const current = (this.bar as any).value || 0;
      this.bar.update(current);
    }
  }

  stop(): void {
    this.bar?.stop();
  }
}
