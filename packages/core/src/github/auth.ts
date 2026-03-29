export interface TokenSource {
  type: "env" | "vscode" | "config";
  value: string;
}

/**
 * Resolve the GitHub token.
 * Checks: GITHUB_TOKEN env var.
 * VS Code and other sources are handled by the consumer.
 */
export function getGitHubToken(): string {
  // Stub — implementation in Phase 3
  const token = process.env["GITHUB_TOKEN"];
  if (!token) {
    throw new Error(
      "GitHub token not found. Set the GITHUB_TOKEN environment variable.",
    );
  }
  return token;
}
