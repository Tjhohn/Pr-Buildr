import { Command } from "commander";

const program = new Command();

program
  .name("pr-buildr")
  .description("AI-powered pull request builder")
  .version("0.1.0");

// Commands will be registered here in Phase 4
// program.addCommand(createCommand);
// program.addCommand(setBaseCommand);
// program.addCommand(showBaseCommand);
// program.addCommand(clearBaseCommand);
// program.addCommand(configInitCommand);

program.parse();
