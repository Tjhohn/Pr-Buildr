import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { createPullRequest } from "../../src/github/api.js";
import type { CreatePRParams } from "../../src/github/types.js";

const baseParams: CreatePRParams = {
  owner: "test-owner",
  repo: "test-repo",
  title: "Add feature",
  body: "## Summary\nAdds a feature.",
  head: "feature/test",
  base: "main",
  token: "ghp_test_token",
};

beforeEach(() => {
  vi.stubGlobal("fetch", vi.fn());
});

afterEach(() => {
  vi.restoreAllMocks();
});

describe("createPullRequest", () => {
  it("sends correct request and parses success response", async () => {
    const mockFetch = vi.mocked(fetch);
    mockFetch.mockResolvedValue(
      new Response(
        JSON.stringify({
          number: 42,
          url: "https://api.github.com/repos/test-owner/test-repo/pulls/42",
          html_url: "https://github.com/test-owner/test-repo/pull/42",
          state: "open",
          draft: false,
        }),
        { status: 201 },
      ),
    );

    const result = await createPullRequest(baseParams);

    expect(result.number).toBe(42);
    expect(result.htmlUrl).toBe("https://github.com/test-owner/test-repo/pull/42");
    expect(result.state).toBe("open");
    expect(result.draft).toBe(false);

    expect(mockFetch).toHaveBeenCalledWith(
      "https://api.github.com/repos/test-owner/test-repo/pulls",
      expect.objectContaining({
        method: "POST",
        headers: expect.objectContaining({
          Authorization: "token ghp_test_token",
          Accept: "application/vnd.github+json",
        }),
      }),
    );

    const body = JSON.parse(mockFetch.mock.calls[0]![1]!.body as string);
    expect(body.title).toBe("Add feature");
    expect(body.head).toBe("feature/test");
    expect(body.base).toBe("main");
    expect(body.draft).toBe(false);
  });

  it("creates draft PR when specified", async () => {
    vi.mocked(fetch).mockResolvedValue(
      new Response(
        JSON.stringify({
          number: 43,
          url: "https://api.github.com/repos/test-owner/test-repo/pulls/43",
          html_url: "https://github.com/test-owner/test-repo/pull/43",
          state: "open",
          draft: true,
        }),
        { status: 201 },
      ),
    );

    const result = await createPullRequest({ ...baseParams, draft: true });
    expect(result.draft).toBe(true);

    const body = JSON.parse(vi.mocked(fetch).mock.calls[0]![1]!.body as string);
    expect(body.draft).toBe(true);
  });

  it("throws on 401 authentication error", async () => {
    vi.mocked(fetch).mockResolvedValue(
      new Response(
        JSON.stringify({ message: "Bad credentials" }),
        { status: 401 },
      ),
    );

    await expect(createPullRequest(baseParams)).rejects.toThrow("authentication failed");
  });

  it("throws on 403 permission error", async () => {
    vi.mocked(fetch).mockResolvedValue(
      new Response(
        JSON.stringify({ message: "Forbidden" }),
        { status: 403 },
      ),
    );

    await expect(createPullRequest(baseParams)).rejects.toThrow("permission denied");
  });

  it("throws on 404 repo not found", async () => {
    vi.mocked(fetch).mockImplementation(() =>
      Promise.resolve(
        new Response(
          JSON.stringify({ message: "Not Found" }),
          { status: 404 },
        ),
      ),
    );

    await expect(createPullRequest(baseParams)).rejects.toThrow(
      /Repository not found.*test-owner\/test-repo/,
    );
  });

  it("handles 422 when PR already exists", async () => {
    vi.mocked(fetch).mockResolvedValue(
      new Response(
        JSON.stringify({
          message: "Validation Failed",
          errors: [{ message: "A pull request already exists for feature/test" }],
        }),
        { status: 422 },
      ),
    );

    await expect(createPullRequest(baseParams)).rejects.toThrow(
      "pull request already exists",
    );
  });

  it("handles 422 when no commits between branches", async () => {
    vi.mocked(fetch).mockResolvedValue(
      new Response(
        JSON.stringify({
          message: "Validation Failed",
          errors: [{ message: "No commits between main and feature/test" }],
        }),
        { status: 422 },
      ),
    );

    await expect(createPullRequest(baseParams)).rejects.toThrow("No commits between");
  });

  it("handles network error", async () => {
    vi.mocked(fetch).mockRejectedValue(new Error("fetch failed"));

    await expect(createPullRequest(baseParams)).rejects.toThrow(
      "Could not connect to GitHub API",
    );
  });
});
