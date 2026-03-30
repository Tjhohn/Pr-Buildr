import * as vscode from "vscode";
import { getRepoRoot } from "@pr-buildr/core";
import { createOrShow } from "../webview/panel.js";

/**
 * Command: PR Builder: Create Pull Request
 *
 * Detects the workspace git repo and opens the PR Buildr webview panel.
 */
export async function createPRCommand(
  context: vscode.ExtensionContext,
): Promise<void> {
  const folder = getWorkspaceFolder();
  if (!folder) {
    vscode.window.showErrorMessage(
      "Open a folder to use PR Buildr.",
    );
    return;
  }

  try {
    const repoRoot = await getRepoRoot(folder);
    createOrShow(context, repoRoot);
  } catch {
    vscode.window.showErrorMessage(
      "Not a git repository. Open a git repository to use PR Buildr.",
    );
  }
}

/**
 * Get the first workspace folder path.
 */
function getWorkspaceFolder(): string | undefined {
  const folders = vscode.workspace.workspaceFolders;
  if (!folders || folders.length === 0) return undefined;
  return folders[0]!.uri.fsPath;
}
