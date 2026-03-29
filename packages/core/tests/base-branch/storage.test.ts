import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { mkdtemp, rm, readFile } from "node:fs/promises";
import { join } from "node:path";
import { tmpdir } from "node:os";
import { saveBase, getBase, clearBase } from "../../src/base-branch/storage.js";
import { CONFIG_FILENAME } from "../../src/config/schema.js";

let tempDir: string;

beforeEach(async () => {
  tempDir = await mkdtemp(join(tmpdir(), "pr-buildr-test-"));
});

afterEach(async () => {
  await rm(tempDir, { recursive: true, force: true });
});

describe("saveBase", () => {
  it("creates config file if it does not exist", async () => {
    await saveBase(tempDir, "feature/a", "main");

    const raw = await readFile(join(tempDir, CONFIG_FILENAME), "utf-8");
    const config = JSON.parse(raw);
    expect(config.branchBases).toEqual({ "feature/a": "main" });
  });

  it("adds to existing branchBases", async () => {
    await saveBase(tempDir, "feature/a", "main");
    await saveBase(tempDir, "feature/b", "feature/a");

    const raw = await readFile(join(tempDir, CONFIG_FILENAME), "utf-8");
    const config = JSON.parse(raw);
    expect(config.branchBases).toEqual({
      "feature/a": "main",
      "feature/b": "feature/a",
    });
  });

  it("overwrites existing base for a branch", async () => {
    await saveBase(tempDir, "feature/a", "main");
    await saveBase(tempDir, "feature/a", "develop");

    const raw = await readFile(join(tempDir, CONFIG_FILENAME), "utf-8");
    const config = JSON.parse(raw);
    expect(config.branchBases["feature/a"]).toBe("develop");
  });
});

describe("getBase", () => {
  it("returns saved base for a branch", async () => {
    await saveBase(tempDir, "feature/a", "main");

    const base = await getBase(tempDir, "feature/a");
    expect(base).toBe("main");
  });

  it("returns undefined when no base is saved", async () => {
    const base = await getBase(tempDir, "feature/a");
    expect(base).toBeUndefined();
  });

  it("returns undefined for unknown branch", async () => {
    await saveBase(tempDir, "feature/a", "main");

    const base = await getBase(tempDir, "feature/b");
    expect(base).toBeUndefined();
  });
});

describe("clearBase", () => {
  it("removes the entry for a branch", async () => {
    await saveBase(tempDir, "feature/a", "main");
    await saveBase(tempDir, "feature/b", "main");
    await clearBase(tempDir, "feature/a");

    const base = await getBase(tempDir, "feature/a");
    expect(base).toBeUndefined();

    // Other entries should remain
    const otherBase = await getBase(tempDir, "feature/b");
    expect(otherBase).toBe("main");
  });

  it("cleans up empty branchBases object", async () => {
    await saveBase(tempDir, "feature/a", "main");
    await clearBase(tempDir, "feature/a");

    const raw = await readFile(join(tempDir, CONFIG_FILENAME), "utf-8");
    const config = JSON.parse(raw);
    expect(config.branchBases).toBeUndefined();
  });

  it("does nothing when branch has no saved base", async () => {
    // Should not throw even when no config file exists
    await clearBase(tempDir, "feature/a");
    // No file should have been created
    await expect(
      readFile(join(tempDir, CONFIG_FILENAME), "utf-8"),
    ).rejects.toThrow();
  });
});
