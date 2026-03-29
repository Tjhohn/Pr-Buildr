import { readFile, writeFile } from "node:fs/promises";
import { join } from "node:path";
import type { PrBuildrConfig } from "./schema.js";
import { CONFIG_FILENAME } from "./schema.js";

/**
 * Read the .pr-builder.json config file from the given directory.
 * Returns an empty config object if the file does not exist.
 * Throws with a helpful message if the file exists but contains invalid JSON.
 */
export async function readConfigFile(repoRoot: string): Promise<PrBuildrConfig> {
  const filePath = join(repoRoot, CONFIG_FILENAME);

  let raw: string;
  try {
    raw = await readFile(filePath, "utf-8");
  } catch (err: unknown) {
    if (isNodeError(err) && err.code === "ENOENT") {
      return {};
    }
    throw err;
  }

  try {
    return JSON.parse(raw) as PrBuildrConfig;
  } catch {
    throw new Error(
      `Invalid JSON in ${filePath}. Please fix the syntax or delete the file to use defaults.`,
    );
  }
}

/**
 * Write the config object to .pr-builder.json in the given directory.
 * Creates the file if it does not exist. Overwrites if it does.
 */
export async function writeConfigFile(
  repoRoot: string,
  config: PrBuildrConfig,
): Promise<void> {
  const filePath = join(repoRoot, CONFIG_FILENAME);
  const content = JSON.stringify(config, null, 2) + "\n";
  await writeFile(filePath, content, "utf-8");
}

function isNodeError(err: unknown): err is NodeJS.ErrnoException {
  return err instanceof Error && "code" in err;
}
