import { Command } from "commander";
import {
  getRepoRoot,
  getCurrentBranch,
  resolveConfig,
  resolveBaseBranch,
  getBase,
} from "@pr-buildr/core";
import * as display from "../display.js";

/**
 * pr-buildr show-base
 *
 * Display the resolved base branch for the current branch.
 * Shows the resolution source (saved, config default, or git detection).
 */
export const showBaseCommand = new Command("show-base")
  .description("Show the base branch for the current branch")
  .action(async () => {
    try {
      const repoRoot = await getRepoRoot();
      const currentBranch = await getCurrentBranch();
      const config = await resolveConfig(repoRoot);

      // Check for saved base specifically
      const savedBase = await getBase(repoRoot, currentBranch);

      // Resolve the full chain
      const resolvedBase = await resolveBaseBranch(currentBranch, config);

      display.info("Current branch", currentBranch);
      display.info("Base branch", resolvedBase);

      if (savedBase) {
        display.info("Source", "saved in .pr-builder.json");
      } else if (config.defaultBase && resolvedBase === config.defaultBase) {
        display.info("Source", "config default");
      } else {
        display.info("Source", "auto-detected");
      }
    } catch (err: unknown) {
      if (err instanceof Error) {
        display.error(err.message);
      } else {
        display.error(String(err));
      }
      process.exit(1);
    }
  });
