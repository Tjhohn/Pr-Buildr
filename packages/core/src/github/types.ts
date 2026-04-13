import type { ImageAttachment } from "./image-types.js";

export interface CreatePRParams {
  owner: string;
  repo: string;
  title: string;
  body: string;
  head: string;
  base: string;
  draft?: boolean;
  token: string;
  /** Images to upload and embed in the body before creating the PR. */
  images?: ImageAttachment[];
}

export interface PRResult {
  number: number;
  url: string;
  htmlUrl: string;
  state: string;
  draft: boolean;
}
