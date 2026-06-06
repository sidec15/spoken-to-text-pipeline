import { describe, it, expect } from "@jest/globals";
import type { AiGenerateOptions } from "../../../../src/services/ai/ai.types.js";
import { buildResponsesRequest } from "../../../../src/services/ai/openai/buildResponsesRequest.js";

const base: AiGenerateOptions = { systemPrompt: "SYS", userPrompt: "BODY" };

function roles(req: any): string[] {
  return (req.input as Array<{ role: string }>).map((m) => m.role);
}
function contents(req: any): string[] {
  return (req.input as Array<{ content: string }>).map((m) => m.content);
}

describe("buildResponsesRequest", () => {
  it("includes temperature for standard models when set", () => {
    const req = buildResponsesRequest({ ...base, temperature: 0.5 }, "gpt-4o-mini");
    expect(req.temperature).toBe(0.5);
    expect(req.model).toBe("gpt-4o-mini");
  });

  it("omits temperature for reasoning models even when set", () => {
    const req = buildResponsesRequest({ ...base, temperature: 0.5 }, "gpt-5-mini");
    expect(req.temperature).toBeUndefined();
  });

  it("includes max_output_tokens only when maxTokens is set", () => {
    expect(buildResponsesRequest(base, "gpt-4o-mini").max_output_tokens).toBeUndefined();
    expect(buildResponsesRequest({ ...base, maxTokens: 1000 }, "gpt-4o-mini").max_output_tokens).toBe(1000);
  });

  it("renders neighbor excerpts as reference-only messages in the documented order", () => {
    const req = buildResponsesRequest(
      {
        systemPrompt: "SYS",
        manualContextText: "MANUAL",
        previousChunkExcerpt: "PREV",
        nextChunkExcerpt: "NEXT",
        previousOutputExcerpt: "OUT",
        userPrompt: "BODY",
      },
      "gpt-4o-mini",
    );
    // order: system -> manualContext -> precedingContext -> followingContext -> previousOutputExcerpt -> userPrompt
    expect(roles(req)).toEqual(["system", "user", "user", "user", "user", "user"]);
    const joined = contents(req);
    expect(joined[2]).toContain("PREV");
    expect(joined[2]).toMatch(/PRECEDING/i);
    expect(joined[3]).toContain("NEXT");
    expect(joined[3]).toMatch(/FOLLOWING/i);
    expect(joined[5]).toContain("BODY");
  });

  it("omits the preceding block when previousChunkExcerpt is absent (first part)", () => {
    const req = buildResponsesRequest({ ...base, nextChunkExcerpt: "NEXT" }, "gpt-4o-mini");
    const joined = contents(req).join("\n");
    expect(joined).not.toMatch(/PRECEDING/i);
    expect(joined).toMatch(/FOLLOWING/i);
  });

  it("omits the following block when nextChunkExcerpt is absent (last part)", () => {
    const req = buildResponsesRequest({ ...base, previousChunkExcerpt: "PREV" }, "gpt-4o-mini");
    const joined = contents(req).join("\n");
    expect(joined).toMatch(/PRECEDING/i);
    expect(joined).not.toMatch(/FOLLOWING/i);
  });
});
