import { describe, it, expect } from "vitest";
import { buildPrompt } from "../../src/ai/prompt.js";
import type { DraftInput } from "../../src/ai/types.js";

function makeDraftInput(overrides?: Partial<DraftInput>): DraftInput {
  return {
    template: "## Summary\n<!-- description -->\n\n## Changes\n<!-- details -->",
    baseBranch: "main",
    headBranch: "feature/add-auth",
    diff: "diff --git a/src/auth.ts b/src/auth.ts\n+export function authenticate() {}",
    fileSummary: [
      { path: "src/auth.ts", additions: 10, deletions: 2, status: "modified" as const },
    ],
    commitSummary: [
      {
        hash: "abc1234567890",
        subject: "Add authentication module",
        body: "",
        author: "Dev User",
        date: "2024-01-15T10:00:00Z",
      },
    ],
    ...overrides,
  };
}

describe("buildPrompt", () => {
  it("returns system and user messages", () => {
    const result = buildPrompt(makeDraftInput());
    expect(result.system).toBeTruthy();
    expect(result.user).toBeTruthy();
  });

  it("system prompt instructs JSON output", () => {
    const result = buildPrompt(makeDraftInput());
    expect(result.system).toContain("JSON");
    expect(result.system).toContain('"title"');
    expect(result.system).toContain('"body"');
  });

  it("user message includes the template", () => {
    const result = buildPrompt(makeDraftInput());
    expect(result.user).toContain("## Summary");
    expect(result.user).toContain("## Changes");
  });

  it("user message includes branch info", () => {
    const result = buildPrompt(makeDraftInput());
    expect(result.user).toContain("Base: main");
    expect(result.user).toContain("Head: feature/add-auth");
  });

  it("user message includes file summary", () => {
    const result = buildPrompt(makeDraftInput());
    expect(result.user).toContain("src/auth.ts (+10, -2) [modified]");
  });

  it("user message includes commit summary", () => {
    const result = buildPrompt(makeDraftInput());
    expect(result.user).toContain("abc1234 Add authentication module");
  });

  it("user message includes the diff", () => {
    const result = buildPrompt(makeDraftInput());
    expect(result.user).toContain("export function authenticate()");
  });

  it("handles empty file summary", () => {
    const result = buildPrompt(makeDraftInput({ fileSummary: [] }));
    expect(result.user).toContain("(no files changed)");
  });

  it("handles empty commit summary", () => {
    const result = buildPrompt(makeDraftInput({ commitSummary: [] }));
    expect(result.user).toContain("(no commits)");
  });

  it("handles empty diff", () => {
    const result = buildPrompt(makeDraftInput({ diff: "" }));
    expect(result.user).toContain("(no diff available)");
  });

  it("shows renamed file status with old path", () => {
    const result = buildPrompt(
      makeDraftInput({
        fileSummary: [
          {
            path: "src/new-auth.ts",
            additions: 0,
            deletions: 0,
            status: "renamed",
            oldPath: "src/old-auth.ts",
          },
        ],
      }),
    );
    expect(result.user).toContain("renamed from src/old-auth.ts");
  });
});
