import chalk from "chalk";

/**
 * Display a labeled info line.
 */
export function info(label: string, value: string): void {
  console.log(`${chalk.dim(label + ":")} ${value}`);
}

/**
 * Display a section header.
 */
export function header(text: string): void {
  console.log();
  console.log(chalk.bold.underline(text));
  console.log();
}

/**
 * Display the generated PR draft in the terminal.
 */
export function displayDraft(title: string, body: string): void {
  header("Generated PR Draft");
  console.log(chalk.bold("Title: ") + chalk.cyan(title));
  console.log();
  console.log(chalk.dim("─".repeat(60)));
  console.log(body);
  console.log(chalk.dim("─".repeat(60)));
}

/**
 * Display the PR creation result.
 */
export function displayResult(url: string, number: number, draft: boolean): void {
  console.log();
  if (draft) {
    console.log(chalk.green(`Draft PR #${number} created successfully!`));
  } else {
    console.log(chalk.green(`PR #${number} created successfully!`));
  }
  console.log(chalk.cyan(url));
  console.log();
}

/**
 * Display a warning message.
 */
export function warn(message: string): void {
  console.log(chalk.yellow(`Warning: ${message}`));
}

/**
 * Display an error message.
 */
export function error(message: string): void {
  console.error(chalk.red(`Error: ${message}`));
}

/**
 * Display a success message.
 */
export function success(message: string): void {
  console.log(chalk.green(message));
}
