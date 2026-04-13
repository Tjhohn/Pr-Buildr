/**
 * Image upload orchestrator for GitHub's internal asset upload flow.
 *
 * Implements the 3-step upload process:
 * 1. Request upload policy (POST /upload/policies/assets)
 * 2. Upload file to S3 (POST to presigned URL)
 * 3. Finalize upload (PUT /upload/assets/{id})
 *
 * Based on the flow documented by drogers0/gh-image.
 */

import { readFile } from "node:fs/promises";
import type {
  ImageAttachment,
  ImageUploadResult,
  UploadImageParams,
  GitHubUploadPolicy,
} from "./image-types.js";

const GITHUB_BASE = "https://github.com";
const GITHUB_API_BASE = "https://api.github.com";

// ── Public API ──

export interface UploadImagesParams {
  owner: string;
  repo: string;
  token: string;
  sessionCookie: string;
  /** Optional callback for progress updates. */
  onProgress?: (current: number, total: number) => void;
}

/**
 * Upload all images to GitHub's CDN and return their permanent URLs.
 *
 * Images are uploaded sequentially (GitHub's upload endpoint doesn't
 * handle high concurrency well). Partial failures are reported in the
 * results — successfully uploaded images have a URL, failed ones throw.
 */
export async function uploadImages(
  images: ImageAttachment[],
  params: UploadImagesParams,
): Promise<ImageUploadResult[]> {
  if (images.length === 0) return [];

  const { owner, repo, token, sessionCookie, onProgress } = params;

  // Get the numeric repository ID (needed for upload policy)
  const repositoryId = await getRepositoryId(owner, repo, token);

  // Get the upload token from the repo page
  const uploadToken = await getUploadToken(owner, repo, sessionCookie);

  const results: ImageUploadResult[] = [];

  for (let i = 0; i < images.length; i++) {
    const image = images[i]!;
    onProgress?.(i + 1, images.length);

    const fileBuffer = await readFile(image.localPath);

    // Step 1: Request upload policy
    const policy = await requestUploadPolicy(
      {
        owner,
        repo,
        repositoryId,
        filePath: image.localPath,
        fileName: image.fileName,
        contentType: image.contentType,
        fileSize: image.size,
        sessionCookie,
      },
      uploadToken,
    );

    // Step 2: Upload to S3
    await uploadToS3(policy, fileBuffer);

    // Step 3: Finalize
    await finalizeUpload(
      policy.asset.id,
      policy.assetUploadAuthenticityToken,
      sessionCookie,
      owner,
      repo,
    );

    results.push({
      id: image.id,
      url: policy.asset.href,
      altText: image.altText,
      fileName: image.fileName,
    });
  }

  return results;
}

/**
 * Get the numeric repository ID from the GitHub API.
 */
export async function getRepositoryId(owner: string, repo: string, token: string): Promise<number> {
  const url = `${GITHUB_API_BASE}/repos/${owner}/${repo}`;

  const response = await fetch(url, {
    headers: {
      Authorization: `token ${token}`,
      Accept: "application/vnd.github+json",
      "X-GitHub-Api-Version": "2022-11-28",
    },
  });

  if (!response.ok) {
    throw new Error(
      `Failed to get repository info for ${owner}/${repo}: ${response.status} ${response.statusText}`,
    );
  }

  const data = (await response.json()) as { id: number };
  return data.id;
}

// ── Step 0: Get upload token ──

/**
 * Fetch the repository page and extract the uploadToken from the HTML.
 * This token is embedded in the page's JavaScript and is required
 * as the authenticity_token for the upload policy request.
 */
async function getUploadToken(owner: string, repo: string, sessionCookie: string): Promise<string> {
  const url = `${GITHUB_BASE}/${owner}/${repo}`;

  const response = await fetch(url, {
    headers: {
      Cookie: buildCookieHeader(sessionCookie),
      "User-Agent": "PR-Buildr/1.0",
    },
    redirect: "follow",
  });

  if (!response.ok) {
    throw new Error(
      `Failed to fetch repository page (${response.status}).\n` +
        "Make sure your GitHub browser session is valid.",
    );
  }

  const html = await response.text();

  // Extract uploadToken from the embedded JavaScript
  const match = html.match(/"uploadToken":"([^"]+)"/);
  if (!match?.[1]) {
    throw new Error(
      "Could not find upload token on the repository page.\n" +
        "You may not have write access to this repository, or your session has expired.",
    );
  }

  return match[1];
}

// ── Step 1: Request upload policy ──

interface UploadPolicyResponse {
  upload_url: string;
  asset: {
    id: number;
    href: string;
    name: string;
    size: number;
    content_type: string;
    original_name: string;
  };
  form: Record<string, string>;
  asset_upload_authenticity_token: string;
  upload_authenticity_token: string;
}

async function requestUploadPolicy(
  params: UploadImageParams,
  uploadToken: string,
): Promise<GitHubUploadPolicy> {
  const url = `${GITHUB_BASE}/upload/policies/assets`;

  // Build multipart form data
  const formData = new FormData();
  formData.append("name", params.fileName);
  formData.append("size", String(params.fileSize));
  formData.append("content_type", params.contentType);
  formData.append("authenticity_token", uploadToken);
  formData.append("repository_id", String(params.repositoryId));

  const response = await fetch(url, {
    method: "POST",
    headers: {
      Accept: "application/json",
      Origin: GITHUB_BASE,
      Referer: `${GITHUB_BASE}/${params.owner}/${params.repo}`,
      "X-Requested-With": "XMLHttpRequest",
      Cookie: buildCookieHeader(params.sessionCookie),
    },
    body: formData,
  });

  if (!response.ok) {
    const status = response.status;
    if (status === 422) {
      throw new Error(
        "GitHub rejected the upload request (422).\n" +
          "Your browser session may have expired. Log into github.com again.",
      );
    }
    if (status === 401 || status === 403) {
      throw new Error(
        "GitHub authentication failed for image upload.\n" +
          "Make sure you are logged into github.com in your browser.",
      );
    }
    throw new Error(`Upload policy request failed: ${status} ${response.statusText}`);
  }

  const data = (await response.json()) as UploadPolicyResponse;

  return {
    uploadUrl: data.upload_url,
    asset: {
      id: data.asset.id,
      href: data.asset.href,
      name: data.asset.name,
    },
    form: data.form,
    assetUploadAuthenticityToken: data.asset_upload_authenticity_token,
  };
}

// ── Step 2: Upload to S3 ──

async function uploadToS3(policy: GitHubUploadPolicy, fileBuffer: Buffer): Promise<void> {
  const formData = new FormData();

  // Add all form fields from the policy (order matters for S3)
  for (const [key, value] of Object.entries(policy.form)) {
    formData.append(key, value);
  }

  // File must be the last field
  const blob = new Blob([fileBuffer], {
    type: policy.form["Content-Type"] ?? "application/octet-stream",
  });
  formData.append("file", blob, policy.asset.name);

  const response = await fetch(policy.uploadUrl, {
    method: "POST",
    headers: {
      Origin: GITHUB_BASE,
    },
    body: formData,
  });

  if (response.status !== 204 && !response.ok) {
    throw new Error(
      `S3 upload failed: ${response.status} ${response.statusText}\n` +
        "The upload policy may have expired. Try again.",
    );
  }
}

// ── Step 3: Finalize upload ──

async function finalizeUpload(
  assetId: number,
  authToken: string,
  sessionCookie: string,
  owner: string,
  repo: string,
): Promise<void> {
  const url = `${GITHUB_BASE}/upload/assets/${assetId}`;

  const formData = new FormData();
  formData.append("authenticity_token", authToken);

  const response = await fetch(url, {
    method: "PUT",
    headers: {
      Accept: "application/json",
      Origin: GITHUB_BASE,
      Referer: `${GITHUB_BASE}/${owner}/${repo}`,
      "X-Requested-With": "XMLHttpRequest",
      Cookie: buildCookieHeader(sessionCookie),
    },
    body: formData,
  });

  if (!response.ok) {
    throw new Error(
      `Failed to finalize image upload (${response.status}).\n` +
        "The image was uploaded to S3 but could not be activated.",
    );
  }
}

// ── Helpers ──

/**
 * Build the Cookie header value from a user_session value.
 * GitHub requires both user_session and __Host-user_session_same_site
 * (same value, stricter SameSite policy).
 */
function buildCookieHeader(sessionCookie: string): string {
  return `user_session=${sessionCookie}; __Host-user_session_same_site=${sessionCookie}`;
}
