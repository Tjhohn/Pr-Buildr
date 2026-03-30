export interface JiraConfig {
  /** Set to false to completely disable Jira prompts and inference */
  enabled?: boolean;
  /** Jira instance base URL, e.g., "https://company.atlassian.net" */
  projectUrl?: string;
  /** Jira project key, e.g., "AA", "PRD", "DATATEAM" */
  projectKey?: string;
}

export interface JiraTicket {
  /** Ticket ID, e.g., "AA-1234" */
  id: string;
  /** Full browse URL, only present if projectUrl is configured */
  url?: string;
}
