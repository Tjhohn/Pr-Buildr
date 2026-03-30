import type { DraftInput } from "./types.js";
import type { AIConfig } from "../config/schema.js";
import { truncateDiff } from "./truncation.js";

const SYSTEM_PROMPT = `You are a pull request description writer. Your job is to generate a clear, concise, and accurate PR title and body based on the provided context.

You will be given:
- A PR template to follow
- The base and head branch names
- A summary of changed files
- A summary of commits
- The git diff (may be truncated for large PRs)

Rules:
- Fill in every section of the template, replacing HTML comments with real content
- Be concise and technical. Focus on what changed and why
- Do not invent or assume changes that are not in the diff
- The title should be a short, descriptive summary (no prefix like "feat:" unless the commits use that convention)
- The body should follow the template structure exactly
- If a section is not applicable, write "N/A" for that section

Respond ONLY with a valid JSON object. No markdown, no explanation, no code fences.
The JSON must have exactly two keys:
- "title": a short PR title string
- "body": the full PR body as a markdown string (use \\n for newlines within the string)`;

/**
 * Build the prompt to send to the AI provider.
 * Returns system and user messages for the chat completion.
 */
export function buildPrompt(
  input: DraftInput,
  config?: AIConfig,
): { system: string; user: string } {
  const truncatedDiff = truncateDiff(input.diff, input.fileSummary, config);

  const fileSummaryText = formatFileSummary(input);
  const commitSummaryText = formatCommitSummary(input);

  const sections = [
    `## PR Template`,
    "```",
    input.template,
    "```",
    "",
    `## Branch Info`,
    `Base: ${input.baseBranch}`,
    `Head: ${input.headBranch}`,
    "",
  ];

  // Include Jira ticket info if present
  if (input.jiraTicket) {
    sections.push(`## Jira Ticket`);
    sections.push(`Ticket: ${input.jiraTicket.id}`);
    if (input.jiraTicket.url) {
      sections.push(`Link: ${input.jiraTicket.url}`);
      sections.push(`Include the Jira ticket link in the PR body.`);
    }
    sections.push("");
  }

  sections.push(
    `## Changed Files (${input.fileSummary.length} files)`,
    fileSummaryText,
    "",
    `## Commits (${input.commitSummary.length} commits)`,
    commitSummaryText,
    "",
    `## Diff`,
    "```diff",
    truncatedDiff || "(no diff available)",
    "```",
  );

  const user = sections.join("\n");

  return { system: SYSTEM_PROMPT, user };
}

function formatFileSummary(input: DraftInput): string {
  if (input.fileSummary.length === 0) {
    return "(no files changed)";
  }

  return input.fileSummary
    .map((f) => {
      const status = f.status === "renamed" && f.oldPath
        ? `renamed from ${f.oldPath}`
        : f.status;
      return `- ${f.path} (+${f.additions}, -${f.deletions}) [${status}]`;
    })
    .join("\n");
}

function formatCommitSummary(input: DraftInput): string {
  if (input.commitSummary.length === 0) {
    return "(no commits)";
  }

  return input.commitSummary
    .map((c) => {
      const body = c.body ? `\n  ${c.body.split("\n")[0]}` : "";
      return `- ${c.hash.slice(0, 7)} ${c.subject} (${c.author})${body}`;
    })
    .join("\n");
}
