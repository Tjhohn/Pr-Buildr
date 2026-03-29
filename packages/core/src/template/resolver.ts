import { readFile, access } from "node:fs/promises";
import { join } from "node:path";
import type { TemplateResult } from "./types.js";
import { FALLBACK_TEMPLATE } from "./fallback.js";

/**
 * Paths to search for a PR template, in priority order.
 * Root-level first (most common), then .github/, then docs/.
 */
const TEMPLATE_SEARCH_PATHS = [
  "pull_request_template.md",
  "PULL_REQUEST_TEMPLATE.md",
  ".github/pull_request_template.md",
  ".github/PULL_REQUEST_TEMPLATE.md",
  "docs/pull_request_template.md",
];

/**
 * Resolve the PR template to use.
 *
 * If explicitPath is provided, reads that file directly (for --template flag, future).
 * Otherwise, searches known locations in priority order.
 * Falls back to the built-in default template.
 */
export async function resolveTemplate(
  repoRoot: string,
  explicitPath?: string,
): Promise<TemplateResult> {
  // Explicit path takes highest priority
  if (explicitPath) {
    const fullPath = join(repoRoot, explicitPath);
    try {
      const content = await readFile(fullPath, "utf-8");
      return { source: "custom", content, path: fullPath };
    } catch {
      throw new Error(
        `Template file not found: ${fullPath}. Check the path and try again.`,
      );
    }
  }

  // Search known locations
  for (const relativePath of TEMPLATE_SEARCH_PATHS) {
    const fullPath = join(repoRoot, relativePath);
    try {
      await access(fullPath);
      const content = await readFile(fullPath, "utf-8");
      return { source: "repo", content, path: fullPath };
    } catch {
      // File doesn't exist, try next
    }
  }

  // Fallback to built-in
  return { source: "builtin", content: FALLBACK_TEMPLATE };
}
