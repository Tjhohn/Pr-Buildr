import type { PrBuildrConfig } from "./schema.js";
import { defaultConfig } from "./defaults.js";

/**
 * Resolve the full config by merging:
 * 1. .pr-builder.json (repo root)
 * 2. global config (~/.pr-builder/config.json) — future
 * 3. env var overrides
 * 4. defaults
 */
export async function resolveConfig(_repoRoot?: string): Promise<PrBuildrConfig> {
  // Stub — implementation in Phase 2
  return { ...defaultConfig };
}
