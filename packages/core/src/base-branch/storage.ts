import { readConfigFile, writeConfigFile } from "../config/file.js";

/**
 * Save a base branch mapping for a branch in .pr-builder.json.
 */
export async function saveBase(
  repoRoot: string,
  branch: string,
  base: string,
): Promise<void> {
  const config = await readConfigFile(repoRoot);
  config.branchBases = config.branchBases ?? {};
  config.branchBases[branch] = base;
  await writeConfigFile(repoRoot, config);
}

/**
 * Get the saved base branch for a given branch.
 * Returns undefined if no base is saved.
 */
export async function getBase(
  repoRoot: string,
  branch: string,
): Promise<string | undefined> {
  const config = await readConfigFile(repoRoot);
  return config.branchBases?.[branch];
}

/**
 * Clear the saved base branch for a given branch.
 * Removes the entry from branchBases. Cleans up empty branchBases object.
 */
export async function clearBase(
  repoRoot: string,
  branch: string,
): Promise<void> {
  const config = await readConfigFile(repoRoot);

  if (!config.branchBases?.[branch]) {
    return; // Nothing to clear
  }

  delete config.branchBases[branch];

  // Clean up empty branchBases object
  if (Object.keys(config.branchBases).length === 0) {
    delete config.branchBases;
  }

  await writeConfigFile(repoRoot, config);
}
