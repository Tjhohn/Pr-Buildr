/**
 * Configuration schema for .pr-builder.json
 */

/** Config file name, placed at the repo root */
export const CONFIG_FILENAME = ".pr-builder.json";

/** Valid AI provider identifiers */
export const VALID_PROVIDERS = [
  "openai",
  "anthropic",
  "ollama",
  "openai-compatible",
] as const;

export type ValidProvider = (typeof VALID_PROVIDERS)[number];

export interface ProviderConfig {
  openai?: {
    apiKeyEnv?: string;
  };
  anthropic?: {
    apiKeyEnv?: string;
  };
  ollama?: {
    baseUrl?: string;
    model?: string;
  };
  openaiCompatible?: {
    baseUrl?: string;
    apiKeyEnv?: string;
    model?: string;
  };
}

export interface AIConfig {
  provider?: string;
  model?: string;
  diffBudget?: number;
  categoryWeights?: {
    primary?: number;
    test?: number;
    config?: number;
    other?: number;
  };
}

export interface GitHubConfig {
  draftByDefault?: boolean;
}

export interface JiraConfig {
  /** Set to false to completely disable Jira prompts and inference */
  enabled?: boolean;
  /** Jira instance base URL, e.g., "https://company.atlassian.net" */
  projectUrl?: string;
  /** Jira project key, e.g., "AA", "PRD", "DATATEAM" */
  projectKey?: string;
}

export interface PrBuildrConfig {
  defaultBase?: string;
  github?: GitHubConfig;
  ai?: AIConfig;
  providers?: ProviderConfig;
  branchBases?: Record<string, string>;
  jira?: JiraConfig;
}
