import type { CreatePRParams, PRResult } from "./types.js";

/**
 * Create a pull request via the GitHub REST API.
 * POST /repos/{owner}/{repo}/pulls
 */
export async function createPullRequest(_params: CreatePRParams): Promise<PRResult> {
  // Stub — implementation in Phase 3
  throw new Error("GitHub API not yet implemented");
}
