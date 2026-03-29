import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { OpenAIProvider } from "../../src/ai/providers/openai.js";
import { AnthropicProvider } from "../../src/ai/providers/anthropic.js";
import { OllamaProvider } from "../../src/ai/providers/ollama.js";
import { OpenAICompatibleProvider } from "../../src/ai/providers/openai-compatible.js";
import type { DraftInput } from "../../src/ai/types.js";

const mockInput: DraftInput = {
  template: "## Summary\n<!-- details -->",
  baseBranch: "main",
  headBranch: "feature/test",
  diff: "diff --git a/file.ts b/file.ts\n+line",
  fileSummary: [{ path: "file.ts", additions: 1, deletions: 0, status: "modified" }],
  commitSummary: [
    { hash: "abc123", subject: "Add feature", body: "", author: "Dev", date: "2024-01-01" },
  ],
};

const mockJsonResponse = JSON.stringify({
  title: "Add test feature",
  body: "## Summary\nThis adds a test feature.",
});

beforeEach(() => {
  vi.stubGlobal("fetch", vi.fn());
});

afterEach(() => {
  vi.restoreAllMocks();
});

describe("OpenAIProvider", () => {
  it("sends correct request format", async () => {
    const mockFetch = vi.mocked(fetch);
    mockFetch.mockResolvedValue(
      new Response(
        JSON.stringify({
          choices: [{ message: { content: mockJsonResponse } }],
        }),
        { status: 200 },
      ),
    );

    const provider = new OpenAIProvider("test-key", "gpt-4o");
    const result = await provider.generateDraft(mockInput);

    expect(result.title).toBe("Add test feature");
    expect(result.body).toContain("## Summary");

    expect(mockFetch).toHaveBeenCalledWith(
      "https://api.openai.com/v1/chat/completions",
      expect.objectContaining({
        method: "POST",
        headers: expect.objectContaining({
          Authorization: "Bearer test-key",
        }),
      }),
    );

    // Verify JSON mode is requested
    const callBody = JSON.parse(mockFetch.mock.calls[0]![1]!.body as string);
    expect(callBody.response_format).toEqual({ type: "json_object" });
    expect(callBody.model).toBe("gpt-4o");
  });

  it("throws on auth error", async () => {
    vi.mocked(fetch).mockResolvedValue(
      new Response(JSON.stringify({ error: { message: "Invalid API key" } }), {
        status: 401,
      }),
    );

    const provider = new OpenAIProvider("bad-key", "gpt-4o");
    await expect(provider.generateDraft(mockInput)).rejects.toThrow("authentication failed");
  });

  it("throws on rate limit", async () => {
    vi.mocked(fetch).mockResolvedValue(
      new Response(JSON.stringify({ error: { message: "Rate limit" } }), { status: 429 }),
    );

    const provider = new OpenAIProvider("key", "gpt-4o");
    await expect(provider.generateDraft(mockInput)).rejects.toThrow("rate limit");
  });
});

describe("AnthropicProvider", () => {
  it("sends correct request format", async () => {
    const mockFetch = vi.mocked(fetch);
    mockFetch.mockResolvedValue(
      new Response(
        JSON.stringify({
          content: [{ type: "text", text: mockJsonResponse }],
        }),
        { status: 200 },
      ),
    );

    const provider = new AnthropicProvider("test-key", "claude-sonnet-4-20250514");
    const result = await provider.generateDraft(mockInput);

    expect(result.title).toBe("Add test feature");

    expect(mockFetch).toHaveBeenCalledWith(
      "https://api.anthropic.com/v1/messages",
      expect.objectContaining({
        method: "POST",
        headers: expect.objectContaining({
          "x-api-key": "test-key",
          "anthropic-version": "2023-06-01",
        }),
      }),
    );

    const callBody = JSON.parse(mockFetch.mock.calls[0]![1]!.body as string);
    expect(callBody.model).toBe("claude-sonnet-4-20250514");
    expect(callBody.system).toBeTruthy();
    expect(callBody.max_tokens).toBe(4096);
  });

  it("throws on auth error", async () => {
    vi.mocked(fetch).mockResolvedValue(
      new Response(JSON.stringify({ error: { message: "Invalid key" } }), { status: 401 }),
    );

    const provider = new AnthropicProvider("bad-key", "claude-sonnet-4-20250514");
    await expect(provider.generateDraft(mockInput)).rejects.toThrow("authentication failed");
  });
});

describe("OllamaProvider", () => {
  it("sends correct request format", async () => {
    const mockFetch = vi.mocked(fetch);
    mockFetch.mockResolvedValue(
      new Response(
        JSON.stringify({ message: { content: mockJsonResponse } }),
        { status: 200 },
      ),
    );

    const provider = new OllamaProvider("http://127.0.0.1:11434", "llama3.1");
    const result = await provider.generateDraft(mockInput);

    expect(result.title).toBe("Add test feature");

    expect(mockFetch).toHaveBeenCalledWith(
      "http://127.0.0.1:11434/api/chat",
      expect.objectContaining({ method: "POST" }),
    );

    const callBody = JSON.parse(mockFetch.mock.calls[0]![1]!.body as string);
    expect(callBody.model).toBe("llama3.1");
    expect(callBody.stream).toBe(false);
    expect(callBody.format).toBe("json");
  });

  it("gives helpful error on connection failure", async () => {
    vi.mocked(fetch).mockRejectedValue(new Error("connect ECONNREFUSED 127.0.0.1:11434"));

    const provider = new OllamaProvider("http://127.0.0.1:11434", "llama3.1");
    await expect(provider.generateDraft(mockInput)).rejects.toThrow("Could not connect to Ollama");
  });

  it("strips trailing slash from baseUrl", async () => {
    const mockFetch = vi.mocked(fetch);
    mockFetch.mockResolvedValue(
      new Response(
        JSON.stringify({ message: { content: mockJsonResponse } }),
        { status: 200 },
      ),
    );

    const provider = new OllamaProvider("http://127.0.0.1:11434/", "llama3.1");
    await provider.generateDraft(mockInput);

    expect(mockFetch).toHaveBeenCalledWith(
      "http://127.0.0.1:11434/api/chat",
      expect.anything(),
    );
  });
});

describe("OpenAICompatibleProvider", () => {
  it("sends to custom base URL", async () => {
    const mockFetch = vi.mocked(fetch);
    mockFetch.mockResolvedValue(
      new Response(
        JSON.stringify({
          choices: [{ message: { content: mockJsonResponse } }],
        }),
        { status: 200 },
      ),
    );

    const provider = new OpenAICompatibleProvider(
      "http://localhost:1234/v1",
      "local-model",
      undefined,
      "optional-key",
    );
    const result = await provider.generateDraft(mockInput);

    expect(result.title).toBe("Add test feature");

    expect(mockFetch).toHaveBeenCalledWith(
      "http://localhost:1234/v1/chat/completions",
      expect.objectContaining({
        headers: expect.objectContaining({
          Authorization: "Bearer optional-key",
        }),
      }),
    );
  });

  it("works without API key", async () => {
    const mockFetch = vi.mocked(fetch);
    mockFetch.mockResolvedValue(
      new Response(
        JSON.stringify({
          choices: [{ message: { content: mockJsonResponse } }],
        }),
        { status: 200 },
      ),
    );

    const provider = new OpenAICompatibleProvider(
      "http://localhost:1234/v1",
      "local-model",
    );
    await provider.generateDraft(mockInput);

    const headers = mockFetch.mock.calls[0]![1]!.headers as Record<string, string>;
    expect(headers["Authorization"]).toBeUndefined();
  });
});
