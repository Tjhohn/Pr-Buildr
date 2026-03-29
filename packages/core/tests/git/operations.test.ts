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

describe("getBranches", () => {
  it("returns sorted list of local branches", async () => {
    mockGitOutput("main\nfeature/b\nfeature/a\ndevelop");
    const branches = await getBranches();
    expect(branches).toEqual(["develop", "feature/a", "feature/b", "main"]);
  });

  it("returns empty array when no branches", async () => {
    mockGitOutput("");
    const branches = await getBranches();
    expect(branches).toEqual([]);
  });
});

describe("getDefaultBranch", () => {
  it('returns "main" when main branch exists', async () => {
    // show-ref --verify for main succeeds
    mockGitOutput("");
    const branch = await getDefaultBranch();
    expect(branch).toBe("main");
  });

  it('returns "master" when main does not exist but master does', async () => {
    let callCount = 0;
    mockExecFile.mockImplementation((_cmd, args, _opts, callback) => {
      callCount++;
      if (typeof callback === "function") {
        const argsArr = args as string[];
        if (argsArr.includes("refs/heads/main")) {
          // main doesn't exist
          const error = new Error("not found") as NodeJS.ErrnoException;
          error.code = "1";
          callback(error, "", "");
        } else if (argsArr.includes("refs/heads/master")) {
          // master exists
          callback(null, "", "");
        } else {
          callback(null, "", "");
        }
      }
      return {} as ChildProcess;
    });

    const branch = await getDefaultBranch();
    expect(branch).toBe("master");
  });

  it("throws when no default branch found", async () => {
    mockGitError("not found");
    await expect(getDefaultBranch()).rejects.toThrow("Could not determine the default branch");
  });
});
