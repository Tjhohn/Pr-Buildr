import { Command } from "commander";
import { access } from "node:fs/promises";
import { join } from "node:path";
import {
  getRepoRoot,
  writeConfigFile,
  CONFIG_FILENAME,
} from "@pr-buildr/core";
import type { PrBuildrConfig } from "@pr-buildr/core";
import * as display from "../display.js";
import {
  promptConfirm,
  promptInput,
  promptSelectProvider,
} from "../prompts.js";

/**
 * pr-buildr config init
 *
 * Interactively create a .pr-builder.json config file.
 */
export const configInitCommand = new Command("config")
  .description("Configuration management")
  .addCommand(
    new Command("init")
      .description("Create a .pr-builder.json config file")
      .action(async () => {
        try {
          await runConfigInit();
        } catch (err: unknown) {
          if (err instanceof Error) {
            display.error(err.message);
          } else {
            display.error(String(err));
          }
          process.exit(1);
        }
      }),
  );

async function runConfigInit(): Promise<void> {
  const repoRoot = await getRepoRoot();
  const configPath = join(repoRoot, CONFIG_FILENAME);

  // Check if config already exists
  try {
    await access(configPath);
    const overwrite = await promptConfirm(
      `${CONFIG_FILENAME} already exists. Overwrite?`,
    );
    if (!overwrite) {
      display.warn("Config creation cancelled.");
      return;
    }
  } catch {
    // File doesn't exist — good to go
  }

  // Interactive prompts
  const defaultBase = await promptInput(
    "Default base branch:",
    "main",
  );

  const provider = await promptSelectProvider();

  const model = await promptInput(
    "Default AI model (leave empty for provider default):",
    "",
  );

  const draftByDefault = await promptConfirm("Create draft PRs by default?");

  // Jira integration
  const jiraUrl = await promptInput(
    "Jira project URL (or press Enter to skip):",
    "",
  );

  let jiraKey = "";
  let jiraEnabled: boolean | undefined;

  if (jiraUrl.trim()) {
    jiraKey = await promptInput(
      "Jira project key (e.g., AA, PRD, DATATEAM):",
      "",
    );
  } else {
    const disableJira = await promptConfirm("Disable Jira ticket detection?");
    if (disableJira) {
      jiraEnabled = false;
    }
  }

  // Build config
  const config: PrBuildrConfig = {
    defaultBase,
    ai: {
      provider,
      ...(model ? { model } : {}),
    },
    github: {
      draftByDefault,
    },
    ...(jiraUrl.trim() || jiraKey.trim() || jiraEnabled === false
      ? {
          jira: {
            ...(jiraEnabled === false ? { enabled: false } : {}),
            ...(jiraUrl.trim() ? { projectUrl: jiraUrl.trim() } : {}),
            ...(jiraKey.trim() ? { projectKey: jiraKey.trim() } : {}),
          },
        }
      : {}),
  };

  await writeConfigFile(repoRoot, config);

  display.success(`Created ${CONFIG_FILENAME} in ${repoRoot}`);
  console.log();
  console.log(JSON.stringify(config, null, 2));
}
