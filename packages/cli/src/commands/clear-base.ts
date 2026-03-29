import { Command } from "commander";
import {
  getRepoRoot,
  getCurrentBranch,
  clearBase,
  getBase,
} from "@pr-buildr/core";
import * as display from "../display.js";

/**
 * pr-buildr clear-base
 *
 * Remove the saved base branch for the current branch.
 */
export const clearBaseCommand = new Command("clear-base")
  .description("Clear the saved base branch for the current branch")
  .action(async () => {
    try {
      const repoRoot = await getRepoRoot();
      const currentBranch = await getCurrentBranch();

      const existing = await getBase(repoRoot, currentBranch);
      if (!existing) {
        display.warn(`No saved base branch for "${currentBranch}".`);
        return;
      }

      await clearBase(repoRoot, currentBranch);
      display.success(`Cleared saved base branch for "${currentBranch}" (was "${existing}").`);
    } catch (err: unknown) {
      if (err instanceof Error) {
        display.error(err.message);
      } else {
        display.error(String(err));
      }
      process.exit(1);
    }
  });
