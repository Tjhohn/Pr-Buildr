// @pr-buildr/core — public API

// Config
export { resolveConfig } from "./config/resolver.js";
export { defaultConfig } from "./config/defaults.js";
export type { PrBuildrConfig, AIConfig, GitHubConfig, ProviderConfig } from "./config/schema.js";

// Git
export { getDiff, getCommitLog, getChangedFiles, getCurrentBranch, getBranches } from "./git/operations.js";
export { getRepoRoot, getRemoteUrl, parseGitHubRepo } from "./git/repo.js";
export type { Commit, FileSummary, GitHubRepoInfo } from "./git/types.js";

// Template
export { resolveTemplate } from "./template/resolver.js";
export { FALLBACK_TEMPLATE } from "./template/fallback.js";
export type { TemplateResult } from "./template/types.js";

// Base Branch
export { resolveBaseBranch } from "./base-branch/resolver.js";
export { saveBase, getBase, clearBase } from "./base-branch/storage.js";

// AI
export { createAIProvider } from "./ai/provider-factory.js";
export { buildPrompt } from "./ai/prompt.js";
export { parseAIResponse } from "./ai/parser.js";
export type { AIProvider, DraftInput, DraftOutput } from "./ai/types.js";

// Draft
export { createDraft, editDraft, changeBase, regenerateDraft } from "./draft/state.js";
export type { DraftState } from "./draft/types.js";

// GitHub
export { createPullRequest } from "./github/api.js";
export { getGitHubToken } from "./github/auth.js";
export type { CreatePRParams, PRResult } from "./github/types.js";
