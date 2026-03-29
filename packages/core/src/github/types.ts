export interface CreatePRParams {
  owner: string;
  repo: string;
  title: string;
  body: string;
  head: string;
  base: string;
  draft?: boolean;
  token: string;
}

export interface PRResult {
  number: number;
  url: string;
  htmlUrl: string;
  state: string;
  draft: boolean;
}
