/**
 * Interactive prompts for the CLI using @inquirer/prompts.
 */

/**
 * Prompt the user to confirm PR creation.
 */
export async function confirmCreate(_draft: boolean): Promise<"create" | "draft" | "edit" | "cancel"> {
  // Stub — implementation in Phase 4
  return "cancel";
}

/**
 * Prompt the user to select a base branch.
 */
export async function selectBaseBranch(_branches: string[], _current?: string): Promise<string> {
  // Stub — implementation in Phase 4
  return "main";
}
