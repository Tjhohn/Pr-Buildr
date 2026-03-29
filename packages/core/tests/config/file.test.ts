import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { mkdtemp, rm, writeFile, readFile } from "node:fs/promises";
import { join } from "node:path";
import { tmpdir } from "node:os";
import { readConfigFile, writeConfigFile } from "../../src/config/file.js";
import { CONFIG_FILENAME } from "../../src/config/schema.js";

let tempDir: string;

beforeEach(async () => {
  tempDir = await mkdtemp(join(tmpdir(), "pr-buildr-test-"));
});

afterEach(async () => {
  await rm(tempDir, { recursive: true, force: true });
});

describe("readConfigFile", () => {
  it("returns empty object when file does not exist", async () => {
    const config = await readConfigFile(tempDir);
    expect(config).toEqual({});
  });

  it("reads and parses a valid config file", async () => {
    const content = { defaultBase: "develop", ai: { provider: "anthropic" } };
    await writeFile(
      join(tempDir, CONFIG_FILENAME),
      JSON.stringify(content),
      "utf-8",
    );

    const config = await readConfigFile(tempDir);
    expect(config).toEqual(content);
  });

  it("throws on malformed JSON with helpful message", async () => {
    await writeFile(join(tempDir, CONFIG_FILENAME), "{ invalid json", "utf-8");

    await expect(readConfigFile(tempDir)).rejects.toThrow("Invalid JSON");
    await expect(readConfigFile(tempDir)).rejects.toThrow(CONFIG_FILENAME);
  });
});

describe("writeConfigFile", () => {
  it("creates a new config file", async () => {
    await writeConfigFile(tempDir, { defaultBase: "main" });

    const raw = await readFile(join(tempDir, CONFIG_FILENAME), "utf-8");
    const parsed = JSON.parse(raw);
    expect(parsed).toEqual({ defaultBase: "main" });
  });

  it("overwrites an existing config file", async () => {
    await writeConfigFile(tempDir, { defaultBase: "main" });
    await writeConfigFile(tempDir, { defaultBase: "develop" });

    const raw = await readFile(join(tempDir, CONFIG_FILENAME), "utf-8");
    const parsed = JSON.parse(raw);
    expect(parsed).toEqual({ defaultBase: "develop" });
  });

  it("writes pretty-printed JSON with trailing newline", async () => {
    await writeConfigFile(tempDir, { defaultBase: "main" });

    const raw = await readFile(join(tempDir, CONFIG_FILENAME), "utf-8");
    expect(raw).toContain("\n");
    expect(raw.endsWith("\n")).toBe(true);
    // Pretty-printed = has 2-space indentation
    expect(raw).toContain('  "defaultBase"');
  });
});
