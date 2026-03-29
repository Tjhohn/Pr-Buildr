import type { PrBuildrConfig } from "../config/schema.js";
import { getDefaultBranch } from "../git/operations.js";

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
  currentBranch: string,
  config: PrBuildrConfig,
  explicit?: string,
): Promise<string> {
  // 1. Explicit selection
  if (explicit) {
    return explicit;
  }

  // 2. Saved branch base
  const saved = config.branchBases?.[currentBranch];
  if (saved) {
    return saved;
  }

  // 3. Config default
  if (config.defaultBase) {
    return config.defaultBase;
  }

  // 4. Auto-detect from git
  return getDefaultBranch();
}
