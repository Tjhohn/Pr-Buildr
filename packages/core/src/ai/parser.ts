import type { DraftOutput } from "./types.js";

/**
 * Parse the raw AI response into a structured DraftOutput.
 *
 * Primary strategy: JSON.parse the response (AI is instructed to return JSON).
 * Fallback: line-based parsing for models that don't follow JSON instructions well.
 */
export function parseAIResponse(raw: string): DraftOutput {
  const trimmed = raw.trim();

  if (!trimmed) {
    throw new Error("AI returned an empty response. Try again or use a different model.");
  }

  // Strip code fences if AI wraps response in ```json ... ```
  const cleaned = trimmed
    .replace(/^```(?:json)?\s*\n?/m, "")
    .replace(/\n?\s*```$/m, "")
    .trim();

  // Primary: JSON parse
  try {
    const parsed = JSON.parse(cleaned) as Record<string, unknown>;

    if (typeof parsed.title !== "string" || typeof parsed.body !== "string") {
      throw new Error("Missing title or body in JSON response");
    }

    return {
      title: parsed.title.trim(),
      body: parsed.body.trim(),
    };
  } catch {
    // Fallback: line-based parsing
    return fallbackParse(cleaned);
  }
}

/**
 * Fallback parser for models that don't reliably produce JSON.
 * Expects: title on first non-empty line, body after first blank line.
 */
function fallbackParse(raw: string): DraftOutput {
  const lines = raw.split("\n");

  // Find first non-empty line as title
  let titleIndex = -1;
  for (let i = 0; i < lines.length; i++) {
    if (lines[i]!.trim()) {
      titleIndex = i;
      break;
    }
  }

  if (titleIndex === -1) {
    throw new Error("Could not parse AI response: no content found.");
  }

  let title = lines[titleIndex]!.trim();

  // Strip leading "# " or "## " if AI adds markdown heading
  title = title.replace(/^#{1,3}\s+/, "");
  // Strip surrounding quotes
  title = title.replace(/^["']|["']$/g, "");

  // Find the first blank line after the title — everything after it is the body
  let bodyStart = -1;
  for (let i = titleIndex + 1; i < lines.length; i++) {
    if (!lines[i]!.trim()) {
      bodyStart = i + 1;
      break;
    }
  }

  const body = bodyStart >= 0 ? lines.slice(bodyStart).join("\n").trim() : "";

  return { title, body };
}
