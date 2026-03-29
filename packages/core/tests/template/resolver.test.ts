import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { mkdtemp, rm, writeFile, mkdir } from "node:fs/promises";
import { join } from "node:path";
import { tmpdir } from "node:os";
import { resolveTemplate } from "../../src/template/resolver.js";
import { FALLBACK_TEMPLATE } from "../../src/template/fallback.js";

let tempDir: string;

beforeEach(async () => {
  tempDir = await mkdtemp(join(tmpdir(), "pr-buildr-test-"));
});

afterEach(async () => {
  await rm(tempDir, { recursive: true, force: true });
});

describe("resolveTemplate", () => {
  it("returns built-in fallback when no template exists", async () => {
    const result = await resolveTemplate(tempDir);
    expect(result.source).toBe("builtin");
    expect(result.content).toBe(FALLBACK_TEMPLATE);
    expect(result.path).toBeUndefined();
  });

  it("finds root-level pull_request_template.md first", async () => {
    await writeFile(join(tempDir, "pull_request_template.md"), "Root template", "utf-8");
    await mkdir(join(tempDir, ".github"), { recursive: true });
    await writeFile(
      join(tempDir, ".github", "pull_request_template.md"),
      "GitHub template",
      "utf-8",
    );

    const result = await resolveTemplate(tempDir);
    expect(result.source).toBe("repo");
    expect(result.content).toBe("Root template");
    expect(result.path).toBe(join(tempDir, "pull_request_template.md"));
  });

  it("finds root-level PULL_REQUEST_TEMPLATE.md (uppercase)", async () => {
    await writeFile(
      join(tempDir, "PULL_REQUEST_TEMPLATE.md"),
      "Uppercase root template",
      "utf-8",
    );

    const result = await resolveTemplate(tempDir);
    expect(result.source).toBe("repo");
    expect(result.content).toBe("Uppercase root template");
  });

  it("finds .github/pull_request_template.md", async () => {
    await mkdir(join(tempDir, ".github"), { recursive: true });
    await writeFile(
      join(tempDir, ".github", "pull_request_template.md"),
      "GitHub template",
      "utf-8",
    );

    const result = await resolveTemplate(tempDir);
    expect(result.source).toBe("repo");
    expect(result.content).toBe("GitHub template");
  });

  it("finds .github/PULL_REQUEST_TEMPLATE.md (uppercase)", async () => {
    await mkdir(join(tempDir, ".github"), { recursive: true });
    await writeFile(
      join(tempDir, ".github", "PULL_REQUEST_TEMPLATE.md"),
      "GitHub uppercase",
      "utf-8",
    );

    const result = await resolveTemplate(tempDir);
    expect(result.source).toBe("repo");
    expect(result.content).toBe("GitHub uppercase");
  });

  it("finds docs/pull_request_template.md as last resort", async () => {
    await mkdir(join(tempDir, "docs"), { recursive: true });
    await writeFile(
      join(tempDir, "docs", "pull_request_template.md"),
      "Docs template",
      "utf-8",
    );

    const result = await resolveTemplate(tempDir);
    expect(result.source).toBe("repo");
    expect(result.content).toBe("Docs template");
  });

  it("respects search order priority", async () => {
    // Create templates at multiple locations — root should win
    await writeFile(join(tempDir, "pull_request_template.md"), "Root wins", "utf-8");
    await mkdir(join(tempDir, "docs"), { recursive: true });
    await writeFile(
      join(tempDir, "docs", "pull_request_template.md"),
      "Docs loses",
      "utf-8",
    );

    const result = await resolveTemplate(tempDir);
    expect(result.content).toBe("Root wins");
  });

  it("reads explicit custom template path", async () => {
    await mkdir(join(tempDir, "custom"), { recursive: true });
    await writeFile(join(tempDir, "custom", "my-template.md"), "Custom template", "utf-8");

    const result = await resolveTemplate(tempDir, "custom/my-template.md");
    expect(result.source).toBe("custom");
    expect(result.content).toBe("Custom template");
    expect(result.path).toBe(join(tempDir, "custom", "my-template.md"));
  });

  it("throws when explicit template path does not exist", async () => {
    await expect(resolveTemplate(tempDir, "nonexistent.md")).rejects.toThrow(
      "Template file not found",
    );
  });
});
