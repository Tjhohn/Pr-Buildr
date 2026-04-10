import { describe, it, expect, vi, beforeEach } from "vitest";
import type { ChildProcess } from "node:child_process";

// Mock child_process.execFile before importing modules that use it
vi.mock("node:child_process", () => ({
  execFile: vi.fn(),
}));

import { execFile } from "node:child_process";
import {
  getDiff,
  getCommitLog,
  getChangedFiles,
  getCurrentBranch,
  getBranches,
  getDefaultBranch,
  hasRemoteBranch,
  getUnpushedCommitCount,
  pushBranch,
} from "../../src/git/operations.js";

const mockExecFile = vi.mocked(execFile);

/**
 * Helper to make the mock execFile call the callback with the given stdout.
 */
function mockGitOutput(stdout: string) {
  mockExecFile.mockImplementation((_cmd, _args, _opts, callback) => {
    if (typeof callback === "function") {
      callback(null, stdout, "");
    }
    return {} as ChildProcess;
  });
}

/**
 * Helper to make the mock execFile fail with an error.
 */
function mockGitError(stderr: string, code = 1) {
  mockExecFile.mockImplementation((_cmd, _args, _opts, callback) => {
    if (typeof callback === "function") {
      const error = new Error(stderr) as NodeJS.ErrnoException;
      error.code = String(code);
      callback(error, "", stderr);
    }
    return {} as ChildProcess;
  });
}

beforeEach(() => {
  vi.clearAllMocks();
});

describe("getDiff", () => {
  it("returns diff output between base and head", async () => {
    const diffOutput = "diff --git a/file.ts b/file.ts\n+added line\n-removed line";
    mockGitOutput(diffOutput);

    const result = await getDiff("main", "feature");
    expect(result).toBe(diffOutput);
    expect(mockExecFile).toHaveBeenCalledWith(
      "git",
      ["diff", "main...feature"],
      expect.any(Object),
      expect.any(Function),
    );
  });

  it("returns empty string when no diff", async () => {
    mockGitOutput("");
    const result = await getDiff("main", "feature");
    expect(result).toBe("");
  });

  it("falls back to two-dot diff on three-dot failure", async () => {
    let callCount = 0;
    mockExecFile.mockImplementation((_cmd, args, _opts, callback) => {
      callCount++;
      if (typeof callback === "function") {
        if (callCount === 1) {
          // First call (three-dot) fails
          const error = new Error("fatal") as NodeJS.ErrnoException;
          error.code = "1";
          callback(error, "", "fatal");
        } else {
          // Second call (two-dot) succeeds
          callback(null, "fallback diff", "");
        }
      }
      return {} as ChildProcess;
    });

    const result = await getDiff("main", "feature");
    expect(result).toBe("fallback diff");
    expect(callCount).toBe(2);
  });
});

describe("getCommitLog", () => {
  it("parses structured commit output", async () => {
    const output = [
      "abc123",
      "Add feature X",
      "This is the body",
      "John Doe",
      "2024-01-15T10:30:00Z",
      "---COMMIT_SEPARATOR---",
      "def456",
      "Fix bug Y",
      "",
      "Jane Smith",
      "2024-01-14T09:00:00Z",
      "---COMMIT_SEPARATOR---",
    ].join("\n");

    mockGitOutput(output);

    const commits = await getCommitLog("main", "feature");
    expect(commits).toHaveLength(2);
    expect(commits[0]).toEqual({
      hash: "abc123",
      subject: "Add feature X",
      body: "This is the body",
      author: "John Doe",
      date: "2024-01-15T10:30:00Z",
    });
    expect(commits[1]).toEqual({
      hash: "def456",
      subject: "Fix bug Y",
      body: "",
      author: "Jane Smith",
      date: "2024-01-14T09:00:00Z",
    });
  });

  it("returns empty array when no commits", async () => {
    mockGitOutput("");
    const commits = await getCommitLog("main", "feature");
    expect(commits).toEqual([]);
  });

  it("returns empty array on error", async () => {
    mockGitError("fatal: bad revision");
    const commits = await getCommitLog("main", "feature");
    expect(commits).toEqual([]);
  });
});

describe("getChangedFiles", () => {
  it("parses numstat and name-status output", async () => {
    let callCount = 0;
    mockExecFile.mockImplementation((_cmd, args, _opts, callback) => {
      callCount++;
      if (typeof callback === "function") {
        const argsArr = args as string[];
        if (argsArr.includes("--numstat")) {
          callback(null, "10\t5\tsrc/app.ts\n3\t0\tsrc/utils.ts\n", "");
        } else if (argsArr.includes("--name-status")) {
          callback(null, "M\tsrc/app.ts\nA\tsrc/utils.ts\n", "");
        } else {
          callback(null, "", "");
        }
      }
      return {} as ChildProcess;
    });

    const files = await getChangedFiles("main", "feature");
    expect(files).toHaveLength(2);
    expect(files[0]).toEqual({
      path: "src/app.ts",
      additions: 10,
      deletions: 5,
      status: "modified",
    });
    expect(files[1]).toEqual({
      path: "src/utils.ts",
      additions: 3,
      deletions: 0,
      status: "added",
    });
  });

  it("handles renamed files", async () => {
    mockExecFile.mockImplementation((_cmd, args, _opts, callback) => {
      if (typeof callback === "function") {
        const argsArr = args as string[];
        if (argsArr.includes("--numstat")) {
          callback(null, "0\t0\tnew-name.ts\n", "");
        } else if (argsArr.includes("--name-status")) {
          callback(null, "R100\told-name.ts\tnew-name.ts\n", "");
        } else {
          callback(null, "", "");
        }
      }
      return {} as ChildProcess;
    });

    const files = await getChangedFiles("main", "feature");
    expect(files).toHaveLength(1);
    expect(files[0]).toEqual({
      path: "new-name.ts",
      additions: 0,
      deletions: 0,
      status: "renamed",
      oldPath: "old-name.ts",
    });
  });

  it("returns empty array when no changes", async () => {
    mockGitOutput("");
    const files = await getChangedFiles("main", "feature");
    expect(files).toEqual([]);
  });
});

describe("getCurrentBranch", () => {
  it("returns the current branch name", async () => {
    mockGitOutput("feature/my-branch");
    const branch = await getCurrentBranch();
    expect(branch).toBe("feature/my-branch");
  });

  it("throws in detached HEAD state", async () => {
    mockGitOutput("");
    await expect(getCurrentBranch()).rejects.toThrow("detached HEAD");
  });
});

/**
 * Helper to mock execFile based on specific git arguments.
 * Takes a map of ref patterns to whether they should succeed (exist) or fail (not exist).
 * Also handles "git branch" calls by returning branchListOutput.
 */
function mockGitByArgs(opts: {
  branchListOutput?: string;
  existingRefs?: string[];
  remoteShowOutput?: string;
}) {
  const { branchListOutput = "", existingRefs = [], remoteShowOutput } = opts;
  mockExecFile.mockImplementation((_cmd, args, _opts, callback) => {
    if (typeof callback === "function") {
      const argsArr = args as string[];

      // git branch --format=...
      if (argsArr.includes("--format=%(refname:short)")) {
        callback(null, branchListOutput, "");
        return {} as ChildProcess;
      }

      // git show-ref --verify --quiet <ref>
      if (argsArr.includes("show-ref") && argsArr.includes("--verify")) {
        const ref = argsArr[argsArr.length - 1]!;
        if (existingRefs.includes(ref)) {
          callback(null, "", "");
        } else {
          const error = new Error("not found") as NodeJS.ErrnoException;
          error.code = "1";
          callback(error, "", "");
        }
        return {} as ChildProcess;
      }

      // git remote show origin
      if (argsArr.includes("remote") && argsArr.includes("show")) {
        if (remoteShowOutput) {
          callback(null, remoteShowOutput, "");
        } else {
          const error = new Error("not available") as NodeJS.ErrnoException;
          error.code = "1";
          callback(error, "", "");
        }
        return {} as ChildProcess;
      }

      callback(null, "", "");
    }
    return {} as ChildProcess;
  });
}

describe("getBranches", () => {
  it("prioritizes origin/main and origin/master at the top, then local main/master, then rest alphabetically", async () => {
    mockGitByArgs({
      branchListOutput: "main\nfeature/b\nfeature/a\ndevelop\nmaster",
      existingRefs: ["refs/remotes/origin/main", "refs/remotes/origin/master"],
    });
    const branches = await getBranches();
    expect(branches).toEqual([
      "origin/main",
      "origin/master",
      "main",
      "master",
      "develop",
      "feature/a",
      "feature/b",
    ]);
  });

  it("puts origin/main at top when only origin/main exists", async () => {
    mockGitByArgs({
      branchListOutput: "main\nfeature/b\nfeature/a\ndevelop",
      existingRefs: ["refs/remotes/origin/main"],
    });
    const branches = await getBranches();
    expect(branches).toEqual(["origin/main", "main", "develop", "feature/a", "feature/b"]);
  });

  it("puts local main/master before other branches when no origin refs exist", async () => {
    mockGitByArgs({
      branchListOutput: "main\nfeature/b\nfeature/a\ndevelop",
      existingRefs: [],
    });
    const branches = await getBranches();
    expect(branches).toEqual(["main", "develop", "feature/a", "feature/b"]);
  });

  it("handles master without main", async () => {
    mockGitByArgs({
      branchListOutput: "master\nfeature/b\nfeature/a\ndevelop",
      existingRefs: ["refs/remotes/origin/master"],
    });
    const branches = await getBranches();
    expect(branches).toEqual(["origin/master", "master", "develop", "feature/a", "feature/b"]);
  });

  it("returns empty array when no branches", async () => {
    mockGitByArgs({ branchListOutput: "", existingRefs: [] });
    const branches = await getBranches();
    expect(branches).toEqual([]);
  });
});

describe("getDefaultBranch", () => {
  it('returns "origin/main" when origin/main exists', async () => {
    mockGitByArgs({ existingRefs: ["refs/remotes/origin/main"] });
    const branch = await getDefaultBranch();
    expect(branch).toBe("origin/main");
  });

  it('returns "origin/master" when origin/main does not exist but origin/master does', async () => {
    mockGitByArgs({ existingRefs: ["refs/remotes/origin/master"] });
    const branch = await getDefaultBranch();
    expect(branch).toBe("origin/master");
  });

  it('returns local "main" when no origin refs exist but local main does', async () => {
    mockGitByArgs({ existingRefs: ["refs/heads/main"] });
    const branch = await getDefaultBranch();
    expect(branch).toBe("main");
  });

  it('returns local "master" when only local master exists', async () => {
    mockGitByArgs({ existingRefs: ["refs/heads/master"] });
    const branch = await getDefaultBranch();
    expect(branch).toBe("master");
  });

  it("prefers origin/main over local main", async () => {
    mockGitByArgs({
      existingRefs: ["refs/remotes/origin/main", "refs/heads/main"],
    });
    const branch = await getDefaultBranch();
    expect(branch).toBe("origin/main");
  });

  it("falls back to git remote show origin when no refs found", async () => {
    mockGitByArgs({
      existingRefs: [],
      remoteShowOutput: "  HEAD branch: develop\n",
    });
    const branch = await getDefaultBranch();
    expect(branch).toBe("develop");
  });

  it("throws when no default branch found", async () => {
    mockGitByArgs({ existingRefs: [] });
    await expect(getDefaultBranch()).rejects.toThrow("Could not determine the default branch");
  });
});

describe("hasRemoteBranch", () => {
  it("returns true when branch exists on remote", async () => {
    mockGitOutput("abc123\trefs/heads/feature/test");
    const result = await hasRemoteBranch("feature/test");
    expect(result).toBe(true);
    expect(mockExecFile).toHaveBeenCalledWith(
      "git",
      ["ls-remote", "--heads", "origin", "feature/test"],
      expect.any(Object),
      expect.any(Function),
    );
  });

  it("returns false when branch does not exist on remote", async () => {
    mockGitOutput("");
    const result = await hasRemoteBranch("feature/nonexistent");
    expect(result).toBe(false);
  });

  it("returns false on error", async () => {
    mockGitError("fatal: could not read from remote");
    const result = await hasRemoteBranch("feature/test");
    expect(result).toBe(false);
  });

  it("uses custom remote name", async () => {
    mockGitOutput("abc123\trefs/heads/feature/test");
    await hasRemoteBranch("feature/test", "upstream");
    expect(mockExecFile).toHaveBeenCalledWith(
      "git",
      ["ls-remote", "--heads", "upstream", "feature/test"],
      expect.any(Object),
      expect.any(Function),
    );
  });
});

describe("getUnpushedCommitCount", () => {
  it("returns count when there are unpushed commits", async () => {
    mockGitOutput("3");
    const count = await getUnpushedCommitCount("feature/test");
    expect(count).toBe(3);
    expect(mockExecFile).toHaveBeenCalledWith(
      "git",
      ["rev-list", "--count", "origin/feature/test..HEAD"],
      expect.any(Object),
      expect.any(Function),
    );
  });

  it("returns 0 when all commits are pushed", async () => {
    mockGitOutput("0");
    const count = await getUnpushedCommitCount("feature/test");
    expect(count).toBe(0);
  });

  it("returns 0 on error (e.g., no upstream)", async () => {
    mockGitError("fatal: bad revision 'origin/feature/test..HEAD'");
    const count = await getUnpushedCommitCount("feature/test");
    expect(count).toBe(0);
  });

  it("returns 0 on non-numeric output", async () => {
    mockGitOutput("not-a-number");
    const count = await getUnpushedCommitCount("feature/test");
    expect(count).toBe(0);
  });
});

describe("pushBranch", () => {
  it("calls git push with -u flag", async () => {
    mockGitOutput("");
    await pushBranch("feature/test");
    expect(mockExecFile).toHaveBeenCalledWith(
      "git",
      ["push", "-u", "origin", "feature/test"],
      expect.any(Object),
      expect.any(Function),
    );
  });

  it("uses custom remote name", async () => {
    mockGitOutput("");
    await pushBranch("feature/test", "upstream");
    expect(mockExecFile).toHaveBeenCalledWith(
      "git",
      ["push", "-u", "upstream", "feature/test"],
      expect.any(Object),
      expect.any(Function),
    );
  });

  it("throws on push failure", async () => {
    mockGitError("fatal: remote rejected");
    await expect(pushBranch("feature/test")).rejects.toThrow("remote rejected");
  });
});
