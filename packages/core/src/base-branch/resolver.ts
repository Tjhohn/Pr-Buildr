import type { PrBuildrConfig } from "../config/schema.js";

/**
 * Resolve the base branch for the current PR.
 *
 * Resolution order:
 * 1. Explicit user selection (passed as argument)
 * 2. Saved branch base from config (branchBases[currentBranch])
 * 3. config.defaultBase
 * 4. Detect main/master via git
 */
export async function resolveBaseBranch(
  _currentBranch: string,
  config: PrBuildrConfig,
  explicit?: string,
): Promise<string> {
  // Stub — implementation in Phase 2
  return explicit ?? config.defaultBase ?? "main";
}
