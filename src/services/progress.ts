export interface ProgressReporter {
  start(total: number, label?: string): void;
  increment(step?: number): void;
  updateMessage(message: string): void;
  stop(): void;
}
