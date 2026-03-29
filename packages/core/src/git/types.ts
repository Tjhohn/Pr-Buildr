export interface Commit {
  hash: string;
  subject: string;
  body: string;
  author: string;
  date: string;
}

export interface FileSummary {
  path: string;
  additions: number;
  deletions: number;
  status: "added" | "modified" | "deleted" | "renamed";
  oldPath?: string;
}

export interface GitHubRepoInfo {
  owner: string;
  repo: string;
}
