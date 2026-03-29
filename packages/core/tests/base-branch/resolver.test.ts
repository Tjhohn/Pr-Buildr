import { describe, it, expect, vi, beforeEach } from "vitest";

// Mock git operations
vi.mock("../../src/git/operations.js", () => ({
  getDiff: vi.fn(),
  getCommitLog: vi.fn(),
  getChangedFiles: vi.fn(),
  getCurrentBranch: vi.fn(),
  getBranches: vi.fn(),
  getDefaultBranch: vi.fn(),
}));

import { resolveBaseBranch } from "../../src/base-branch/resolver.js";
import { getDefaultBranch } from "../../src/git/operations.js";
import type { PrBuildrConfig } from "../../src/config/schema.js";

const mockGetDefaultBranch = vi.mocked(getDefaultBranch);

beforeEach(() => {
  vi.clearAllMocks();
});

describe("resolveBaseBranch", () => {
  it("returns explicit base when provided", async () => {
    const config: PrBuildrConfig = { defaultBase: "main" };
    const result = await resolveBaseBranch("feature/a", config, "develop");
    expect(result).toBe("develop");
  });

  it("returns saved branch base from config", async () => {
    const config: PrBuildrConfig = {
      defaultBase: "main",
      branchBases: { "feature/a": "feature/base" },
    };
    const result = await resolveBaseBranch("feature/a", config);
    expect(result).toBe("feature/base");
  });

  it("returns defaultBase from config when no saved base", async () => {
    const config: PrBuildrConfig = { defaultBase: "develop" };
    const result = await resolveBaseBranch("feature/a", config);
    expect(result).toBe("develop");
  });

  it("falls back to git detection when no config values", async () => {
    mockGetDefaultBranch.mockResolvedValue("main");
    const config: PrBuildrConfig = {};
    const result = await resolveBaseBranch("feature/a", config);
    expect(result).toBe("main");
    expect(mockGetDefaultBranch).toHaveBeenCalled();
  });

  it("explicit overrides saved base", async () => {
    const config: PrBuildrConfig = {
      defaultBase: "main",
      branchBases: { "feature/a": "feature/base" },
    };
    const result = await resolveBaseBranch("feature/a", config, "override");
    expect(result).toBe("override");
  });

  it("saved base overrides defaultBase", async () => {
    const config: PrBuildrConfig = {
      defaultBase: "main",
      branchBases: { "feature/a": "develop" },
    };
    const result = await resolveBaseBranch("feature/a", config);
    expect(result).toBe("develop");
  });

  it("propagates error when git detection fails", async () => {
    mockGetDefaultBranch.mockRejectedValue(
      new Error("Could not determine the default branch"),
    );
    const config: PrBuildrConfig = {};
    await expect(resolveBaseBranch("feature/a", config)).rejects.toThrow(
      "Could not determine the default branch",
    );
  });
});
