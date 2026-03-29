import type { GitHubRepoInfo } from "./types.js";
import { execGit } from "./exec.js";

/**
 * Get the root directory of the current git repository.
 * Throws GitError if not inside a git repo.
 */
export async function getRepoRoot(cwd?: string): Promise<string> {
  return execGit(["rev-parse", "--show-toplevel"], cwd);
}

/**
 * Get the remote URL for a given remote (defaults to "origin").
 * Throws GitError if the remote is not configured.
 */
export async function getRemoteUrl(remote = "origin", cwd?: string): Promise<string> {
  return execGit(["remote", "get-url", remote], cwd);
}

// Patterns for GitHub remote URLs
const HTTPS_PATTERN = /^https?:\/\/github\.com\/([^/]+)\/([^/]+?)(?:\.git)?$/;
const SSH_PATTERN = /^git@github\.com:([^/]+)\/([^/]+?)(?:\.git)?$/;
const SSH_PROTOCOL_PATTERN = /^ssh:\/\/git@github\.com\/([^/]+)\/([^/]+?)(?:\.git)?$/;

/**
 * Parse a GitHub remote URL into owner and repo.
 *
 * Supported formats:
 *   https://github.com/owner/repo.git
 *   https://github.com/owner/repo
 *   git@github.com:owner/repo.git
 *   git@github.com:owner/repo
 *   ssh://git@github.com/owner/repo.git
 *
 * Throws if the URL does not match any known GitHub pattern.
 */
export function parseGitHubRepo(remoteUrl: string): GitHubRepoInfo {
  const trimmed = remoteUrl.trim();

  for (const pattern of [HTTPS_PATTERN, SSH_PATTERN, SSH_PROTOCOL_PATTERN]) {
    const match = trimmed.match(pattern);
    if (match?.[1] && match[2]) {
      return { owner: match[1], repo: match[2] };
    }
  }

  throw new Error(
    `Could not parse GitHub owner/repo from remote URL: "${trimmed}". ` +
      `Expected a GitHub URL like https://github.com/owner/repo.git or git@github.com:owner/repo.git`,
  );
}
