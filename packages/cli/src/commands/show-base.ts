import { Command } from "commander";

/**
 * pr-buildr show-base
 *
 * Display the resolved base branch for the current branch.
 */
export const showBaseCommand = new Command("show-base")
  .description("Show the base branch for the current branch")
  .action(async () => {
    // Stub — implementation in Phase 4
    console.log("pr-buildr show-base — not yet implemented");
  });
