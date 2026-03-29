import type { FileSummary } from "../git/types.js";
import type { AIConfig } from "../config/schema.js";

const DEFAULT_DIFF_BUDGET = 12000;
const DEFAULT_WEIGHTS = { primary: 60, test: 25, config: 10, other: 5 };
const TEST_HEAVY_THRESHOLD = 0.7;
const TEST_HEAVY_WEIGHTS = { primary: 35, test: 50, config: 10, other: 5 };

type FileCategory = "primary" | "test" | "config" | "other";

const TEST_PATTERNS = [
  /\.test\.[jt]sx?$/,
  /\.spec\.[jt]sx?$/,
  /\/__tests__\//,
  /^tests?\//,
];

const CONFIG_PATTERNS = [
  /^package\.json$/,
  /^package-lock\.json$/,
  /^pnpm-lock\.yaml$/,
  /^yarn\.lock$/,
  /^tsconfig/,
  /^\..+rc$/,
  /^\..+rc\./,
  /\.config\.[jt]s$/,
  /\.config\.mjs$/,
];

const OTHER_PATTERNS = [
  /\.md$/i,
  /^docs\//,
  /^README/i,
  /^LICENSE/i,
  /^CHANGELOG/i,
  /^\.gitignore$/,
];

interface DiffHunk {
  filePath: string;
  content: string;
  category: FileCategory;
  size: number;
}

/**
 * Categorize a file path into primary, test, config, or other.
 */
export function categorizeFile(filePath: string): FileCategory {
  for (const pattern of TEST_PATTERNS) {
    if (pattern.test(filePath)) return "test";
  }
  for (const pattern of CONFIG_PATTERNS) {
    if (pattern.test(filePath)) return "config";
  }
  for (const pattern of OTHER_PATTERNS) {
    if (pattern.test(filePath)) return "other";
  }
  return "primary";
}

/**
 * Split a unified diff into per-file hunks.
 */
function splitDiffIntoHunks(diff: string): DiffHunk[] {
  if (!diff.trim()) return [];

  const hunks: DiffHunk[] = [];
  const parts = diff.split(/^(?=diff --git )/m);

  for (const part of parts) {
    const trimmed = part.trim();
    if (!trimmed) continue;

    // Extract file path from "diff --git a/path b/path"
    const headerMatch = trimmed.match(/^diff --git a\/(.+?) b\/(.+)/);
    const filePath = headerMatch?.[2] ?? "unknown";

    hunks.push({
      filePath,
      content: trimmed,
      category: categorizeFile(filePath),
      size: trimmed.length,
    });
  }

  return hunks;
}

/**
 * Detect if a PR is test-heavy based on file summaries.
 * Returns true if >70% of total changes are in test files.
 */
function isTestHeavyPR(fileSummary: FileSummary[]): boolean {
  let totalChanges = 0;
  let testChanges = 0;

  for (const file of fileSummary) {
    const changes = file.additions + file.deletions;
    totalChanges += changes;
    if (categorizeFile(file.path) === "test") {
      testChanges += changes;
    }
  }

  if (totalChanges === 0) return false;
  return testChanges / totalChanges > TEST_HEAVY_THRESHOLD;
}

/**
 * Truncate a diff to fit within a character budget, using prioritized allocation.
 *
 * Strategy:
 * 1. Categorize each file's diff hunk (primary/test/config/other)
 * 2. Detect test-heavy PRs and adjust weights
 * 3. Allocate budget per category based on weights
 * 4. Within each category, include full diffs for smaller files first
 * 5. Truncated files get a summary line instead
 */
export function truncateDiff(
  diff: string,
  fileSummary: FileSummary[],
  config?: AIConfig,
): string {
  const budget = config?.diffBudget ?? DEFAULT_DIFF_BUDGET;

  if (diff.length <= budget) {
    return diff;
  }

  const hunks = splitDiffIntoHunks(diff);
  if (hunks.length === 0) return diff;

  const testHeavy = isTestHeavyPR(fileSummary);
  const rawWeights = testHeavy ? TEST_HEAVY_WEIGHTS : DEFAULT_WEIGHTS;
  const configWeights = config?.categoryWeights;
  const weights = {
    primary: configWeights?.primary ?? rawWeights.primary,
    test: configWeights?.test ?? rawWeights.test,
    config: configWeights?.config ?? rawWeights.config,
    other: configWeights?.other ?? rawWeights.other,
  };

  const totalWeight = weights.primary + weights.test + weights.config + weights.other;

  // Group hunks by category
  const grouped: Record<FileCategory, DiffHunk[]> = {
    primary: [],
    test: [],
    config: [],
    other: [],
  };
  for (const hunk of hunks) {
    grouped[hunk.category].push(hunk);
  }

  // Sort each category by size ascending (include small files first)
  for (const category of Object.keys(grouped) as FileCategory[]) {
    grouped[category].sort((a, b) => a.size - b.size);
  }

  // Build the file summary lookup for truncation messages
  const summaryMap = new Map<string, FileSummary>();
  for (const file of fileSummary) {
    summaryMap.set(file.path, file);
  }

  const outputParts: string[] = [];

  for (const category of ["primary", "test", "config", "other"] as FileCategory[]) {
    const categoryBudget = Math.floor((weights[category] / totalWeight) * budget);
    let used = 0;
    const categoryHunks = grouped[category];

    for (const hunk of categoryHunks) {
      if (used + hunk.size <= categoryBudget) {
        outputParts.push(hunk.content);
        used += hunk.size;
      } else {
        // Truncated — add summary line
        const summary = summaryMap.get(hunk.filePath);
        const additions = summary?.additions ?? 0;
        const deletions = summary?.deletions ?? 0;
        outputParts.push(
          `# ${hunk.filePath} (+${additions}, -${deletions}) — diff truncated`,
        );
      }
    }
  }

  return outputParts.join("\n\n");
}
