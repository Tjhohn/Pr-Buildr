import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { getRepositoryId } from "../../src/github/images.js";

beforeEach(() => {
  vi.stubGlobal("fetch", vi.fn());
});

afterEach(() => {
  vi.restoreAllMocks();
});

describe("getRepositoryId", () => {
  it("returns the numeric repo ID from GitHub API", async () => {
    const mockFetch = vi.mocked(fetch);
    mockFetch.mockResolvedValue(
      new Response(
        JSON.stringify({
          id: 123456789,
          name: "test-repo",
          full_name: "test-owner/test-repo",
        }),
        { status: 200 },
      ),
    );

    const id = await getRepositoryId("test-owner", "test-repo", "ghp_token");

    expect(id).toBe(123456789);
    expect(mockFetch).toHaveBeenCalledWith(
      "https://api.github.com/repos/test-owner/test-repo",
      expect.objectContaining({
        headers: expect.objectContaining({
          Authorization: "token ghp_token",
        }),
      }),
    );
  });

  it("throws on API error", async () => {
    const mockFetch = vi.mocked(fetch);
    mockFetch.mockResolvedValue(
      new Response(JSON.stringify({ message: "Not Found" }), { status: 404 }),
    );

    await expect(getRepositoryId("bad-owner", "bad-repo", "ghp_token")).rejects.toThrow(
      "Failed to get repository info",
    );
  });
});

describe("uploadImages", () => {
  it("returns empty array for no images", async () => {
    const { uploadImages } = await import("../../src/github/images.js");
    const result = await uploadImages([], {
      owner: "test",
      repo: "test",
      token: "tok",
      sessionCookie: "sess",
    });
    expect(result).toEqual([]);
  });
});
