import { Command } from "commander";

/**
 * pr-buildr set-base <branch>
 *
 * Save the base branch for the current branch in .pr-builder.json
 */
export const setBaseCommand = new Command("set-base")
  .description("Set the base branch for the current branch")
  .argument("<branch>", "The base branch to set")
  .action(async (_branch) => {
    // Stub — implementation in Phase 4
    console.log("pr-buildr set-base — not yet implemented");
  });
