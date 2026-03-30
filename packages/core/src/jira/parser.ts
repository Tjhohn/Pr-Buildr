/**
 * Infer a Jira ticket ID from a branch name using a known project key.
 *
 * Matches the pattern `<projectKey>-<number>` anywhere in the branch name.
 * Returns the first match, or undefined if no match.
 *
 * Examples with projectKey "AA":
 *   "AA-1234-fix-login"          → "AA-1234"
 *   "feature/AA-7668-broken-auth" → "AA-7668"
 *   "fix-login"                   → undefined
 *   "PRD-55-deploy"               → undefined (different key)
 */
export function inferTicketFromBranch(
  branchName: string,
  projectKey: string,
): string | undefined {
  const escaped = escapeRegex(projectKey);
  const pattern = new RegExp(`${escaped}-\\d+`);
  const match = branchName.match(pattern);
  return match?.[0] ?? undefined;
}

/**
 * Build the full Jira browse URL for a ticket.
 *
 * Strips trailing slash and /browse suffix from the project URL for consistency.
 * Returns: `${cleanUrl}/browse/${ticketId}`
 */
export function buildJiraUrl(projectUrl: string, ticketId: string): string {
  let clean = projectUrl.trim();
  // Strip trailing slashes
  clean = clean.replace(/\/+$/, "");
  // Strip /browse suffix if present
  clean = clean.replace(/\/browse\/?$/, "");
  return `${clean}/browse/${ticketId}`;
}

/**
 * Prepend a Jira ticket ID to a PR title.
 *
 * Format: "AA-1234: <title>"
 * If the title already starts with the ticket ID, returns it unchanged.
 */
export function formatTitleWithTicket(title: string, ticketId: string): string {
  const prefix = `${ticketId}: `;
  if (title.startsWith(prefix) || title.startsWith(`${ticketId}:`)) {
    return title;
  }
  return `${prefix}${title}`;
}

/**
 * Ensure the Jira ticket URL is present in the PR body.
 *
 * If the AI included the URL somewhere in the body, returns unchanged.
 * If not found, appends it at the bottom.
 */
export function ensureJiraLinkInBody(body: string, jiraUrl: string): string {
  if (body.includes(jiraUrl)) {
    return body;
  }
  return `${body}\n\n**Jira:** ${jiraUrl}`;
}

function escapeRegex(str: string): string {
  return str.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}
