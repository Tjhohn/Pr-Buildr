import { describe, it, expect } from "vitest";
import { parseGitHubRepo } from "../../src/git/repo.js";

describe("parseGitHubRepo", () => {
  it("parses HTTPS URL with .git suffix", () => {
    const result = parseGitHubRepo("https://github.com/owner/repo.git");
    expect(result).toEqual({ owner: "owner", repo: "repo" });
  });

  it("parses HTTPS URL without .git suffix", () => {
    const result = parseGitHubRepo("https://github.com/owner/repo");
    expect(result).toEqual({ owner: "owner", repo: "repo" });
  });

  it("parses SSH URL with .git suffix", () => {
    const result = parseGitHubRepo("git@github.com:owner/repo.git");
    expect(result).toEqual({ owner: "owner", repo: "repo" });
  });

  it("parses SSH URL without .git suffix", () => {
    const result = parseGitHubRepo("git@github.com:owner/repo");
    expect(result).toEqual({ owner: "owner", repo: "repo" });
  });

  it("parses ssh:// protocol URL", () => {
    const result = parseGitHubRepo("ssh://git@github.com/owner/repo.git");
    expect(result).toEqual({ owner: "owner", repo: "repo" });
  });

  it("parses HTTP URL (non-HTTPS)", () => {
    const result = parseGitHubRepo("http://github.com/owner/repo.git");
    expect(result).toEqual({ owner: "owner", repo: "repo" });
  });

  it("handles owner/repo with hyphens and dots", () => {
    const result = parseGitHubRepo("https://github.com/my-org/my-repo.js.git");
    expect(result).toEqual({ owner: "my-org", repo: "my-repo.js" });
  });

  it("trims whitespace", () => {
    const result = parseGitHubRepo("  https://github.com/owner/repo.git  ");
    expect(result).toEqual({ owner: "owner", repo: "repo" });
  });

  it("throws on non-GitHub URL", () => {
    expect(() => parseGitHubRepo("https://gitlab.com/owner/repo.git")).toThrow(
      "Could not parse GitHub owner/repo",
    );
  });

  it("throws on empty string", () => {
    expect(() => parseGitHubRepo("")).toThrow("Could not parse GitHub owner/repo");
  });

  it("throws on malformed URL", () => {
    expect(() => parseGitHubRepo("not-a-url")).toThrow(
      "Could not parse GitHub owner/repo",
    );
  });
});
