import { describe, it, expect, beforeEach, jest } from "@jest/globals";
import path from "node:path";

const mockExistsSync = jest.fn();
const mockReadFileSync = jest.fn();
const mockWriteFileSync = jest.fn();
const mockMkdirSync = jest.fn();
const mockRmSync = jest.fn();

jest.unstable_mockModule("node:fs", () => ({
  default: {
    existsSync: mockExistsSync,
    readFileSync: mockReadFileSync,
    writeFileSync: mockWriteFileSync,
    mkdirSync: mockMkdirSync,
    rmSync: mockRmSync,
  },
  existsSync: mockExistsSync,
  readFileSync: mockReadFileSync,
  writeFileSync: mockWriteFileSync,
  mkdirSync: mockMkdirSync,
  rmSync: mockRmSync,
}));

describe("batchState", () => {
  let readBatchJob: any, writeBatchJob: any, clearBatchJob: any;

  beforeEach(async () => {
    jest.clearAllMocks();
    const mod = await import("../../../src/services/batch/batchState.js");
    readBatchJob = mod.readBatchJob;
    writeBatchJob = mod.writeBatchJob;
    clearBatchJob = mod.clearBatchJob;
  });

  it("returns undefined when the step's state file does not exist", () => {
    mockExistsSync.mockReturnValue(false);
    expect(readBatchJob("/out", "cleaning")).toBeUndefined();
  });

  it("reads the step's job from its own file", () => {
    mockExistsSync.mockReturnValue(true);
    mockReadFileSync.mockReturnValue(
      JSON.stringify({ version: 1, job: { batchId: "batch_x", submittedAt: "t", customIds: ["cleaning::part-01"] } }),
    );
    const job = readBatchJob("/out", "cleaning");
    expect(job.batchId).toBe("batch_x");
    // Reads from the per-step path .cache/cleaning/batch/state.json
    expect(mockReadFileSync).toHaveBeenCalledWith(
      expect.stringContaining(path.join(".cache", "cleaning", "batch", "state.json")),
      "utf-8",
    );
  });

  it("writeBatchJob creates the per-step .cache/<step>/batch dir and persists the job", () => {
    writeBatchJob("/out", "handout", { batchId: "batch_h", submittedAt: "t", customIds: ["handout::part-01"] });
    expect(mockMkdirSync).toHaveBeenCalledWith(
      expect.stringContaining(path.join(".cache", "handout", "batch")),
      { recursive: true },
    );
    const written = JSON.parse(mockWriteFileSync.mock.calls[0][1] as string);
    expect(written.job.batchId).toBe("batch_h");
  });

  it("clearBatchJob removes only that step's state file", () => {
    clearBatchJob("/out", "cleaning");
    expect(mockRmSync).toHaveBeenCalledWith(
      expect.stringContaining(path.join(".cache", "cleaning", "batch", "state.json")),
      { force: true },
    );
  });

  it("keeps steps isolated: each reads/writes its own file path", () => {
    writeBatchJob("/out", "summary", { batchId: "batch_s", submittedAt: "t", customIds: [] });
    expect(mockWriteFileSync).toHaveBeenCalledWith(
      expect.stringContaining(path.join(".cache", "summary", "batch", "state.json")),
      expect.any(String),
      "utf-8",
    );
  });
});
