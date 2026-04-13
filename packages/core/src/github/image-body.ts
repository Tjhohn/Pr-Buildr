/**
 * Utilities for inserting uploaded image URLs into a PR body.
 *
 * The AI (or user) places {image:N} or {image:filename} references in the body.
 * After images are uploaded and we have real URLs, this module replaces those
 * placeholders with proper markdown image syntax: ![alt](url)
 *
 * Any images not referenced inline are appended under a ## Screenshots section.
 */

import type { ImageUploadResult } from "./image-types.js";

/** Regex to match {image:...} placeholders in the body. */
const IMAGE_PLACEHOLDER_RE = /\{image:([^}]+)\}/g;

/** Headings that indicate an existing screenshots/images section. */
const SCREENSHOT_HEADING_RE = /^(#{1,3})\s+(screenshots?|images?|visual\s+changes?)\s*$/im;

/**
 * Replace {image:N} and {image:filename} placeholders in the PR body
 * with real markdown image references, and append any unreferenced images
 * at the end (in an existing Screenshots section or a new one).
 */
export function insertImagesIntoBody(body: string, images: ImageUploadResult[]): string {
  if (images.length === 0) return body;

  // Track which images have been placed inline
  const placed = new Set<string>();

  // Build a lookup: id → image, fileName → image
  const byId = new Map<string, ImageUploadResult>();
  const byFileName = new Map<string, ImageUploadResult>();
  for (const img of images) {
    byId.set(img.id, img);
    byFileName.set(img.fileName.toLowerCase(), img);
  }

  // Replace all {image:...} placeholders
  let result = body.replace(IMAGE_PLACEHOLDER_RE, (_match, ref: string) => {
    const trimmed = ref.trim();

    // Try matching by ID first
    let img = byId.get(trimmed);
    if (!img) {
      // Try matching by filename (case-insensitive)
      img = byFileName.get(trimmed.toLowerCase());
    }

    if (img) {
      placed.add(img.id);
      return formatImageMarkdown(img);
    }

    // No matching image found — leave the placeholder as-is
    return _match;
  });

  // Collect unreferenced images
  const unreferenced = images.filter((img) => !placed.has(img.id));

  if (unreferenced.length === 0) return result;

  // Append unreferenced images
  const imageBlock = unreferenced.map((img) => formatImageMarkdown(img)).join("\n\n");

  // Check if there's an existing screenshots/images heading
  const headingMatch = result.match(SCREENSHOT_HEADING_RE);

  if (headingMatch) {
    // Insert images after the heading line
    const headingIndex = result.indexOf(headingMatch[0]);
    const afterHeading = headingIndex + headingMatch[0].length;

    // Find what comes after the heading (skip whitespace)
    const rest = result.slice(afterHeading);
    const leadingWhitespace = rest.match(/^\s*/)?.[0] ?? "";

    result =
      result.slice(0, afterHeading) +
      "\n\n" +
      imageBlock +
      (leadingWhitespace.length > 0 ? "" : "\n") +
      rest;
  } else {
    // Append a new Screenshots section at the end
    result = result.trimEnd() + "\n\n## Screenshots\n\n" + imageBlock + "\n";
  }

  return result;
}

/**
 * Format a single image as a markdown image reference.
 */
function formatImageMarkdown(img: ImageUploadResult): string {
  return `![${escapeAltText(img.altText)}](${img.url})`;
}

/**
 * Escape characters that would break markdown image alt text.
 */
function escapeAltText(text: string): string {
  return text.replace(/[\[\]]/g, "\\$&");
}
