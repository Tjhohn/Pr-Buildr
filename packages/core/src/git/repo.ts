import type { GitHubRepoInfo } from "./types.js";

/**
 * Get the root directory of the current git repository.
 */
export async function getRepoRoot(): Promise<string> {
  // Stub — implementation in Phase 2
  return "";
}

/**
 * Get the remote URL for origin.
 */
export async function getRemoteUrl(): Promise<string> {
  // Stub — implementation in Phase 2
  return "";
}

/**
 * Parse a GitHub remote URL into owner/repo.
 * Handles both HTTPS and SSH formats:
 *   https://github.com/owner/repo.git
 *   git@github.com:owner/repo.git
 */
export function parseGitHubRepo(_remoteUrl: string): GitHubRepoInfo {
  // Stub — implementation in Phase 2
  return { owner: "", repo: "" };
}
