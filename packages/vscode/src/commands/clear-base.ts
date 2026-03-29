import * as vscode from "vscode";
import {
  getRepoRoot,
  getCurrentBranch,
  getBase,
  clearBase,
} from "@pr-buildr/core";

/**
 * Command: PR Builder: Clear Base Branch
 *
 * Removes the saved base branch for the current branch.
 */
export async function clearBaseCommand(): Promise<void> {
  const folder = vscode.workspace.workspaceFolders?.[0]?.uri.fsPath;
  if (!folder) {
    vscode.window.showErrorMessage("Open a folder to use PR Builder.");
    return;
  }

  try {
    const repoRoot = await getRepoRoot(folder);
    const currentBranch = await getCurrentBranch(repoRoot);
    const existing = await getBase(repoRoot, currentBranch);

    if (!existing) {
      vscode.window.showWarningMessage(
        `No saved base branch for "${currentBranch}".`,
      );
      return;
    }

    await clearBase(repoRoot, currentBranch);
    vscode.window.showInformationMessage(
      `Cleared base branch for "${currentBranch}" (was "${existing}").`,
    );
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : String(err);
    vscode.window.showErrorMessage(`PR Builder: ${msg}`);
  }
}
