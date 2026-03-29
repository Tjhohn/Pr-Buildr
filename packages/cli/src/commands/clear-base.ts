import { Command } from "commander";

/**
 * pr-buildr clear-base
 *
 * Remove the saved base branch for the current branch.
 */
export const clearBaseCommand = new Command("clear-base")
  .description("Clear the saved base branch for the current branch")
  .action(async () => {
    // Stub — implementation in Phase 4
    console.log("pr-buildr clear-base — not yet implemented");
  });
