import { describe, it, expect, beforeEach, jest } from "@jest/globals";

const mockExistsSync = jest.fn();
const mockReadFileSync = jest.fn();
const mockWriteFileSync = jest.fn();
const mockMkdirSync = jest.fn();

jest.unstable_mockModule("node:fs", () => ({
  default: {
    existsSync: mockExistsSync,
    readFileSync: mockReadFileSync,
    writeFileSync: mockWriteFileSync,
    mkdirSync: mockMkdirSync,
  },
  existsSync: mockExistsSync,
  readFileSync: mockReadFileSync,
  writeFileSync: mockWriteFileSync,
  mkdirSync: mockMkdirSync,
}));

describe("batchState", () => {
  let readBatchState: any, writeBatchJob: any, clearBatchJob: any;

  beforeEach(async () => {
    jest.clearAllMocks();
    const mod = await import("../../../src/services/batch/batchState.js");
    readBatchState = mod.readBatchState;
    writeBatchJob = mod.writeBatchJob;
    clearBatchJob = mod.clearBatchJob;
  });

  it("returns empty state when the file does not exist", () => {
    mockExistsSync.mockReturnValue(false);
    const state = readBatchState("/out");
    expect(state).toEqual({ version: 1, jobs: {} });
  });

  it("reads and parses an existing state file", () => {
    mockExistsSync.mockReturnValue(true);
    mockReadFileSync.mockReturnValue(
      JSON.stringify({ version: 1, jobs: { cleaning: { batchId: "batch_x", submittedAt: "t", customIds: ["cleaning::part-01"] } } }),
    );
    const state = readBatchState("/out");
    expect(state.jobs.cleaning.batchId).toBe("batch_x");
  });

  it("writeBatchJob creates .batch dir and persists the job", () => {
    mockExistsSync.mockReturnValue(false);
    writeBatchJob("/out", "cleaning", { batchId: "batch_x", submittedAt: "t", customIds: ["cleaning::part-01"] });
    expect(mockMkdirSync).toHaveBeenCalledWith(expect.stringContaining(".batch"), { recursive: true });
    const written = JSON.parse(mockWriteFileSync.mock.calls[0][1] as string);
    expect(written.jobs.cleaning.batchId).toBe("batch_x");
  });

  it("clearBatchJob removes the job and rewrites state", () => {
    mockExistsSync.mockReturnValue(true);
    mockReadFileSync.mockReturnValue(
      JSON.stringify({ version: 1, jobs: { cleaning: { batchId: "batch_x", submittedAt: "t", customIds: [] } } }),
    );
    clearBatchJob("/out", "cleaning");
    const written = JSON.parse(mockWriteFileSync.mock.calls[0][1] as string);
    expect(written.jobs.cleaning).toBeUndefined();
  });
});
