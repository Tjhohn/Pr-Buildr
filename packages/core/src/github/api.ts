import type { CreatePRParams, PRResult } from "./types.js";

const GITHUB_API_BASE = "https://api.github.com";

/**
 * Create a pull request via the GitHub REST API.
 * POST /repos/{owner}/{repo}/pulls
 */
export async function createPullRequest(params: CreatePRParams): Promise<PRResult> {
  const url = `${GITHUB_API_BASE}/repos/${params.owner}/${params.repo}/pulls`;

  let response: Response;
  try {
    response = await fetch(url, {
      method: "POST",
      headers: {
        "Authorization": `token ${params.token}`,
        "Accept": "application/vnd.github+json",
        "X-GitHub-Api-Version": "2022-11-28",
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        title: params.title,
        body: params.body,
        head: params.head,
        base: params.base,
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

async function handleGitHubError(
  response: Response,
  params: CreatePRParams,
): Promise<never> {
  let errorData: GitHubErrorResponse;
  try {
    errorData = (await response.json()) as GitHubErrorResponse;
  } catch {
    throw new Error(`GitHub API error (${response.status}): ${await response.text()}`);
  }

  const message = errorData.message ?? "Unknown error";
  const errorDetails = errorData.errors?.map((e) => e.message).filter(Boolean).join("; ");

  switch (response.status) {
    case 401:
      throw new Error(
        "GitHub authentication failed. Check your token.\n" +
          "Make sure it has the 'repo' scope.",
      );

    case 403:
      throw new Error(
        "GitHub permission denied. Your token may not have the 'repo' scope.\n" +
          `Details: ${message}`,
      );

    case 404:
      throw new Error(
        `Repository not found: ${params.owner}/${params.repo}.\n` +
          "Check that the repository exists and your token has access.",
      );

    case 422: {
      // Validation failed — common cases
      const fullMessage = errorDetails ?? message;

      if (fullMessage.includes("A pull request already exists")) {
        throw new Error(
          `A pull request already exists for ${params.head} → ${params.base}.\n` +
            `Details: ${fullMessage}`,
        );
      }

      if (fullMessage.includes("No commits between")) {
        throw new Error(
          `No commits between ${params.base} and ${params.head}. Nothing to create a PR for.`,
        );
      }

      throw new Error(`GitHub validation error: ${fullMessage}`);
    }

    default:
      throw new Error(
        `GitHub API error (${response.status}): ${message}${errorDetails ? ` — ${errorDetails}` : ""}`,
      );
  }
}
