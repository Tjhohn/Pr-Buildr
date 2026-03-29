/**
 * Save a base branch mapping for a branch in .pr-builder.json.
 */
export async function saveBase(_repoRoot: string, _branch: string, _base: string): Promise<void> {
  // Stub — implementation in Phase 2
}

/**
 * Get the saved base branch for a given branch.
 */
export async function getBase(_repoRoot: string, _branch: string): Promise<string | undefined> {
  // Stub — implementation in Phase 2
  return undefined;
}

/**
 * Clear the saved base branch for a given branch.
 */
export async function clearBase(_repoRoot: string, _branch: string): Promise<void> {
  // Stub — implementation in Phase 2
}
