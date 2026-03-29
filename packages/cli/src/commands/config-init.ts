import { Command } from "commander";

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
        // Stub — implementation in Phase 4
        console.log("pr-buildr config init — not yet implemented");
      }),
  );
