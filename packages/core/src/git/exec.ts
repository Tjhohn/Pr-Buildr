import { execFile } from "node:child_process";
import { GitError } from "./types.js";

/**
 * Execute a git command and return stdout.
 *
 * Uses child_process.execFile (not exec) to avoid shell injection.
 * Throws GitError on non-zero exit code.
 */
export async function execGit(args: string[], cwd?: string): Promise<string> {
  return new Promise((resolve, reject) => {
    execFile(
      "git",
      args,
      {
        cwd: cwd ?? process.cwd(),
        maxBuffer: 10 * 1024 * 1024, // 10 MB — large diffs
        encoding: "utf-8",
      },
      (error, stdout, stderr) => {
        if (error) {
          const exitCode = error.code != null ? Number(error.code) : 1;
          reject(
            new GitError(
              `git ${args.join(" ")} failed: ${stderr.trim() || error.message}`,
              `git ${args.join(" ")}`,
              exitCode,
              stderr.trim(),
            ),
          );
          return;
        }
        resolve(stdout.trimEnd());
      },
    );
  });
}
