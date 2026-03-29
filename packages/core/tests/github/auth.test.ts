import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { getGitHubToken } from "../../src/github/auth.js";

beforeEach(() => {
  delete process.env["GITHUB_TOKEN"];
  delete process.env["GH_TOKEN"];
});

afterEach(() => {
  delete process.env["GITHUB_TOKEN"];
  delete process.env["GH_TOKEN"];
});

describe("getGitHubToken", () => {
  it("returns override when provided", () => {
    expect(getGitHubToken("my-override")).toBe("my-override");
  });

  it("override takes priority over env vars", () => {
    process.env["GITHUB_TOKEN"] = "env-token";
    expect(getGitHubToken("my-override")).toBe("my-override");
  });

  it("returns GITHUB_TOKEN when set", () => {
    process.env["GITHUB_TOKEN"] = "ghp_token123";
    expect(getGitHubToken()).toBe("ghp_token123");
  });

  it("falls back to GH_TOKEN", () => {
    process.env["GH_TOKEN"] = "gh_token456";
    expect(getGitHubToken()).toBe("gh_token456");
  });

  it("GITHUB_TOKEN takes priority over GH_TOKEN", () => {
    process.env["GITHUB_TOKEN"] = "primary";
    process.env["GH_TOKEN"] = "fallback";
    expect(getGitHubToken()).toBe("primary");
  });

  it("throws when no token found", () => {
    expect(() => getGitHubToken()).toThrow("GitHub token not found");
    expect(() => getGitHubToken()).toThrow("GITHUB_TOKEN");
  });

  it("error message includes token creation URL", () => {
    expect(() => getGitHubToken()).toThrow("https://github.com/settings/tokens");
  });
});
