import * as vscode from "vscode";

const SESSION_COOKIE_KEY = "pr-buildr.githubSessionCookie";
const MAX_RETRY_ATTEMPTS = 3;

/**
 * Command: PR Builder: Clear GitHub Auth & Re-sign In
 *
 * Clears any cached GitHub credentials (session cookie) and forces
 * a fresh GitHub OAuth sign-in through VS Code's built-in auth.
 * If OAuth fails, offers a retry loop with helpful guidance.
 *
 * Returns the new access token on success, or undefined if the user
 * cancelled or auth failed.
 */
export async function githubReauthCommand(
  context: vscode.ExtensionContext,
): Promise<string | undefined> {
  // 1. Clear saved session cookie (used for image uploads)
  try {
    await context.secrets.delete(SESSION_COOKIE_KEY);
  } catch {
    // Ignore — cookie may not exist
  }

  // 2. Try OAuth with retry loop
  for (let attempt = 1; attempt <= MAX_RETRY_ATTEMPTS; attempt++) {
    const token = await tryOAuth(attempt);
    if (token) {
      return token;
    }

    // OAuth failed — show helpful dialog
    const action = await vscode.window.showWarningMessage(
      `GitHub sign-in failed (attempt ${attempt}/${MAX_RETRY_ATTEMPTS}).\n\n` +
        "Troubleshooting tips:\n" +
        "1. Click the account icon (bottom-left) → sign out of GitHub → then try again\n" +
        "2. On Linux: run 'xdg-mime default code.desktop x-scheme-handler/vscode' in terminal\n" +
        "3. Try Ctrl+Shift+P → 'GitHub: Sign In' separately, then retry here",
      { modal: true },
      "Try Again",
      "Cancel",
    );

    if (action !== "Try Again") {
      break;
    }
  }

  vscode.window.showWarningMessage(
    "GitHub authentication was not completed. You can try again later via " +
      "Ctrl+Shift+P → 'PR Builder: Clear GitHub Auth & Re-sign In', " +
      "or set the GITHUB_TOKEN environment variable.",
  );
  return undefined;
}

/**
 * Attempt a single OAuth sign-in.
 * Returns the access token on success, or undefined on failure/cancel.
 */
async function tryOAuth(attempt: number): Promise<string | undefined> {
  try {
    // On first attempt, force a new session to clear stale state.
    // On retries, also force new session since the previous attempt failed.
    const session = await vscode.authentication.getSession("github", ["repo"], {
      forceNewSession:
        attempt === 1 ? true : { detail: "PR Buildr needs to re-authenticate with GitHub." },
    });

    if (session) {
      vscode.window.showInformationMessage(`GitHub re-authenticated as ${session.account.label}.`);
      return session.accessToken;
    }
  } catch {
    // User cancelled or redirect failed
  }

  return undefined;
}
