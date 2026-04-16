import type { CreatePRParams, PRResult } from "./types.js";

const GITHUB_API_BASE = "https://api.github.com";

/**
 * Create a pull request via the GitHub REST API.
 * POST /repos/{owner}/{repo}/pulls
 */
export async function createPullRequest(params: CreatePRParams): Promise<PRResult> {
  const url = `${GITHUB_API_BASE}/repos/${params.owner}/${params.repo}/pulls`;

  // GitHub API expects bare branch names (e.g., "master"), not local
  // remote-tracking refs (e.g., "origin/master").
  const base = params.base.replace(/^origin\//, "");
  const head = params.head.replace(/^origin\//, "");

  let response: Response;
  try {
    response = await fetch(url, {
      method: "POST",
      headers: {
        Authorization: `token ${params.token}`,
        Accept: "application/vnd.github+json",
        "X-GitHub-Api-Version": "2022-11-28",
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        title: params.title,
        body: params.body,
        head,
        base,
        draft: params.draft ?? false,
      }),
    });
  } catch (err: unknown) {
    if (err instanceof Error) {
      throw new Error(
        `Could not connect to GitHub API. Check your network connection. Details: ${err.message}`,
      );
    }
    throw err;
  }

  if (!response.ok) {
    await handleGitHubError(response, params);
  }

  const data = (await response.json()) as GitHubPRResponse;

  return {
    number: data.number,
    url: data.url,
    htmlUrl: data.html_url,
    state: data.state,
    draft: data.draft ?? false,
  };
}

interface GitHubPRResponse {
  number: number;
  url: string;
  html_url: string;
  state: string;
  draft?: boolean;
}

interface GitHubErrorResponse {
  message?: string;
  errors?: Array<{
    message?: string;
    resource?: string;
    field?: string;
    code?: string;
  }>;
}

async function handleGitHubError(response: Response, params: CreatePRParams): Promise<never> {
  let errorData: GitHubErrorResponse;
  try {
    errorData = (await response.json()) as GitHubErrorResponse;
  } catch {
    throw new Error(`GitHub API error (${response.status}): ${await response.text()}`);
  }

  const message = errorData.message ?? "Unknown error";
  const errorDetails = errorData.errors
    ?.map((e) => e.message)
    .filter(Boolean)
    .join("; ");
  // Use || (not ??) so empty string "" falls through to the next value
  const fullErrorContext = errorDetails || message || JSON.stringify(errorData.errors ?? []);

  // Always include raw response so users have diagnostic info
  const rawResponse = `\n\nRaw response (${response.status}): ${JSON.stringify(errorData)}`;

  switch (response.status) {
    case 401:
      throw new Error(
        "GitHub authentication failed. Check your token.\n" +
          "Make sure it has the 'repo' scope." +
          rawResponse,
      );

    case 403:
      throw new Error(
        "GitHub permission denied. Your token may not have the 'repo' scope.\n" +
          `Details: ${message}` +
          rawResponse,
      );

    case 404:
      throw new Error(
        `Repository not found: ${params.owner}/${params.repo}.\n` +
          "Check that the repository exists and your token has access." +
          rawResponse,
      );

    case 422: {
      // Validation failed — common cases
      if (fullErrorContext.includes("A pull request already exists")) {
        throw new Error(
          `A pull request already exists for ${params.head} → ${params.base}.\n` +
            `Details: ${fullErrorContext}` +
            rawResponse,
        );
      }

      if (fullErrorContext.includes("No commits between")) {
        throw new Error(
          `No commits between ${params.base} and ${params.head}. Nothing to create a PR for.` +
            rawResponse,
        );
      }

      throw new Error(`GitHub validation error: ${fullErrorContext}` + rawResponse);
    }

    default:
      throw new Error(
        `GitHub API error (${response.status}): ${message}${errorDetails ? ` — ${errorDetails}` : ""}` +
          rawResponse,
      );
  }
}
