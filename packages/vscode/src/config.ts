import * as vscode from "vscode";

/**
 * Read VS Code extension settings and return non-empty values as config overrides.
 * These are merged on top of the core resolveConfig() result.
 */
export function getVSCodeConfig(): {
  provider?: string;
  model?: string;
  ollamaBaseUrl?: string;
  openaiCompatibleBaseUrl?: string;
} {
  const config = vscode.workspace.getConfiguration("pr-buildr");

  const provider = config.get<string>("defaultProvider");
  const model = config.get<string>("defaultModel");
  const ollamaBaseUrl = config.get<string>("ollamaBaseUrl");
  const openaiCompatibleBaseUrl = config.get<string>("openaiCompatibleBaseUrl");

  return {
    ...(provider ? { provider } : {}),
    ...(model ? { model } : {}),
    ...(ollamaBaseUrl ? { ollamaBaseUrl } : {}),
    ...(openaiCompatibleBaseUrl ? { openaiCompatibleBaseUrl } : {}),
  };
}
