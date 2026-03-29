import type { DraftInput } from "./types.js";

/**
 * Build the prompt to send to the AI provider.
 * Includes system instructions, template, diff (truncated), file summary, and commit log.
 */
export function buildPrompt(_input: DraftInput): { system: string; user: string } {
  // Stub — implementation in Phase 3
  return { system: "", user: "" };
}
