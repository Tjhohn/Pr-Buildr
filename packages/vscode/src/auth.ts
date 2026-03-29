import * as vscode from "vscode";

const SECRET_KEY_PREFIX = "pr-buildr";

/** Map provider names to their env var names */
const PROVIDER_ENV_VARS: Record<string, string> = {
  openai: "OPENAI_API_KEY",
  anthropic: "ANTHROPIC_API_KEY",
  "openai-compatible": "LOCAL_AI_API_KEY",
};

/** Map provider names to their secret storage key */
function secretKey(provider: string): string {
  return `${SECRET_KEY_PREFIX}.${provider}.apiKey`;
}

/**
 * Get a GitHub token for API authentication.
 *
 * Resolution order:
 * 1. VS Code built-in GitHub auth (auto-prompts sign-in on first use)
 * 2. GITHUB_TOKEN env var
 * 3. GH_TOKEN env var
 */
export async function getVSCodeGitHubToken(): Promise<string> {
  // 1. VS Code GitHub auth (OAuth)
  try {
    const session = await vscode.authentication.getSession("github", ["repo"], {
      createIfNone: true,
    });
    if (session) {
      return session.accessToken;
    }
  } catch {
    // User cancelled or auth not available
  }

  // 2. GITHUB_TOKEN env var
  const githubToken = process.env["GITHUB_TOKEN"];
  if (githubToken) {
    return githubToken;
  }

  // 3. GH_TOKEN env var
  const ghToken = process.env["GH_TOKEN"];
  if (ghToken) {
    return ghToken;
  }

  throw new Error(
    "GitHub authentication required. Sign in via VS Code or set the GITHUB_TOKEN environment variable.",
  );
}

/**
 * Get an AI API key for the given provider.
 *
 * Resolution order:
 * 1. VS Code SecretStorage (set via "Set API Key" commands)
 * 2. Environment variable (OPENAI_API_KEY, ANTHROPIC_API_KEY, etc.)
 *
 * Returns undefined if no key is found (caller handles prompting).
 */
export async function getAIApiKey(
  secrets: vscode.SecretStorage,
  provider: string,
): Promise<string | undefined> {
  // 1. SecretStorage
  const stored = await secrets.get(secretKey(provider));
  if (stored) {
    return stored;
  }

  // 2. Environment variable
  const envVar = PROVIDER_ENV_VARS[provider];
  if (envVar) {
    const envValue = process.env[envVar];
    if (envValue) {
      return envValue;
    }
  }

  return undefined;
}

/**
 * Store an AI API key in VS Code's SecretStorage (encrypted, OS keychain).
 */
export async function storeAIApiKey(
  secrets: vscode.SecretStorage,
  provider: string,
  key: string,
): Promise<void> {
  await secrets.store(secretKey(provider), key);
}

/**
 * Get the env var name for a provider (used in error messages).
 */
export function getProviderEnvVar(provider: string): string {
  return PROVIDER_ENV_VARS[provider] ?? "API_KEY";
}
