import * as vscode from "vscode";
import {
  getRepoRoot,
  getCurrentBranch,
  getBranches,
  saveBase,
} from "@pr-buildr/core";

/**
 * Command: PR Builder: Set Base Branch
 *
 * Shows a quick pick with local branches and saves the selection
 * as the base branch for the current branch.
 */
export async function setBaseCommand(): Promise<void> {
  const folder = vscode.workspace.workspaceFolders?.[0]?.uri.fsPath;
  if (!folder) {
    vscode.window.showErrorMessage("Open a folder to use PR Builder.");
    return;
  }

  try {
    const repoRoot = await getRepoRoot(folder);
    const currentBranch = await getCurrentBranch(repoRoot);
    const branches = await getBranches(repoRoot);

    const selected = await vscode.window.showQuickPick(branches, {
      placeHolder: `Select base branch for "${currentBranch}"`,
    });

    if (!selected) return;

    await saveBase(repoRoot, currentBranch, selected);
    vscode.window.showInformationMessage(
      `Base branch for "${currentBranch}" set to "${selected}".`,
    );
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : String(err);
    vscode.window.showErrorMessage(`PR Builder: ${msg}`);
  }
}
