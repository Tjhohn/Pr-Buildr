import type { PrBuildrConfig } from "./schema.js";
import { VALID_PROVIDERS } from "./schema.js";
import { defaultConfig } from "./defaults.js";
import { readConfigFile } from "./file.js";
import { getRepoRoot } from "../git/repo.js";

/**
 * Resolve the full config by merging:
 * 1. .pr-builder.json (repo root)
 * 2. env var overrides
 * 3. defaults
 *
 * Returns a frozen config object.
 */
export async function resolveConfig(repoRoot?: string): Promise<PrBuildrConfig> {
  const root = repoRoot ?? (await getRepoRoot());
  const fileConfig = await readConfigFile(root);
  const merged = deepMerge(defaultConfig, fileConfig);
  applyEnvOverrides(merged);
  validateConfig(merged);
  return Object.freeze(merged);
}

/**
 * Apply environment variable overrides to the config.
 */
function applyEnvOverrides(config: PrBuildrConfig): void {
  const provider = process.env["PR_BUILDR_PROVIDER"];
  if (provider) {
    config.ai = config.ai ?? {};
    config.ai.provider = provider;
  }

  const model = process.env["PR_BUILDR_MODEL"];
  if (model) {
    config.ai = config.ai ?? {};
    config.ai.model = model;
  }

  const defaultBase = process.env["PR_BUILDR_DEFAULT_BASE"];
  if (defaultBase) {
    config.defaultBase = defaultBase;
  }
}

/**
 * Validate the config and throw on invalid values.
 */
function validateConfig(config: PrBuildrConfig): void {
  if (config.ai?.provider) {
    const valid = VALID_PROVIDERS as readonly string[];
    if (!valid.includes(config.ai.provider)) {
      throw new Error(
        `Invalid AI provider "${config.ai.provider}". ` +
          `Valid providers: ${VALID_PROVIDERS.join(", ")}`,
      );
    }
  }
}

/**
 * Deep merge source into target. Returns a new object.
 * - Plain objects are merged recursively.
 * - Arrays and primitives from source overwrite target.
 * - undefined values in source do not overwrite target.
 */
function deepMerge(target: PrBuildrConfig, source: PrBuildrConfig): PrBuildrConfig {
  const result = { ...target };

  for (const key of Object.keys(source) as Array<keyof PrBuildrConfig>) {
    const sourceVal = source[key];
    const targetVal = target[key];

    if (sourceVal === undefined) {
      continue;
    }

    if (
      isPlainObject(sourceVal) &&
      isPlainObject(targetVal)
    ) {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      (result as any)[key] = deepMerge(targetVal as any, sourceVal as any);
    } else {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      (result as any)[key] = sourceVal;
    }
  }

  return result;
}

function isPlainObject(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}
