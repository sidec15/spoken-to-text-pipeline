export interface ProgressReporter {
  start(total: number, label?: string): void;
  increment(step?: number): void;
  stop(): void;
}
