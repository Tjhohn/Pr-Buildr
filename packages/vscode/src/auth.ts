/**
 * GitHub authentication for the VS Code extension.
 *
 * Resolution order:
 * 1. VS Code built-in GitHub auth (vscode.authentication)
 * 2. pr-buildr.githubToken setting
 * 3. GITHUB_TOKEN env var
 */
export async function getVSCodeGitHubToken(): Promise<string> {
  // Stub — implementation in Phase 5
  throw new Error("VS Code auth not yet implemented");
}
