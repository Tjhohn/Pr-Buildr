import { describe, it, expect } from "vitest";
import { truncateDiff, categorizeFile } from "../../src/ai/truncation.js";
import type { FileSummary } from "../../src/git/types.js";

describe("categorizeFile", () => {
  it('categorizes .test.ts files as "test"', () => {
    expect(categorizeFile("src/utils.test.ts")).toBe("test");
    expect(categorizeFile("src/utils.spec.tsx")).toBe("test");
  });

  it('categorizes __tests__ directory files as "test"', () => {
    expect(categorizeFile("src/__tests__/utils.ts")).toBe("test");
  });

  it('categorizes tests/ directory files as "test"', () => {
    expect(categorizeFile("tests/unit/config.ts")).toBe("test");
    expect(categorizeFile("test/helpers.ts")).toBe("test");
  });

  it('categorizes config files as "config"', () => {
    expect(categorizeFile("package.json")).toBe("config");
    expect(categorizeFile("tsconfig.json")).toBe("config");
    expect(categorizeFile("tsconfig.base.json")).toBe("config");
    expect(categorizeFile(".eslintrc")).toBe("config");
    expect(categorizeFile("vitest.config.ts")).toBe("config");
    expect(categorizeFile("pnpm-lock.yaml")).toBe("config");
  });

  it('categorizes docs as "other"', () => {
    expect(categorizeFile("README.md")).toBe("other");
    expect(categorizeFile("docs/guide.md")).toBe("other");
    expect(categorizeFile("CHANGELOG.md")).toBe("other");
    expect(categorizeFile("LICENSE")).toBe("other");
  });

  it('categorizes production code as "primary"', () => {
    expect(categorizeFile("src/index.ts")).toBe("primary");
    expect(categorizeFile("src/api/handler.ts")).toBe("primary");
    expect(categorizeFile("lib/utils.js")).toBe("primary");
  });
});

describe("truncateDiff", () => {
  it("returns diff unchanged if under budget", () => {
    const diff = "diff --git a/file.ts b/file.ts\n+line";
    const result = truncateDiff(diff, [], { diffBudget: 10000 });
    expect(result).toBe(diff);
  });

  it("truncates large diffs to fit within budget", () => {
    const largePrimaryDiff = `diff --git a/src/big.ts b/src/big.ts\n${"+ added line\n".repeat(500)}`;
    const largeTestDiff = `diff --git a/tests/big.test.ts b/tests/big.test.ts\n${"+ test line\n".repeat(500)}`;
    const diff = largePrimaryDiff + largeTestDiff;

    const fileSummary: FileSummary[] = [
      { path: "src/big.ts", additions: 500, deletions: 0, status: "modified" },
      { path: "tests/big.test.ts", additions: 500, deletions: 0, status: "modified" },
    ];

    const result = truncateDiff(diff, fileSummary, { diffBudget: 1000 });
    expect(result.length).toBeLessThan(diff.length);
  });

  it("includes summary line for truncated files", () => {
    const largeDiff = `diff --git a/src/big.ts b/src/big.ts\n${"+ line\n".repeat(2000)}`;

    const fileSummary: FileSummary[] = [
      { path: "src/big.ts", additions: 2000, deletions: 0, status: "modified" },
    ];

    const result = truncateDiff(largeDiff, fileSummary, { diffBudget: 100 });
    expect(result).toContain("src/big.ts (+2000, -0) — diff truncated");
  });

  it("includes smaller files in full before truncating larger ones", () => {
    const smallDiff = `diff --git a/src/small.ts b/src/small.ts\n+one line`;
    const largeDiff = `diff --git a/src/big.ts b/src/big.ts\n${"+ line\n".repeat(2000)}`;
    const diff = smallDiff + "\n" + largeDiff;

    const fileSummary: FileSummary[] = [
      { path: "src/small.ts", additions: 1, deletions: 0, status: "modified" },
      { path: "src/big.ts", additions: 2000, deletions: 0, status: "modified" },
    ];

    const result = truncateDiff(diff, fileSummary, { diffBudget: 500 });
    expect(result).toContain("diff --git a/src/small.ts b/src/small.ts");
    expect(result).toContain("src/big.ts (+2000, -0) — diff truncated");
  });

  it("handles empty diff", () => {
    const result = truncateDiff("", []);
    expect(result).toBe("");
  });

  it("prioritizes primary over test files", () => {
    // Create two diffs of roughly equal size (~550 chars each, ~1100 total)
    // Budget 700: primary gets 60% = 420, test gets 25% = 175
    // Primary hunk (~550) > 420 → truncated
    // Test hunk (~550) > 175 → truncated
    // But at budget 1200: primary gets 720, test gets 300
    // Primary hunk (~550) < 720 → included
    // Test hunk (~550) > 300 → truncated
    const primaryDiff = `diff --git a/src/app.ts b/src/app.ts\n${"+ added primary code line here\n".repeat(50)}`;
    const testDiff = `diff --git a/tests/app.test.ts b/tests/app.test.ts\n${"+ added test code line here\n".repeat(50)}`;
    const diff = primaryDiff + testDiff;

    const fileSummary: FileSummary[] = [
      { path: "src/app.ts", additions: 50, deletions: 0, status: "modified" },
      { path: "tests/app.test.ts", additions: 50, deletions: 0, status: "modified" },
    ];

    // Primary hunk: 1587 chars, test hunk: 1451 chars, total: 3038
    // Budget: 2700 → primary gets floor(60/100 * 2700) = 1620, test gets 675
    // Primary (1587) < 1620 → fits. Test (1451) > 675 → truncated.
    const result = truncateDiff(diff, fileSummary, { diffBudget: 2700 });
    // Primary diff should be included in full
    expect(result).toContain("diff --git a/src/app.ts b/src/app.ts");
    expect(result).toContain("+ added primary code line here");
    // Test diff should be truncated
    expect(result).toContain("tests/app.test.ts (+50, -0) — diff truncated");
  });
});
