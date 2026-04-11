import type { Commit, FileSummary } from "../git/types.js";

export interface AIProvider {
  name: string;
  generateDraft(input: DraftInput): Promise<DraftOutput>;
}

export interface DraftInput {
  template: string;
  baseBranch: string;
  headBranch: string;
  diff: string;
  fileSummary: FileSummary[];
  commitSummary: Commit[];
  jiraTicket?: {
    id: string;
    url?: string;
  };
  /** Images attached by the user for the AI to place in the body. */
  images?: Array<{
    index: number;
    fileName: string;
    altText: string;
  }>;
}

export interface DraftOutput {
  title: string;
  body: string;
}
