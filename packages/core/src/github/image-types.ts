/**
 * Type definitions for image attachments and GitHub image uploads.
 */

/** An image the user has attached locally, before upload. */
export interface ImageAttachment {
  /** Unique identifier, e.g. "1", "2" — used in {image:N} placeholders */
  id: string;
  /** Original filename (e.g., "screenshot.png") */
  fileName: string;
  /** Absolute path to the local file */
  localPath: string;
  /** Alt text for the markdown ![alt](url) */
  altText: string;
  /** MIME type (e.g., "image/png") */
  contentType: string;
  /** File size in bytes */
  size: number;
  /** Base64 data URL for UI preview (VS Code webview only) */
  previewDataUrl?: string;
}

/** Result of uploading a single image to GitHub's CDN. */
export interface ImageUploadResult {
  /** Matches ImageAttachment.id */
  id: string;
  /** The permanent GitHub user-content URL */
  url: string;
  /** Alt text for markdown */
  altText: string;
  /** Original filename */
  fileName: string;
}

/** Parameters for a single image upload to GitHub's internal endpoint. */
export interface UploadImageParams {
  owner: string;
  repo: string;
  repositoryId: number;
  filePath: string;
  fileName: string;
  contentType: string;
  fileSize: number;
  sessionCookie: string;
}

/** The policy response from GitHub's internal upload endpoint. */
export interface GitHubUploadPolicy {
  uploadUrl: string;
  asset: {
    id: number;
    href: string;
    name: string;
  };
  form: Record<string, string>;
  assetUploadAuthenticityToken: string;
}

/** Supported image MIME types. */
export const SUPPORTED_IMAGE_TYPES: Record<string, string> = {
  ".png": "image/png",
  ".jpg": "image/jpeg",
  ".jpeg": "image/jpeg",
  ".gif": "image/gif",
  ".webp": "image/webp",
  ".svg": "image/svg+xml",
};

/** Maximum image file size in bytes (10 MB). */
export const MAX_IMAGE_SIZE = 10 * 1024 * 1024;

/**
 * Detect the MIME type from a file extension.
 * Returns undefined if the extension is not a supported image type.
 */
export function getImageContentType(fileName: string): string | undefined {
  const ext = fileName.toLowerCase().match(/\.[^.]+$/)?.[0];
  return ext ? SUPPORTED_IMAGE_TYPES[ext] : undefined;
}

/**
 * Validate that a file is a supported image within size limits.
 * Throws a descriptive error if validation fails.
 */
export function validateImage(fileName: string, fileSize: number): void {
  const contentType = getImageContentType(fileName);
  if (!contentType) {
    const supported = Object.keys(SUPPORTED_IMAGE_TYPES).join(", ");
    throw new Error(`Unsupported image type: "${fileName}". Supported types: ${supported}`);
  }
  if (fileSize > MAX_IMAGE_SIZE) {
    const sizeMB = (fileSize / (1024 * 1024)).toFixed(1);
    const maxMB = (MAX_IMAGE_SIZE / (1024 * 1024)).toFixed(0);
    throw new Error(
      `Image "${fileName}" is too large (${sizeMB} MB). Maximum size is ${maxMB} MB.`,
    );
  }
  if (fileSize === 0) {
    throw new Error(`Image "${fileName}" is empty (0 bytes).`);
  }
}
