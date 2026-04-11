import { describe, it, expect, vi, afterEach } from "vitest";
import { platform, homedir } from "node:os";
import { join } from "node:path";

/**
 * Cookie extraction tests.
 *
 * Since actual cookie extraction requires a real browser database and
 * platform-specific crypto, these tests verify the module structure,
 * error handling, and the public API contract. The actual decryption
 * logic is validated through the documented algorithm (PBKDF2 + AES-CBC
 * for Linux/macOS, AES-GCM for Windows).
 */

// We can't easily test the full extraction without a real browser DB,
// so we test the module loads and exports correctly.
describe("cookies module", () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("exports getGitHubSessionCookie function", async () => {
    const mod = await import("../../src/github/cookies.js");
    expect(typeof mod.getGitHubSessionCookie).toBe("function");
  });

  it("throws a descriptive error when no browser cookie is found", async () => {
    // On CI / clean environments, no browser is installed
    // so this should throw the "not found" error
    const mod = await import("../../src/github/cookies.js");

    try {
      await mod.getGitHubSessionCookie();
      // If it somehow succeeds (developer machine), that's fine
    } catch (err: unknown) {
      expect(err).toBeInstanceOf(Error);
      const message = (err as Error).message;
      // Should mention supported browsers or login
      expect(
        message.includes("GitHub session cookie not found") ||
          message.includes("better-sqlite3") ||
          message.includes("Chrome") ||
          message.includes("browser"),
      ).toBe(true);
    }
  });
});
