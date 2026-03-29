import * as vscode from "vscode";
import { regenerate, isPanelOpen } from "../webview/panel.js";

/**
 * Command: PR Builder: Regenerate Draft
 *
 * Triggers re-generation of the PR draft on the active webview panel.
 */
export async function regenerateCommand(): Promise<void> {
  if (!isPanelOpen()) {
    vscode.window.showWarningMessage(
      'Open "Create Pull Request" first to regenerate a draft.',
    );
    return;
  }

  regenerate();
}
