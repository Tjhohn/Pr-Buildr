import { Command } from "commander";
import {
  getRepoRoot,
  getCurrentBranch,
  saveBase,
} from "@pr-buildr/core";
import * as display from "../display.js";

/**
 * pr-buildr set-base <branch>
 *
 * Save the base branch for the current branch in .pr-builder.json.
 */
export const setBaseCommand = new Command("set-base")
  .description("Set the base branch for the current branch")
  .argument("<branch>", "The base branch to set")
  .action(async (branch: string) => {
    try {
      const repoRoot = await getRepoRoot();
      const currentBranch = await getCurrentBranch();

      await saveBase(repoRoot, currentBranch, branch);

      display.success(`Base branch for "${currentBranch}" set to "${branch}".`);
    } catch (err: unknown) {
      if (err instanceof Error) {
        display.error(err.message);
      } else {
        display.error(String(err));
      }
      process.exit(1);
    }
  });
