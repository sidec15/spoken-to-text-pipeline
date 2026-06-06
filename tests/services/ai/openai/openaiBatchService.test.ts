import { describe, it, expect, beforeEach, jest } from "@jest/globals";
import type { BatchRequest } from "../../../../src/services/ai/batch/batch.types.js";

const mockFilesCreate = jest.fn();
const mockFilesContent = jest.fn();
const mockBatchesCreate = jest.fn();
const mockBatchesRetrieve = jest.fn();
const mockToFile = jest.fn(async (buf: any, name: any) => ({ buf, name }));

jest.unstable_mockModule("openai", () => {
  const MockOpenAI = jest.fn().mockImplementation(() => ({
    files: { create: mockFilesCreate, content: mockFilesContent },
    batches: { create: mockBatchesCreate, retrieve: mockBatchesRetrieve },
  }));
  return { default: MockOpenAI, toFile: mockToFile };
});

describe("OpenAiBatchService", () => {
  let OpenAiBatchService: any;
  let service: any;

  beforeEach(async () => {
    jest.clearAllMocks();
    const mod = await import("../../../../src/services/ai/openai/openaiBatchService.js");
    OpenAiBatchService = mod.OpenAiBatchService;
    service = new OpenAiBatchService("sk-test", "gpt-5-mini");
  });

  it("submit uploads JSONL with /v1/responses lines and creates a 24h batch", async () => {
    mockFilesCreate.mockResolvedValue({ id: "file_123" });
    mockBatchesCreate.mockResolvedValue({ id: "batch_abc" });

    const requests: BatchRequest[] = [
      { customId: "cleaning::part-01", options: { systemPrompt: "S", userPrompt: "A" } },
      { customId: "cleaning::part-02", options: { systemPrompt: "S", userPrompt: "B" } },
    ];

    const id = await service.submit(requests);
    expect(id).toBe("batch_abc");

    const jsonlArg = mockToFile.mock.calls[0][0];
    const jsonlText = Buffer.isBuffer(jsonlArg) ? jsonlArg.toString("utf-8") : String(jsonlArg);
    const lines = jsonlText.trim().split("\n").map((l) => JSON.parse(l));
    expect(lines[0].custom_id).toBe("cleaning::part-01");
    expect(lines[0].method).toBe("POST");
    expect(lines[0].url).toBe("/v1/responses");
    expect(lines[0].body.model).toBe("gpt-5-mini");

    expect(mockFilesCreate).toHaveBeenCalledWith(expect.objectContaining({ purpose: "batch" }));
    expect(mockBatchesCreate).toHaveBeenCalledWith(
      expect.objectContaining({
        input_file_id: "file_123",
        endpoint: "/v1/responses",
        completion_window: "24h",
      }),
    );
  });

  it("poll maps status and request_counts", async () => {
    mockBatchesRetrieve.mockResolvedValue({
      status: "in_progress",
      request_counts: { completed: 3, failed: 0, total: 9 },
    });
    const res = await service.poll("batch_abc");
    expect(res.status).toBe("in_progress");
    expect(res.requestCounts).toEqual({ completed: 3, failed: 0, total: 9 });
  });

  it("collect parses output JSONL into customId -> text", async () => {
    mockBatchesRetrieve.mockResolvedValue({
      status: "completed",
      output_file_id: "out_1",
      error_file_id: null,
    });
    const outJsonl =
      JSON.stringify({
        custom_id: "cleaning::part-01",
        response: { status_code: 200, body: { status: "completed", output_text: "CLEANED A" } },
      }) + "\n";
    mockFilesContent.mockResolvedValue({ text: async () => outJsonl });

    const results = await service.collect("batch_abc");
    expect(results).toEqual([{ customId: "cleaning::part-01", text: "CLEANED A" }]);
  });

  it("collect marks customIds from the error file with an error", async () => {
    mockBatchesRetrieve.mockResolvedValue({
      status: "completed",
      output_file_id: "out_1",
      error_file_id: "err_1",
    });
    const outJsonl =
      JSON.stringify({
        custom_id: "cleaning::part-01",
        response: { status_code: 200, body: { status: "completed", output_text: "OK" } },
      }) + "\n";
    const errJsonl =
      JSON.stringify({ custom_id: "cleaning::part-02", error: { message: "rate limited" } }) + "\n";
    mockFilesContent
      .mockResolvedValueOnce({ text: async () => outJsonl })
      .mockResolvedValueOnce({ text: async () => errJsonl });

    const results = await service.collect("batch_abc");
    expect(results).toContainEqual({ customId: "cleaning::part-01", text: "OK" });
    expect(results).toContainEqual({
      customId: "cleaning::part-02",
      error: expect.stringContaining("rate limited"),
    });
  });

  it("collect marks an incomplete response body as an error", async () => {
    mockBatchesRetrieve.mockResolvedValue({
      status: "completed",
      output_file_id: "out_2",
      error_file_id: null,
    });
    const outJsonl =
      JSON.stringify({
        custom_id: "cleaning::part-03",
        response: { status_code: 200, body: { status: "incomplete", output_text: "" } },
      }) + "\n";
    mockFilesContent.mockResolvedValue({ text: async () => outJsonl });

    const results = await service.collect("batch_abc");
    expect(results).toHaveLength(1);
    expect(results[0].customId).toBe("cleaning::part-03");
    expect(results[0].error).toEqual(expect.stringContaining("incomplete"));
    expect((results[0] as any).text).toBeUndefined();
  });

  it("collect returns [] and does not call files.content when there are no file IDs", async () => {
    mockBatchesRetrieve.mockResolvedValue({
      status: "failed",
      output_file_id: null,
      error_file_id: null,
    });

    const results = await service.collect("batch_abc");
    expect(results).toEqual([]);
    expect(mockFilesContent).not.toHaveBeenCalled();
  });

  it("collect skips malformed JSONL lines but still returns valid results", async () => {
    mockBatchesRetrieve.mockResolvedValue({
      status: "completed",
      output_file_id: "out_3",
      error_file_id: null,
    });
    const goodLine = JSON.stringify({
      custom_id: "cleaning::part-01",
      response: { status_code: 200, body: { status: "completed", output_text: "GOOD" } },
    });
    const outJsonl = `${goodLine}\nNOT_VALID_JSON\n`;
    mockFilesContent.mockResolvedValue({ text: async () => outJsonl });

    const results = await service.collect("batch_abc");
    // The good line is preserved
    expect(results).toContainEqual({ customId: "cleaning::part-01", text: "GOOD" });
    // The malformed line produces an error result rather than throwing
    const errorResult = results.find((r) => r.customId === "unknown");
    expect(errorResult).toBeDefined();
    expect(errorResult!.error).toEqual(expect.stringContaining("malformed JSONL line"));
  });
});
