import { select, confirm, input } from "@inquirer/prompts";

/**
 * Prompt the user to decide what to do with the generated draft.
 */
export async function promptCreateAction(
  draftByDefault: boolean,
): Promise<"create" | "draft" | "edit" | "cancel"> {
  const result = await select({
    message: "What would you like to do?",
    choices: [
      {
        name: draftByDefault ? "Create draft PR" : "Create PR",
        value: draftByDefault ? "draft" : "create",
      },
      {
        name: draftByDefault ? "Create PR (not draft)" : "Create as draft PR",
        value: draftByDefault ? "create" : "draft",
      },
      { name: "Edit in editor", value: "edit" },
      { name: "Cancel", value: "cancel" },
    ],
  });

  return result as "create" | "draft" | "edit" | "cancel";
}

/**
 * Prompt the user to select a base branch from a list.
 */
export async function promptSelectBase(
  branches: string[],
  current?: string,
): Promise<string> {
  const choices = branches.map((b) => ({
    name: b === current ? `${b} (current)` : b,
    value: b,
  }));

  return select({
    message: "Select base branch:",
    choices,
    default: current,
  });
}

/**
 * Prompt for confirmation.
 */
export async function promptConfirm(message: string): Promise<boolean> {
  return confirm({ message, default: true });
}

/**
 * Prompt for a text input.
 */
export async function promptInput(message: string, defaultValue?: string): Promise<string> {
  return input({ message, default: defaultValue });
}

/**
 * Prompt to select an AI provider.
 */
export async function promptSelectProvider(): Promise<string> {
  return select({
    message: "Select AI provider:",
    choices: [
      { name: "OpenAI", value: "openai" },
      { name: "Anthropic", value: "anthropic" },
      { name: "Ollama (local)", value: "ollama" },
      { name: "OpenAI-compatible", value: "openai-compatible" },
    ],
  });
}
