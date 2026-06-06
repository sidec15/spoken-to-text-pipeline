import { describe, it, expect, beforeEach, jest } from "@jest/globals";

const mockReadBatchState = jest.fn();
const mockWriteBatchJob = jest.fn();
const mockClearBatchJob = jest.fn();

jest.unstable_mockModule("../../../src/services/batch/batchState.js", () => ({
  readBatchState: mockReadBatchState,
  writeBatchJob: mockWriteBatchJob,
  clearBatchJob: mockClearBatchJob,
}));

const logger = { info: jest.fn(), warn: jest.fn(), error: jest.fn(), debug: jest.fn(), silly: jest.fn() } as any;

function makeService(overrides: any = {}) {
  return {
    submit: jest.fn(async () => "batch_new"),
    poll: jest.fn(),
    collect: jest.fn(async () => [{ customId: "c::1", text: "OUT" }]),
    ...overrides,
  };
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
    service.poll
      .mockResolvedValueOnce({ status: "in_progress", requestCounts: { completed: 0, failed: 0, total: 1 } })
      .mockResolvedValueOnce({ status: "completed", requestCounts: { completed: 1, failed: 0, total: 1 } });

    const results = await runBatchStep({
      step: "cleaning",
      outputDir: "/out",
      batchService: service,
      requests: [{ customId: "c::1", options: { systemPrompt: "S", userPrompt: "A" } }],
      pollIntervalMs: 1,
      logger,
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
    service.poll.mockResolvedValueOnce({ status: "completed", requestCounts: { completed: 1, failed: 0, total: 1 } });

    await runBatchStep({
      step: "cleaning",
      outputDir: "/out",
      batchService: service,
      requests: [{ customId: "c::1", options: { systemPrompt: "S", userPrompt: "A" } }],
      pollIntervalMs: 1,
      logger,
    });

    expect(service.submit).not.toHaveBeenCalled();
    expect(service.collect).toHaveBeenCalledWith("batch_stored");
  });

  it("clears state and throws on terminal failure", async () => {
    mockReadBatchState.mockReturnValue({ version: 1, jobs: {} });
    const service = makeService();
    service.poll.mockResolvedValueOnce({ status: "failed", requestCounts: { completed: 0, failed: 1, total: 1 } });

    await expect(
      runBatchStep({
        step: "cleaning",
        outputDir: "/out",
        batchService: service,
        requests: [{ customId: "c::1", options: { systemPrompt: "S", userPrompt: "A" } }],
        pollIntervalMs: 1,
        logger,
      }),
    ).rejects.toThrow(/failed/);
    expect(mockClearBatchJob).toHaveBeenCalledWith("/out", "cleaning");
  });

  it("leaves state and throws when maxWaitMs is exceeded", async () => {
    mockReadBatchState.mockReturnValue({ version: 1, jobs: {} });
    const service = makeService();
    service.poll.mockResolvedValue({ status: "in_progress", requestCounts: { completed: 0, failed: 0, total: 1 } });

    await expect(
      runBatchStep({
        step: "cleaning",
        outputDir: "/out",
        batchService: service,
        requests: [{ customId: "c::1", options: { systemPrompt: "S", userPrompt: "A" } }],
        pollIntervalMs: 1,
        maxWaitMs: 0,
        logger,
      }),
    ).rejects.toThrow(/re-run to resume/);
    expect(mockClearBatchJob).not.toHaveBeenCalled();
  });
});
