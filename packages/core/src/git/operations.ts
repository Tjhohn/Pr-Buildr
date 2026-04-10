import type { Commit, FileSummary } from "./types.js";
import { execGit } from "./exec.js";

const COMMIT_SEPARATOR = "---COMMIT_SEPARATOR---";

/**
 * Get the diff between base and head branches.
 * Uses three-dot diff (changes on head since divergence from base).
 */
export async function getDiff(base: string, head: string, cwd?: string): Promise<string> {
  try {
    return await execGit(["diff", `${base}...${head}`], cwd);
  } catch {
    // If three-dot fails (e.g. no common ancestor), try two-dot
    return execGit(["diff", `${base}..${head}`], cwd);
  }
}

/**
 * Get commit log between base and head.
 * Returns commits in reverse chronological order (newest first).
 */
export async function getCommitLog(base: string, head: string, cwd?: string): Promise<Commit[]> {
  const format = [`%H`, `%s`, `%b`, `%an`, `%aI`, COMMIT_SEPARATOR].join("%n");

  let output: string;
  try {
    output = await execGit(["log", `${base}..${head}`, `--format=${format}`], cwd);
  } catch {
    return [];
  }

  if (!output.trim()) {
    return [];
  }

  const rawCommits = output.split(COMMIT_SEPARATOR).filter((c) => c.trim());
  const commits: Commit[] = [];

  for (const raw of rawCommits) {
    const lines = raw.trim().split("\n");
    if (lines.length >= 5) {
      commits.push({
        hash: lines[0]!.trim(),
        subject: lines[1]!.trim(),
        body: lines.slice(2, -2).join("\n").trim(),
        author: lines[lines.length - 2]!.trim(),
        date: lines[lines.length - 1]!.trim(),
      });
    }
  }

  return commits;
}

/**
 * Get a summary of changed files between base and head.
 */
export async function getChangedFiles(
  base: string,
  head: string,
  cwd?: string,
): Promise<FileSummary[]> {
  // Get addition/deletion counts
  let numstatOutput: string;
  try {
    numstatOutput = await execGit(["diff", "--numstat", `${base}...${head}`], cwd);
  } catch {
    numstatOutput = await execGit(["diff", "--numstat", `${base}..${head}`], cwd);
  }

  // Get file statuses (A=added, M=modified, D=deleted, R=renamed)
  let nameStatusOutput: string;
  try {
    nameStatusOutput = await execGit(["diff", "--name-status", `${base}...${head}`], cwd);
  } catch {
    nameStatusOutput = await execGit(["diff", "--name-status", `${base}..${head}`], cwd);
  }

  if (!numstatOutput.trim()) {
    return [];
  }

  // Parse --name-status into a map: path → status
  const statusMap = new Map<string, { status: string; oldPath?: string }>();
  for (const line of nameStatusOutput.split("\n")) {
    const trimmed = line.trim();
    if (!trimmed) continue;

    // Rename lines look like: R100\told-path\tnew-path
    const renameMatch = trimmed.match(/^R\d*\t(.+)\t(.+)$/);
    if (renameMatch?.[1] && renameMatch[2]) {
      statusMap.set(renameMatch[2], { status: "R", oldPath: renameMatch[1] });
      continue;
    }

    const parts = trimmed.split("\t");
    if (parts.length >= 2 && parts[0] && parts[1]) {
      statusMap.set(parts[1], { status: parts[0] });
    }
  }

  // Parse --numstat and merge with status
  const files: FileSummary[] = [];
  for (const line of numstatOutput.split("\n")) {
    const trimmed = line.trim();
    if (!trimmed) continue;

    const parts = trimmed.split("\t");
    if (parts.length < 3) continue;

    // Binary files show "-" for additions/deletions
    const additions = parts[0] === "-" ? 0 : Number(parts[0]);
    const deletions = parts[1] === "-" ? 0 : Number(parts[1]);
    const path = parts.slice(2).join("\t"); // Path might contain tabs (rare)

    const statusInfo = statusMap.get(path);
    const status = parseFileStatus(statusInfo?.status);

    files.push({
      path,
      additions,
      deletions,
      status,
      ...(statusInfo?.oldPath ? { oldPath: statusInfo.oldPath } : {}),
    });
  }

  return files;
}

function parseFileStatus(raw?: string): FileSummary["status"] {
  switch (raw) {
    case "A":
      return "added";
    case "D":
      return "deleted";
    case "R":
      return "renamed";
    case "M":
    default:
      return "modified";
  }
}

/**
 * Get the current branch name.
 * Throws if in detached HEAD state.
 */
export async function getCurrentBranch(cwd?: string): Promise<string> {
  const branch = await execGit(["branch", "--show-current"], cwd);
  if (!branch) {
    throw new Error(
      "Not on a branch (detached HEAD state). Please checkout a branch before creating a PR.",
    );
  }
  return branch;
}

/**
 * Get branch names with prioritized ordering.
 *
 * Returns branches in this order:
 * 1. origin/main (if exists)
 * 2. origin/master (if exists)
 * 3. main (if exists locally)
 * 4. master (if exists locally)
 * 5. All other local branches, sorted alphabetically
 */
export async function getBranches(cwd?: string): Promise<string[]> {
  const output = await execGit(["branch", "--format=%(refname:short)"], cwd);
  const localBranches = output.trim()
    ? output
        .split("\n")
        .map((b) => b.trim())
        .filter(Boolean)
    : [];

  // Check for remote tracking branches of main/master
  const hasOriginMain = await refExists("refs/remotes/origin/main", cwd);
  const hasOriginMaster = await refExists("refs/remotes/origin/master", cwd);

  // Separate prioritized branches from the rest
  const prioritized: string[] = [];
  if (hasOriginMain) prioritized.push("origin/main");
  if (hasOriginMaster) prioritized.push("origin/master");

  const hasLocalMain = localBranches.includes("main");
  const hasLocalMaster = localBranches.includes("master");
  if (hasLocalMain) prioritized.push("main");
  if (hasLocalMaster) prioritized.push("master");

  // Remaining branches sorted alphabetically, excluding already-listed ones
  const prioritizedSet = new Set(prioritized);
  const rest = localBranches.filter((b) => !prioritizedSet.has(b)).sort();

  return [...prioritized, ...rest];
}

/**
 * Check if a git ref exists (e.g. refs/remotes/origin/main).
 */
async function refExists(ref: string, cwd?: string): Promise<boolean> {
  try {
    await execGit(["show-ref", "--verify", "--quiet", ref], cwd);
    return true;
  } catch {
    return false;
  }
}

/**
 * Detect the default branch.
 *
 * Checks in order:
 * 1. Remote tracking "origin/main" exists
 * 2. Remote tracking "origin/master" exists
 * 3. Local "main" branch exists
 * 4. Local "master" branch exists
 * 5. Remote default branch via `git remote show origin`
 *
 * Throws if no default branch can be determined.
 */
export async function getDefaultBranch(cwd?: string): Promise<string> {
  // Check if "origin/main" exists as a remote tracking branch
  if (await refExists("refs/remotes/origin/main", cwd)) {
    return "origin/main";
  }

  // Check if "origin/master" exists as a remote tracking branch
  if (await refExists("refs/remotes/origin/master", cwd)) {
    return "origin/master";
  }

  // Check if "main" exists locally
  if (await refExists("refs/heads/main", cwd)) {
    return "main";
  }

  // Check if "master" exists locally
  if (await refExists("refs/heads/master", cwd)) {
    return "master";
  }

  // Try to detect from remote
  try {
    const output = await execGit(["remote", "show", "origin"], cwd);
    const match = output.match(/HEAD branch:\s*(.+)/);
    if (match?.[1]?.trim()) {
      return match[1].trim();
    }
  } catch {
    // Remote not available
  }

  throw new Error(
    "Could not determine the default branch. " +
      "No 'main' or 'master' branch found locally or on origin, and could not detect from remote. " +
      "Use --base <branch> to specify explicitly.",
  );
}

/**
 * Check if a branch exists on a remote.
 * Returns true if the branch is found on the remote, false otherwise.
 */
export async function hasRemoteBranch(
  branch: string,
  remote = "origin",
  cwd?: string,
): Promise<boolean> {
  try {
    const output = await execGit(["ls-remote", "--heads", remote, branch], cwd);
    return output.trim().length > 0;
  } catch {
    return false;
  }
}

/**
 * Get the number of local commits that have not been pushed to the remote.
 * Returns 0 if the branch has no upstream or on error.
 */
export async function getUnpushedCommitCount(
  branch: string,
  remote = "origin",
  cwd?: string,
): Promise<number> {
  try {
    const output = await execGit(["rev-list", "--count", `${remote}/${branch}..HEAD`], cwd);
    const count = parseInt(output.trim(), 10);
    return isNaN(count) ? 0 : count;
  } catch {
    return 0;
  }
}

/**
 * Get the number of commits between two refs.
 * Runs: git rev-list --count <from>..<to>
 * Returns 0 on error.
 */
export async function getCommitCount(from: string, to: string, cwd?: string): Promise<number> {
  try {
    const output = await execGit(["rev-list", "--count", `${from}..${to}`], cwd);
    const count = parseInt(output.trim(), 10);
    return isNaN(count) ? 0 : count;
  } catch {
    return 0;
  }
}

/**
 * Push a branch to a remote with upstream tracking.
 * Runs: git push -u <remote> <branch>
 */
export async function pushBranch(branch: string, remote = "origin", cwd?: string): Promise<void> {
  await execGit(["push", "-u", remote, branch], cwd);
}
