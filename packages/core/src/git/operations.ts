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
 * Get all local branch names, sorted alphabetically.
 */
export async function getBranches(cwd?: string): Promise<string[]> {
  const output = await execGit(["branch", "--format=%(refname:short)"], cwd);
  if (!output.trim()) {
    return [];
  }
  return output
    .split("\n")
    .map((b) => b.trim())
    .filter(Boolean)
    .sort();
}

/**
 * Detect the default branch (main or master).
 *
 * Checks in order:
 * 1. Local "main" branch exists
 * 2. Local "master" branch exists
 * 3. Remote default branch via `git remote show origin`
 *
 * Throws if no default branch can be determined.
 */
export async function getDefaultBranch(cwd?: string): Promise<string> {
  // Check if "main" exists locally
  try {
    await execGit(["show-ref", "--verify", "--quiet", "refs/heads/main"], cwd);
    return "main";
  } catch {
    // main doesn't exist
  }

  // Check if "master" exists locally
  try {
    await execGit(["show-ref", "--verify", "--quiet", "refs/heads/master"], cwd);
    return "master";
  } catch {
    // master doesn't exist
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
      "No 'main' or 'master' branch found locally, and could not detect from remote. " +
      "Use --base <branch> to specify explicitly.",
  );
}
