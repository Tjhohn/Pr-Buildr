import * as vscode from "vscode";
import { createPRCommand } from "./commands/create-pr.js";
import { setBaseCommand } from "./commands/set-base.js";
import { showBaseCommand } from "./commands/show-base.js";
import { clearBaseCommand } from "./commands/clear-base.js";
import { regenerateCommand } from "./commands/regenerate.js";
import {
  setOpenAIKeyCommand,
  setAnthropicKeyCommand,
  setOpenAICompatibleKeyCommand,
} from "./commands/set-api-key.js";

export function activate(context: vscode.ExtensionContext) {
  try {
    console.log("PR Buildr: activating extension...");

    // Status bar item — always visible, opens Create PR webview
    const statusBarItem = vscode.window.createStatusBarItem(
      vscode.StatusBarAlignment.Left,
      50,
    );
    statusBarItem.text = "$(git-pull-request) PR Buildr";
    statusBarItem.command = "pr-buildr.createPR";
    statusBarItem.tooltip = "Create Pull Request";
    statusBarItem.show();
    context.subscriptions.push(statusBarItem);

    // Register commands
    context.subscriptions.push(
      // Core commands
      vscode.commands.registerCommand("pr-buildr.createPR", () =>
        createPRCommand(context),
      ),
      vscode.commands.registerCommand("pr-buildr.setBase", () =>
        setBaseCommand(),
      ),
      vscode.commands.registerCommand("pr-buildr.showBase", () =>
        showBaseCommand(),
      ),
      vscode.commands.registerCommand("pr-buildr.clearBase", () =>
        clearBaseCommand(),
      ),
      vscode.commands.registerCommand("pr-buildr.regenerate", () =>
        regenerateCommand(),
      ),

      // API key management commands
      vscode.commands.registerCommand("pr-buildr.setOpenAIKey", () =>
        setOpenAIKeyCommand(context.secrets),
      ),
      vscode.commands.registerCommand("pr-buildr.setAnthropicKey", () =>
        setAnthropicKeyCommand(context.secrets),
      ),
      vscode.commands.registerCommand("pr-buildr.setOpenAICompatibleKey", () =>
        setOpenAICompatibleKeyCommand(context.secrets),
      ),
    );

    console.log("PR Buildr: activated successfully — 8 commands registered");
  } catch (err) {
    console.error("PR Buildr: activation FAILED", err);
    throw err;
  }
}

export function deactivate() {
  console.log("PR Buildr: deactivated");
}
