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
});
