/**
 * Resolve the GitHub token for API authentication.
 *
 * Resolution order:
 * 1. Explicit override (e.g., from VS Code extension)
 * 2. GITHUB_TOKEN env var
 * 3. GH_TOKEN env var (used by GitHub CLI)
 *
 * Throws with a helpful message if no token is found.
 */
export function getGitHubToken(override?: string): string {
  if (override) {
    return override;
  }

  const githubToken = process.env["GITHUB_TOKEN"];
  if (githubToken) {
    return githubToken;
  }

  const ghToken = process.env["GH_TOKEN"];
  if (ghToken) {
    return ghToken;
  }

  throw new Error(
    "GitHub token not found. Set one of the following:\n" +
      "  - GITHUB_TOKEN environment variable\n" +
      "  - GH_TOKEN environment variable\n" +
      "  - pr-buildr.githubToken setting (VS Code)\n\n" +
      "Create a token at https://github.com/settings/tokens with the 'repo' scope.",
  );
}
