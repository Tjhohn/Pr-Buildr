import type { TemplateResult } from "./types.js";

/**
 * Resolve the PR template to use.
 *
 * Search order:
 * 1. .github/pull_request_template.md
 * 2. .github/PULL_REQUEST_TEMPLATE.md
 * 3. docs/pull_request_template.md
 * 4. pull_request_template.md
 * 5. Built-in fallback
 */
export async function resolveTemplate(_repoRoot: string): Promise<TemplateResult> {
  // Stub — implementation in Phase 2
  return { source: "builtin", content: "" };
}
