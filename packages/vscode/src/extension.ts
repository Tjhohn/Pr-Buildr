import * as vscode from "vscode";

export function activate(context: vscode.ExtensionContext) {
  // Register commands — implementation in Phase 5
  const createPR = vscode.commands.registerCommand("pr-buildr.createPR", async () => {
    vscode.window.showInformationMessage("PR Builder: Create PR — not yet implemented");
  });

  const setBase = vscode.commands.registerCommand("pr-buildr.setBase", async () => {
    vscode.window.showInformationMessage("PR Builder: Set Base — not yet implemented");
  });

  const showBase = vscode.commands.registerCommand("pr-buildr.showBase", async () => {
    vscode.window.showInformationMessage("PR Builder: Show Base — not yet implemented");
  });

  const clearBase = vscode.commands.registerCommand("pr-buildr.clearBase", async () => {
    vscode.window.showInformationMessage("PR Builder: Clear Base — not yet implemented");
  });

  const regenerate = vscode.commands.registerCommand("pr-buildr.regenerate", async () => {
    vscode.window.showInformationMessage("PR Builder: Regenerate — not yet implemented");
  });

  context.subscriptions.push(createPR, setBase, showBase, clearBase, regenerate);
}

export function deactivate() {
  // Cleanup
}
