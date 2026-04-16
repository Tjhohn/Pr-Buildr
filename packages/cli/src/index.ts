import { Command } from "commander";
import { createCommand } from "./commands/create.js";
import { setBaseCommand } from "./commands/set-base.js";
import { showBaseCommand } from "./commands/show-base.js";
import { clearBaseCommand } from "./commands/clear-base.js";
import { configInitCommand } from "./commands/config-init.js";

const program = new Command();

program
  .name("pr-buildr")
  .description("AI-powered pull request builder — generate PR titles and bodies from git diffs")
  .version("0.2.1");

program.addCommand(createCommand);
program.addCommand(setBaseCommand);
program.addCommand(showBaseCommand);
program.addCommand(clearBaseCommand);
program.addCommand(configInitCommand);

// Default to create if no command is specified
program.action(() => {
  program.help();
});

program.parse();
