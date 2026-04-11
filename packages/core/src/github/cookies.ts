/**
 * Browser cookie extraction for GitHub session authentication.
 *
 * Reads the `user_session` cookie from Chrome-family browsers' encrypted
 * cookie databases. Supports Chrome, Brave, Edge, and Chromium on
 * macOS, Linux, and Windows.
 *
 * Automatically discovers all browser profiles (Default, Profile 1,
 * Profile 2, etc.) and checks each for a GitHub session cookie.
 *
 * The cookie is needed for GitHub's internal image upload endpoint,
 * which requires browser-session authentication (not API tokens).
 */

import { execFile } from "node:child_process";
import { existsSync, copyFileSync, unlinkSync, readFileSync, readdirSync, statSync } from "node:fs";
import { join } from "node:path";
import { homedir, tmpdir, platform } from "node:os";
import { createDecipheriv, pbkdf2Sync } from "node:crypto";

// ── Browser definitions ──

interface BrowserDef {
  name: string;
  /**
   * Browser data directories relative to the platform base dir.
   * Multiple paths are checked in order (e.g., standard install, Flatpak, Snap).
   * Profile subdirectories (Default, Profile 1, etc.) live inside these.
   *
   * Linux base: $HOME
   * macOS base: $HOME
   * Windows base: %LOCALAPPDATA%
   */
  dataDirs: {
    linux?: string[];
    darwin?: string[];
    win32?: string[];
  };
  /** Safe storage service name for Keychain/Keyring */
  safeStorageName: {
    darwin?: string;
    linux?: string;
  };
  /** Path to Local State file (Windows AES-GCM key), relative to platform base */
  localStatePaths?: {
    win32?: string;
  };
}

const BROWSERS: BrowserDef[] = [
  {
    name: "Chrome",
    dataDirs: {
      linux: [
        ".config/google-chrome",
        ".var/app/com.google.Chrome/config/google-chrome", // Flatpak
        "snap/google-chrome/current/.config/google-chrome", // Snap
      ],
      darwin: ["Library/Application Support/Google/Chrome"],
      win32: ["Google/Chrome/User Data"],
    },
    safeStorageName: {
      darwin: "Chrome Safe Storage",
      linux: "chrome",
    },
    localStatePaths: {
      win32: "Google/Chrome/User Data/Local State",
    },
  },
  {
    name: "Brave",
    dataDirs: {
      linux: [
        ".config/BraveSoftware/Brave-Browser",
        ".var/app/com.brave.Browser/config/BraveSoftware/Brave-Browser", // Flatpak
      ],
      darwin: ["Library/Application Support/BraveSoftware/Brave-Browser"],
      win32: ["BraveSoftware/Brave-Browser/User Data"],
    },
    safeStorageName: {
      darwin: "Brave Safe Storage",
      linux: "brave",
    },
    localStatePaths: {
      win32: "BraveSoftware/Brave-Browser/User Data/Local State",
    },
  },
  {
    name: "Edge",
    dataDirs: {
      linux: [
        ".config/microsoft-edge",
        ".var/app/com.microsoft.Edge/config/microsoft-edge", // Flatpak
      ],
      darwin: ["Library/Application Support/Microsoft Edge"],
      win32: ["Microsoft/Edge/User Data"],
    },
    safeStorageName: {
      darwin: "Microsoft Edge Safe Storage",
      linux: "chromium",
    },
    localStatePaths: {
      win32: "Microsoft/Edge/User Data/Local State",
    },
  },
  {
    name: "Chromium",
    dataDirs: {
      linux: [
        ".config/chromium",
        ".var/app/org.chromium.Chromium/config/chromium", // Flatpak
        "snap/chromium/current/.config/chromium", // Snap
      ],
      darwin: ["Library/Application Support/Chromium"],
      win32: ["Chromium/User Data"],
    },
    safeStorageName: {
      darwin: "Chromium Safe Storage",
      linux: "chromium",
    },
    localStatePaths: {
      win32: "Chromium/User Data/Local State",
    },
  },
];

/**
 * Profile directory names that Chrome-family browsers use.
 * "Default" is the unnamed default profile.
 * "Profile N" directories are created for additional named profiles.
 */
const PROFILE_DIR_RE = /^(Default|Profile \d+)$/;

// ── Public API ──

/**
 * Extract the GitHub `user_session` cookie from the first available
 * Chrome-family browser on the system.
 *
 * Discovers all browser profiles (Default, Profile 1, Profile 2, etc.)
 * and checks each for a valid GitHub session cookie.
 *
 * Throws descriptive errors on failure:
 * - No browser found
 * - Cookie not found (not logged in)
 * - Decryption failure
 */
export async function getGitHubSessionCookie(): Promise<string> {
  const os = platform();
  const home = homedir();

  for (const browser of BROWSERS) {
    const cookiePaths = findCookieDbPaths(browser, os, home);
    if (cookiePaths.length === 0) continue;

    for (const cookiePath of cookiePaths) {
      try {
        const cookie = await extractCookie(cookiePath, browser, os);
        if (cookie) return cookie;
      } catch {
        // Try next profile / browser
        continue;
      }
    }
  }

  throw new Error(
    "GitHub session cookie not found.\n" +
      "Make sure you are logged into github.com in Chrome, Brave, Edge, or Chromium.\n" +
      "The browser must have an active session (not logged out).",
  );
}

// ── Profile discovery ──

/**
 * Find all cookie database files for a given browser across all profiles
 * and all data directory locations (standard, Flatpak, Snap).
 *
 * Chrome-family browsers store each profile in a separate subdirectory:
 * - `Default/` — the unnamed default profile
 * - `Profile 1/`, `Profile 2/`, etc. — additional named profiles
 *
 * The Cookies DB location within each profile:
 * - Linux / macOS: `{profile}/Cookies`
 * - Windows: `{profile}/Network/Cookies`
 *
 * Returns paths sorted with "Default" first (if it exists), then
 * numbered profiles in order. Paths from data dirs that appear earlier
 * in the browser definition are prioritized.
 */
function findCookieDbPaths(browser: BrowserDef, os: string, home: string): string[] {
  const dataDirs = resolveBrowserDataDirs(browser, os, home);
  const paths: string[] = [];

  for (const dataDir of dataDirs) {
    if (!existsSync(dataDir)) continue;

    try {
      const entries = readdirSync(dataDir);

      // Sort: "Default" first, then "Profile 1", "Profile 2", etc.
      const profileDirs = entries
        .filter((entry) => {
          if (!PROFILE_DIR_RE.test(entry)) return false;
          try {
            return statSync(join(dataDir, entry)).isDirectory();
          } catch {
            return false;
          }
        })
        .sort((a, b) => {
          if (a === "Default") return -1;
          if (b === "Default") return 1;
          const numA = parseInt(a.replace("Profile ", ""), 10);
          const numB = parseInt(b.replace("Profile ", ""), 10);
          return numA - numB;
        });

      for (const profileDir of profileDirs) {
        // On Windows, Cookies is in the Network subdirectory
        const cookieFile =
          os === "win32"
            ? join(dataDir, profileDir, "Network", "Cookies")
            : join(dataDir, profileDir, "Cookies");

        if (existsSync(cookieFile)) {
          paths.push(cookieFile);
        }
      }
    } catch {
      // Can't read the data directory — skip
    }
  }

  return paths;
}

/**
 * Resolve all candidate data directories for a browser on the current platform.
 * Returns absolute paths (may include standard, Flatpak, and Snap locations).
 */
function resolveBrowserDataDirs(browser: BrowserDef, os: string, home: string): string[] {
  const relPaths = browser.dataDirs[os as keyof typeof browser.dataDirs];
  if (!relPaths || relPaths.length === 0) return [];

  return relPaths.map((relPath) => {
    if (os === "win32") {
      const localAppData = process.env["LOCALAPPDATA"] ?? join(home, "AppData", "Local");
      return join(localAppData, relPath);
    }
    return join(home, relPath);
  });
}

// ── Cookie extraction ──

/**
 * Extract the user_session cookie from a specific browser's cookie DB.
 */
async function extractCookie(
  cookiePath: string,
  browser: BrowserDef,
  os: string,
): Promise<string | null> {
  // Copy the DB to a temp file to avoid locking issues
  // (the browser may have the DB open)
  const tempPath = join(tmpdir(), `pr-buildr-cookies-${Date.now()}.db`);

  try {
    copyFileSync(cookiePath, tempPath);

    // We need better-sqlite3 for reading the cookie DB.
    // Dynamic import to keep it as an optional dependency.
    let Database: any;
    try {
      const mod = await import("better-sqlite3");
      Database = mod.default ?? mod;
    } catch {
      throw new Error(
        "better-sqlite3 is required for image upload (cookie extraction).\n" +
          "Install it with: npm install better-sqlite3",
      );
    }

    const db = new Database(tempPath, { readonly: true });

    try {
      const row = db
        .prepare(
          `SELECT encrypted_value FROM cookies
         WHERE host_key IN ('.github.com', 'github.com') AND name = 'user_session'
         ORDER BY expires_utc DESC LIMIT 1`,
        )
        .get() as { encrypted_value: Buffer } | undefined;

      if (!row || !row.encrypted_value || row.encrypted_value.length === 0) {
        return null;
      }

      const decrypted = await decryptCookieValue(row.encrypted_value, browser, os);
      return decrypted || null;
    } finally {
      db.close();
    }
  } finally {
    // Clean up temp file
    try {
      unlinkSync(tempPath);
    } catch {
      // Ignore cleanup errors
    }
  }
}

// ── Decryption ──

/**
 * Decrypt a Chrome encrypted cookie value.
 *
 * Chrome cookie encryption differs by platform:
 * - Linux: v10/v11 prefix + AES-128-CBC (PBKDF2 key from "peanuts" or keyring)
 * - macOS: v10 prefix + AES-128-CBC (PBKDF2 key from Keychain)
 * - Windows: v10 prefix + AES-256-GCM (key from Local State, DPAPI)
 */
async function decryptCookieValue(
  encrypted: Buffer,
  browser: BrowserDef,
  os: string,
): Promise<string> {
  // Check for version prefix
  const prefix = encrypted.subarray(0, 3).toString("utf-8");

  if (os === "linux" && (prefix === "v10" || prefix === "v11")) {
    return decryptLinux(encrypted.subarray(3), browser);
  }

  if (os === "darwin" && prefix === "v10") {
    return decryptMacOS(encrypted.subarray(3), browser);
  }

  if (os === "win32" && prefix === "v10") {
    return decryptWindows(encrypted.subarray(3), browser);
  }

  // No recognized prefix — try treating as plaintext (very old Chrome)
  return encrypted.toString("utf-8");
}

/**
 * Linux: AES-128-CBC decryption.
 * Key derived via PBKDF2 from "peanuts" (Chrome's default when no keyring)
 * or from the system keyring.
 */
async function decryptLinux(ciphertext: Buffer, browser: BrowserDef): Promise<string> {
  // Try to get the key from the system keyring first
  let password = await getLinuxKeyringPassword(browser);

  if (!password) {
    // Fall back to Chrome's hardcoded default
    password = "peanuts";
  }

  const key = pbkdf2Sync(password, "saltysalt", 1, 16, "sha1");
  const iv = Buffer.alloc(16, " "); // 16 bytes of spaces

  const decipher = createDecipheriv("aes-128-cbc", key, iv);
  decipher.setAutoPadding(true);

  const decrypted = Buffer.concat([decipher.update(ciphertext), decipher.final()]);

  return decrypted.toString("utf-8");
}

/**
 * macOS: AES-128-CBC decryption.
 * Key derived via PBKDF2 from the Keychain password.
 */
async function decryptMacOS(ciphertext: Buffer, browser: BrowserDef): Promise<string> {
  const serviceName = browser.safeStorageName.darwin;
  if (!serviceName) {
    throw new Error(`No safe storage name configured for ${browser.name} on macOS`);
  }

  const password = await getMacOSKeychainPassword(serviceName);
  const key = pbkdf2Sync(password, "saltysalt", 1003, 16, "sha1");
  const iv = Buffer.alloc(16, " ");

  const decipher = createDecipheriv("aes-128-cbc", key, iv);
  decipher.setAutoPadding(true);

  const decrypted = Buffer.concat([decipher.update(ciphertext), decipher.final()]);

  return decrypted.toString("utf-8");
}

/**
 * Windows: AES-256-GCM decryption.
 * The encryption key is stored in the browser's Local State file,
 * itself encrypted with DPAPI.
 */
async function decryptWindows(ciphertext: Buffer, browser: BrowserDef): Promise<string> {
  // AES-256-GCM: 12-byte nonce + ciphertext + 16-byte auth tag
  const nonce = ciphertext.subarray(0, 12);
  const tag = ciphertext.subarray(ciphertext.length - 16);
  const encryptedData = ciphertext.subarray(12, ciphertext.length - 16);

  const key = await getWindowsEncryptionKey(browser);

  const decipher = createDecipheriv("aes-256-gcm", key, nonce);
  decipher.setAuthTag(tag);

  const decrypted = Buffer.concat([decipher.update(encryptedData), decipher.final()]);

  return decrypted.toString("utf-8");
}

// ── Platform-specific key retrieval ──

/**
 * Get the encryption password from the Linux keyring.
 * Returns null if the keyring is not available or the password is not found.
 */
async function getLinuxKeyringPassword(browser: BrowserDef): Promise<string | null> {
  const application = browser.safeStorageName.linux;
  if (!application) return null;

  return new Promise((resolve) => {
    execFile(
      "secret-tool",
      ["lookup", "application", application],
      { timeout: 5000 },
      (err, stdout) => {
        if (err || !stdout.trim()) {
          resolve(null);
        } else {
          resolve(stdout.trim());
        }
      },
    );
  });
}

/**
 * Get the encryption password from the macOS Keychain.
 */
async function getMacOSKeychainPassword(serviceName: string): Promise<string> {
  return new Promise((resolve, reject) => {
    execFile(
      "security",
      ["find-generic-password", "-s", serviceName, "-w"],
      { timeout: 10000 },
      (err, stdout) => {
        if (err) {
          reject(
            new Error(
              `Could not read ${serviceName} password from Keychain.\n` +
                "You may need to allow access when prompted.",
            ),
          );
        } else {
          resolve(stdout.trim());
        }
      },
    );
  });
}

/**
 * Get the AES-256-GCM encryption key from the Windows Local State file.
 * The key is stored as base64 in Local State JSON, encrypted with DPAPI.
 */
async function getWindowsEncryptionKey(browser: BrowserDef): Promise<Buffer> {
  const localStatePath = resolveWindowsLocalState(browser);
  if (!localStatePath || !existsSync(localStatePath)) {
    throw new Error(`Could not find Local State file for ${browser.name}`);
  }

  const localState = JSON.parse(readFileSync(localStatePath, "utf-8")) as {
    os_crypt?: { encrypted_key?: string };
  };

  const encryptedKeyB64 = localState.os_crypt?.encrypted_key;
  if (!encryptedKeyB64) {
    throw new Error(`No encrypted_key found in Local State for ${browser.name}`);
  }

  // The key is: "DPAPI" prefix (5 bytes) + DPAPI-encrypted key
  const encryptedKey = Buffer.from(encryptedKeyB64, "base64");
  const dpapiBuf = encryptedKey.subarray(5); // Strip "DPAPI" prefix

  // Decrypt with DPAPI via PowerShell
  return decryptWithDPAPI(dpapiBuf);
}

function resolveWindowsLocalState(browser: BrowserDef): string | null {
  const relPath = browser.localStatePaths?.win32;
  if (!relPath) return null;
  const localAppData = process.env["LOCALAPPDATA"] ?? join(homedir(), "AppData", "Local");
  return join(localAppData, relPath);
}

/**
 * Decrypt data using Windows DPAPI via PowerShell.
 */
async function decryptWithDPAPI(encrypted: Buffer): Promise<Buffer> {
  const b64 = encrypted.toString("base64");

  return new Promise((resolve, reject) => {
    const script = `
      Add-Type -AssemblyName System.Security
      $bytes = [Convert]::FromBase64String('${b64}')
      $decrypted = [Security.Cryptography.ProtectedData]::Unprotect($bytes, $null, 'CurrentUser')
      [Convert]::ToBase64String($decrypted)
    `;

    execFile(
      "powershell",
      ["-NoProfile", "-NonInteractive", "-Command", script],
      { timeout: 10000 },
      (err, stdout) => {
        if (err) {
          reject(
            new Error(
              "Failed to decrypt cookie encryption key with DPAPI.\n" +
                "Make sure you are running as the same user that owns the browser profile.",
            ),
          );
        } else {
          resolve(Buffer.from(stdout.trim(), "base64"));
        }
      },
    );
  });
}
