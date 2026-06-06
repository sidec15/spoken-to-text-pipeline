import { describe, it, expect, beforeEach, jest } from "@jest/globals";
import { createMockLogger } from "../../mocks/logger.mock.js";
import { createMockProgressReporter } from "../../mocks/progress.mock.js";
import type { BatchAiService } from "../../../src/services/ai/batch/batch.types.js";

const mockReadBatchState = jest.fn();
const mockWriteBatchJob = jest.fn();
const mockClearBatchJob = jest.fn();

jest.unstable_mockModule("../../../src/services/batch/batchState.js", () => ({
  readBatchState: mockReadBatchState,
  writeBatchJob: mockWriteBatchJob,
  clearBatchJob: mockClearBatchJob,
}));

function makeService(overrides: Partial<BatchAiService> = {}): BatchAiService {
  return {
    submit: jest.fn(async () => "batch_new"),
    poll: jest.fn(),
    collect: jest.fn(async () => [{ customId: "c::1", text: "OUT" }]),
    ...overrides,
  } as unknown as BatchAiService;
}

describe("runBatchStep", () => {
  let runBatchStep: any;

  beforeEach(async () => {
    jest.clearAllMocks();
    const mod = await import("../../../src/pipeline/batch/batchCoordinator.js");
    runBatchStep = mod.runBatchStep;
  });

  it("submits, persists state, watches to completion, then clears state", async () => {
    mockReadBatchState.mockReturnValue({ version: 1, jobs: {} });
    const service = makeService();
    (service.poll as ReturnType<typeof jest.fn>)
      .mockResolvedValueOnce({ status: "in_progress", requestCounts: { completed: 0, failed: 0, total: 1 } })
      .mockResolvedValueOnce({ status: "completed", requestCounts: { completed: 1, failed: 0, total: 1 } });

    const results = await runBatchStep({
      step: "cleaning",
      outputDir: "/out",
      batchService: service,
      requests: [{ customId: "c::1", options: { systemPrompt: "S", userPrompt: "A" } }],
      pollIntervalMs: 1,
      logger: createMockLogger(),
    });

    expect(service.submit).toHaveBeenCalledTimes(1);
    expect(mockWriteBatchJob).toHaveBeenCalledWith("/out", "cleaning", expect.objectContaining({ batchId: "batch_new" }));
    expect(service.collect).toHaveBeenCalledWith("batch_new");
    expect(mockClearBatchJob).toHaveBeenCalledWith("/out", "cleaning");
    expect(results).toEqual([{ customId: "c::1", text: "OUT" }]);
  });

  it("resumes a stored batchId instead of resubmitting", async () => {
    mockReadBatchState.mockReturnValue({
      version: 1,
      jobs: { cleaning: { batchId: "batch_stored", submittedAt: "t", customIds: ["c::1"] } },
    });
    const service = makeService();
    (service.poll as ReturnType<typeof jest.fn>)
      .mockResolvedValueOnce({ status: "completed", requestCounts: { completed: 1, failed: 0, total: 1 } });

    await runBatchStep({
      step: "cleaning",
      outputDir: "/out",
      batchService: service,
      requests: [{ customId: "c::1", options: { systemPrompt: "S", userPrompt: "A" } }],
      pollIntervalMs: 1,
      logger: createMockLogger(),
    });

    expect(service.submit).not.toHaveBeenCalled();
    expect(service.collect).toHaveBeenCalledWith("batch_stored");
  });

  it("resumes a stored batchId, polls multiple times, then collects", async () => {
    mockReadBatchState.mockReturnValue({
      version: 1,
      jobs: { cleaning: { batchId: "batch_stored", submittedAt: "t", customIds: ["c::1"] } },
    });
    const service = makeService();
    (service.poll as ReturnType<typeof jest.fn>)
      .mockResolvedValueOnce({ status: "in_progress", requestCounts: { completed: 0, failed: 0, total: 1 } })
      .mockResolvedValueOnce({ status: "completed", requestCounts: { completed: 1, failed: 0, total: 1 } });

    const results = await runBatchStep({
      step: "cleaning",
      outputDir: "/out",
      batchService: service,
      requests: [{ customId: "c::1", options: { systemPrompt: "S", userPrompt: "A" } }],
      pollIntervalMs: 1,
      logger: createMockLogger(),
      sleep: async () => {},
    });

    expect(service.submit).not.toHaveBeenCalled();
    expect(service.collect).toHaveBeenCalledWith("batch_stored");
    expect(results).toEqual([{ customId: "c::1", text: "OUT" }]);
  });

  it("clears state and throws on terminal failure", async () => {
    mockReadBatchState.mockReturnValue({ version: 1, jobs: {} });
    const service = makeService();
    (service.poll as ReturnType<typeof jest.fn>)
      .mockResolvedValueOnce({ status: "failed", requestCounts: { completed: 0, failed: 1, total: 1 } });

    let caughtError: Error | undefined;
    try {
      await runBatchStep({
        step: "cleaning",
        outputDir: "/out",
        batchService: service,
        requests: [{ customId: "c::1", options: { systemPrompt: "S", userPrompt: "A" } }],
        pollIntervalMs: 1,
        logger: createMockLogger(),
      });
    } catch (e) {
      caughtError = e as Error;
    }

    expect(caughtError).toBeDefined();
    expect(caughtError!.message).toMatch(/batchId=batch_new/);
    expect(caughtError!.message).toMatch(/re-run to resubmit/i);
    expect(mockClearBatchJob).toHaveBeenCalledWith("/out", "cleaning");
  });

  it("leaves state and throws when maxWaitMs is exceeded", async () => {
    mockReadBatchState.mockReturnValue({ version: 1, jobs: {} });
    const service = makeService();
    (service.poll as ReturnType<typeof jest.fn>)
      .mockResolvedValue({ status: "in_progress", requestCounts: { completed: 0, failed: 0, total: 1 } });

    await expect(
      runBatchStep({
        step: "cleaning",
        outputDir: "/out",
        batchService: service,
        requests: [{ customId: "c::1", options: { systemPrompt: "S", userPrompt: "A" } }],
        pollIntervalMs: 1,
        maxWaitMs: 0,
        logger: createMockLogger(),
      }),
    ).rejects.toThrow(/re-run to resume/);
    expect(mockClearBatchJob).not.toHaveBeenCalled();
  });

  it("deduplicates progress messages for identical poll counts", async () => {
    mockReadBatchState.mockReturnValue({ version: 1, jobs: {} });
    const service = makeService();
    // Same counts twice, then completed
    (service.poll as ReturnType<typeof jest.fn>)
      .mockResolvedValueOnce({ status: "in_progress", requestCounts: { completed: 0, failed: 0, total: 2 } })
      .mockResolvedValueOnce({ status: "in_progress", requestCounts: { completed: 0, failed: 0, total: 2 } })
      .mockResolvedValueOnce({ status: "completed", requestCounts: { completed: 2, failed: 0, total: 2 } });

    const progress = createMockProgressReporter();

    await runBatchStep({
      step: "cleaning",
      outputDir: "/out",
      batchService: service,
      requests: [
        { customId: "c::1", options: { systemPrompt: "S", userPrompt: "A" } },
        { customId: "c::2", options: { systemPrompt: "S", userPrompt: "B" } },
      ],
      pollIntervalMs: 1,
      logger: createMockLogger(),
      progress,
      sleep: async () => {},
    });

    const updateMessage = progress.updateMessage as ReturnType<typeof jest.fn>;
    // Called at least once (for the first in_progress) but not once per poll
    // (the duplicate in_progress should be suppressed)
    expect(updateMessage).toHaveBeenCalled();
    // Three polls but only two distinct messages (in_progress + completed-check
    // doesn't call updateMessage since completed exits before the progress block
    // on most implementations). The key assertion: not called 3 times for 3 polls.
    expect(updateMessage.mock.calls.length).toBeLessThan(3);
  });
});
