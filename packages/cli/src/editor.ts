import { writeFile, readFile, unlink } from "node:fs/promises";
import { join } from "node:path";
import { tmpdir } from "node:os";
import { randomBytes } from "node:crypto";
import { spawn } from "node:child_process";

const DRAFT_SEPARATOR = "\n---\n";
const DRAFT_INSTRUCTIONS = [
  "# Edit your PR draft below.",
  "# The first line is the PR title.",
  "# Everything after the --- separator is the PR body.",
  "# Lines starting with # are comments and will be ignored.",
  "",
].join("\n");

/**
 * Open the user's $EDITOR with the draft content for editing.
 * Returns the edited title and body.
 *
 * Format in the temp file:
 *   # Instructions...
 *   <title>
 *   ---
 *   <body>
 */
export async function openInEditor(
  title: string,
  body: string,
): Promise<{ title: string; body: string }> {
  const editor = resolveEditor();
  const tempPath = join(
    tmpdir(),
    `.pr-buildr-draft-${randomBytes(4).toString("hex")}.md`,
  );

  // Write the draft to a temp file
  const content = `${DRAFT_INSTRUCTIONS}${title}${DRAFT_SEPARATOR}${body}\n`;
  await writeFile(tempPath, content, "utf-8");

  try {
    // Open the editor and wait for it to close
    await launchEditor(editor, tempPath);

    // Read the edited content
    const edited = await readFile(tempPath, "utf-8");
    return parseDraftFile(edited);
  } finally {
    // Clean up temp file
    try {
      await unlink(tempPath);
    } catch {
      // Ignore cleanup errors
    }
  }
}

/**
 * Resolve the editor command to use.
 * Priority: $VISUAL → $EDITOR → fallback list
 */
function resolveEditor(): string {
  return (
    process.env["VISUAL"] ??
    process.env["EDITOR"] ??
    "vi"
  );
}

/**
 * Launch the editor as a child process and wait for it to exit.
 */
function launchEditor(editor: string, filePath: string): Promise<void> {
  return new Promise((resolve, reject) => {
    // Handle editors that need --wait flag (e.g., "code --wait")
    const parts = editor.split(/\s+/);
    const cmd = parts[0]!;
    const args = [...parts.slice(1), filePath];

    const child = spawn(cmd, args, {
      stdio: "inherit", // Share terminal with the editor
    });

    child.on("error", (err) => {
      reject(
        new Error(
          `Could not launch editor "${editor}": ${err.message}\n` +
            "Set the $EDITOR or $VISUAL environment variable to your preferred editor.",
        ),
      );
    });

    child.on("exit", (code) => {
      if (code === 0) {
        resolve();
      } else {
        reject(new Error(`Editor "${editor}" exited with code ${code}.`));
      }
    });
  });
}

/**
 * Parse the draft file content back into title and body.
 * Strips comment lines (starting with #).
 */
function parseDraftFile(content: string): { title: string; body: string } {
  // Remove comment lines
  const lines = content.split("\n").filter((line) => !line.startsWith("#"));
  const cleaned = lines.join("\n").trim();

  const separatorIndex = cleaned.indexOf(DRAFT_SEPARATOR.trim());

  if (separatorIndex === -1) {
    // No separator — treat first line as title, rest as body
    const firstNewline = cleaned.indexOf("\n");
    if (firstNewline === -1) {
      return { title: cleaned.trim(), body: "" };
    }
    return {
      title: cleaned.slice(0, firstNewline).trim(),
      body: cleaned.slice(firstNewline + 1).trim(),
    };
  }

  const title = cleaned.slice(0, separatorIndex).trim();
  const body = cleaned.slice(separatorIndex + DRAFT_SEPARATOR.trim().length).trim();

  return { title, body };
}
