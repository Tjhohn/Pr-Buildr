import { Command } from "commander";

/**
 * pr-buildr create
 *
 * Main flow: resolve repo → resolve base → load template →
 * generate draft → open editor → confirm → create PR
 */
export const createCommand = new Command("create")
  .description("Generate and create a pull request")
  .option("--base <branch>", "Base branch for the PR")
  .option("--provider <name>", "AI provider to use")
  .option("--model <name>", "AI model to use")
  .option("--draft", "Create as draft PR")
  .option("--yes", "Skip confirmation prompt")
  .option("--title <title>", "PR title (skip AI generation for title)")
  .option("--body-file <path>", "Read PR body from file")
  .option("--no-ai", "Skip AI generation entirely")
  .action(async (_options) => {
    // Stub — implementation in Phase 4
    console.log("pr-buildr create — not yet implemented");
  });
