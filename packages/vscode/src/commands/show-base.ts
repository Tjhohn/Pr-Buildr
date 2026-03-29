import * as vscode from "vscode";
import {
  getRepoRoot,
  getCurrentBranch,
  resolveConfig,
  resolveBaseBranch,
  getBase,
} from "@pr-buildr/core";

/**
 * Command: PR Builder: Show Base Branch
 *
 * Displays the resolved base branch for the current branch with its source.
 */
export async function showBaseCommand(): Promise<void> {
  const folder = vscode.workspace.workspaceFolders?.[0]?.uri.fsPath;
  if (!folder) {
    vscode.window.showErrorMessage("Open a folder to use PR Builder.");
    return;
  }

  try {
    const repoRoot = await getRepoRoot(folder);
    const currentBranch = await getCurrentBranch(repoRoot);
    const config = await resolveConfig(repoRoot);
    const resolvedBase = await resolveBaseBranch(currentBranch, config);
    const savedBase = await getBase(repoRoot, currentBranch);

    let source: string;
    if (savedBase) {
      source = "saved in .pr-builder.json";
    } else if (config.defaultBase && resolvedBase === config.defaultBase) {
      source = "config default";
    } else {
      source = "auto-detected";
    }

    vscode.window.showInformationMessage(
      `Base for "${currentBranch}": ${resolvedBase} (${source})`,
    );
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : String(err);
    vscode.window.showErrorMessage(`PR Builder: ${msg}`);
  }
}
