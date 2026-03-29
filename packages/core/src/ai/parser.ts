import type { DraftOutput } from "./types.js";

/**
 * Parse the raw AI response into a structured DraftOutput.
 * Expects: title on the first line, body as the rest.
 */
export function parseAIResponse(_raw: string): DraftOutput {
  // Stub — implementation in Phase 3
  return { title: "", body: "" };
}
