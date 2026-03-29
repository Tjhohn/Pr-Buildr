import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import { mkdtemp, rm, writeFile } from "node:fs/promises";
import { join } from "node:path";
import { tmpdir } from "node:os";
import { CONFIG_FILENAME } from "../../src/config/schema.js";

// Mock getRepoRoot so resolveConfig doesn't call git
vi.mock("../../src/git/repo.js", () => ({
  getRepoRoot: vi.fn(() => Promise.resolve("/mock")),
  getRemoteUrl: vi.fn(),
  parseGitHubRepo: vi.fn(),
}));

import { resolveConfig } from "../../src/config/resolver.js";
import { defaultConfig } from "../../src/config/defaults.js";

let tempDir: string;

beforeEach(async () => {
  tempDir = await mkdtemp(join(tmpdir(), "pr-buildr-test-"));
  // Clear env vars before each test
  delete process.env["PR_BUILDR_PROVIDER"];
  delete process.env["PR_BUILDR_MODEL"];
  delete process.env["PR_BUILDR_DEFAULT_BASE"];
});

afterEach(async () => {
  await rm(tempDir, { recursive: true, force: true });
  delete process.env["PR_BUILDR_PROVIDER"];
  delete process.env["PR_BUILDR_MODEL"];
  delete process.env["PR_BUILDR_DEFAULT_BASE"];
});

describe("resolveConfig", () => {
  it("returns defaults when no config file exists", async () => {
    const config = await resolveConfig(tempDir);
    expect(config.defaultBase).toBe(defaultConfig.defaultBase);
    expect(config.ai?.provider).toBe(defaultConfig.ai?.provider);
  });

  it("merges file config over defaults", async () => {
    await writeFile(
      join(tempDir, CONFIG_FILENAME),
      JSON.stringify({ defaultBase: "develop", ai: { provider: "anthropic" } }),
      "utf-8",
    );

    const config = await resolveConfig(tempDir);
    expect(config.defaultBase).toBe("develop");
    expect(config.ai?.provider).toBe("anthropic");
    // Other defaults should still be present
    expect(config.ai?.model).toBe(defaultConfig.ai?.model);
  });

  it("applies env var overrides", async () => {
    process.env["PR_BUILDR_PROVIDER"] = "ollama";
    process.env["PR_BUILDR_MODEL"] = "llama3.2";
    process.env["PR_BUILDR_DEFAULT_BASE"] = "staging";

    const config = await resolveConfig(tempDir);
    expect(config.ai?.provider).toBe("ollama");
    expect(config.ai?.model).toBe("llama3.2");
    expect(config.defaultBase).toBe("staging");
  });

  it("env vars override file config", async () => {
    await writeFile(
      join(tempDir, CONFIG_FILENAME),
      JSON.stringify({ ai: { provider: "anthropic" } }),
      "utf-8",
    );
    process.env["PR_BUILDR_PROVIDER"] = "ollama";

    const config = await resolveConfig(tempDir);
    expect(config.ai?.provider).toBe("ollama");
  });

  it("throws on invalid provider name", async () => {
    await writeFile(
      join(tempDir, CONFIG_FILENAME),
      JSON.stringify({ ai: { provider: "invalid-provider" } }),
      "utf-8",
    );

    await expect(resolveConfig(tempDir)).rejects.toThrow("Invalid AI provider");
    await expect(resolveConfig(tempDir)).rejects.toThrow("invalid-provider");
  });

  it("returns a frozen object", async () => {
    const config = await resolveConfig(tempDir);
    expect(Object.isFrozen(config)).toBe(true);
  });
});
