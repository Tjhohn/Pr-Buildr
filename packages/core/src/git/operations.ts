import type { Commit, FileSummary } from "./types.js";

/**
 * Get the diff between base and head branches.
 */
export async function getDiff(_base: string, _head: string): Promise<string> {
  // Stub — implementation in Phase 2
  return "";
}

/**
 * Get commit log between base and head.
 */
export async function getCommitLog(_base: string, _head: string): Promise<Commit[]> {
  // Stub — implementation in Phase 2
  return [];
}

/**
 * Get a summary of changed files between base and head.
 */
export async function getChangedFiles(_base: string, _head: string): Promise<FileSummary[]> {
  // Stub — implementation in Phase 2
  return [];
}

/**
 * Get the current branch name.
 */
export async function getCurrentBranch(): Promise<string> {
  // Stub — implementation in Phase 2
  return "";
}

/**
 * Get all local branches.
 */
export async function getBranches(): Promise<string[]> {
  // Stub — implementation in Phase 2
  return [];
}
