import { Command } from "commander";
import ora from "ora";
import {
  resolveConfig,
  getRepoRoot,
  getRemoteUrl,
  parseGitHubRepo,
  getCurrentBranch,
  getDiff,
  getCommitLog,
  getChangedFiles,
  resolveBaseBranch,
  resolveTemplate,
  createAIProvider,
  createPullRequest,
  getGitHubToken,
  createDraft,
  editDraft,
  hasRemoteBranch,
  getUnpushedCommitCount,
  pushBranch,
  writeConfigFile,
  readConfigFile,
  inferTicketFromBranch,
  buildJiraUrl,
  formatTitleWithTicket,
  ensureJiraLinkInBody,
  uploadImages,
  getGitHubSessionCookie,
  insertImagesIntoBody,
  getImageContentType,
  validateImage,
} from "@pr-buildr/core";
import type { DraftState, PrBuildrConfig, JiraTicket, ImageAttachment } from "@pr-buildr/core";
import { readFile, stat } from "node:fs/promises";
import { basename, resolve } from "node:path";
import * as display from "../display.js";
import { openInEditor } from "../editor.js";
import {
  promptCreateAction,
  promptPushRequired,
  promptPushOptional,
  promptJiraUrl,
  promptJiraKey,
  promptSaveJiraConfig,
  promptJiraTicketConfirm,
  promptJiraNoUrlAction,
  promptGitHubCookie,
} from "../prompts.js";

interface CreateOptions {
  base?: string;
  provider?: string;
  model?: string;
  draft?: boolean;
  yes?: boolean;
  title?: string;
  bodyFile?: string;
  ai?: boolean; // Commander stores --no-ai as ai=false
  template?: string;
  jira?: string;
  image?: string[];
}

/**
 * pr-buildr create
 *
 * Main flow: resolve repo → resolve base → load template →
 * generate draft → review/edit → confirm → create PR
 */
export const createCommand = new Command("create")
  .description("Generate and create a pull request")
  .option("--base <branch>", "Base branch for the PR")
  .option("--provider <name>", "AI provider to use")
  .option("--model <name>", "AI model to use")
  .option("--draft", "Create as draft PR")
  .option("--yes", "Skip review and create immediately")
  .option("--title <title>", "PR title (skip AI generation for title)")
  .option("--body-file <path>", "Read PR body from file (skip AI generation)")
  .option("--no-ai", "Skip AI generation entirely")
  .option("--template <path>", "Path to PR template file")
  .option("--jira <ticket>", "Jira ticket ID (e.g., AA-1234)")
  .option("-i, --image <paths...>", "Image files to attach to the PR")
  .action(async (options: CreateOptions) => {
    try {
      await runCreate(options);
    } catch (err: unknown) {
      if (err instanceof Error) {
        display.error(err.message);
      } else {
        display.error(String(err));
      }
      process.exit(1);
    }
  });

async function runCreate(options: CreateOptions): Promise<void> {
  // 1. Detect repo
  const repoRoot = await getRepoRoot();
  const remoteUrl = await getRemoteUrl();
  const { owner, repo } = parseGitHubRepo(remoteUrl);
  const currentBranch = await getCurrentBranch();

  // 2. Resolve config (apply CLI overrides)
  const config = await resolveConfig(repoRoot);
  const effectiveConfig = { ...config };
  if (options.provider || options.model) {
    effectiveConfig.ai = { ...effectiveConfig.ai };
    if (options.provider) effectiveConfig.ai.provider = options.provider;
    if (options.model) effectiveConfig.ai.model = options.model;
  }

  // 3. Resolve base branch
  const baseBranch = await resolveBaseBranch(currentBranch, effectiveConfig, options.base);

  display.info("Repository", `${owner}/${repo}`);
  display.info("Head", currentBranch);
  display.info("Base", baseBranch);

  // 4. Check if branch needs to be pushed to remote
  await ensureBranchPushed(currentBranch, baseBranch, options.yes ?? false);

  // 5. Resolve images
  const images = await resolveImages(options.image);
  if (images.length > 0) {
    display.displayImages(images);
  }

  // 6. Resolve Jira ticket
  const jiraTicket = await resolveJiraTicket(
    currentBranch,
    repoRoot,
    effectiveConfig,
    options.jira,
    options.yes ?? false,
  );
  if (jiraTicket) {
    display.info("Jira", jiraTicket.url ?? jiraTicket.id);
  }

  // 7. Resolve template
  const template = await resolveTemplate(repoRoot, options.template);
  display.info(
    "Template",
    template.source === "builtin" ? "Built-in default" : `Repo (${template.path})`,
  );

  // 8. Check if AI is skipped (--no-ai or --body-file)
  if (options.ai === false || options.bodyFile) {
    await createWithoutAI(
      options,
      owner,
      repo,
      currentBranch,
      baseBranch,
      template.content,
      jiraTicket,
      images,
    );
    return;
  }

  // 9. Gather context for AI
  const spinner = ora("Gathering git context...").start();

  const [diff, commits, files] = await Promise.all([
    getDiff(baseBranch, currentBranch),
    getCommitLog(baseBranch, currentBranch),
    getChangedFiles(baseBranch, currentBranch),
  ]);

  if (!diff && commits.length === 0) {
    spinner.fail("No changes found between base and head.");
    display.warn(`No diff or commits between ${baseBranch} and ${currentBranch}.`);
    process.exit(1);
  }

  spinner.text = "Generating PR draft...";

  display.info("Provider", effectiveConfig.ai?.provider ?? "openai");
  display.info("Model", effectiveConfig.ai?.model ?? "default");
  display.info("Files changed", String(files.length));
  display.info("Commits", String(commits.length));

  // 10. Generate draft via AI
  const aiProvider = createAIProvider(effectiveConfig);

  // Build images metadata for AI context
  const imagesForAI =
    images.length > 0
      ? images.map((img, i) => ({
          index: i + 1,
          fileName: img.fileName,
          altText: img.altText,
        }))
      : undefined;

  let generated: { title: string; body: string };
  try {
    generated = await aiProvider.generateDraft({
      template: template.content,
      baseBranch,
      headBranch: currentBranch,
      diff,
      fileSummary: files,
      commitSummary: commits,
      jiraTicket: jiraTicket ? { id: jiraTicket.id, url: jiraTicket.url } : undefined,
      images: imagesForAI,
    });
    spinner.succeed("Draft generated.");
  } catch (err: unknown) {
    spinner.fail("Failed to generate draft.");
    throw err;
  }

  // Apply title override if provided
  if (options.title) {
    generated.title = options.title;
  }

  // Apply Jira ticket to title and body
  if (jiraTicket) {
    generated.title = formatTitleWithTicket(generated.title, jiraTicket.id);
    if (jiraTicket.url) {
      generated.body = ensureJiraLinkInBody(generated.body, jiraTicket.url);
    }
  }

  // 11. Review and edit loop
  let state: DraftState = createDraft(generated, baseBranch, currentBranch);

  if (options.yes) {
    // Skip review — create immediately
    const isDraft = options.draft ?? effectiveConfig.github?.draftByDefault ?? false;
    await submitPR(state, owner, repo, isDraft, images);
    return;
  }

  // Show draft and enter review loop
  display.displayDraft(state.current.title, state.current.body);

  // Review loop
  while (true) {
    const draftByDefault = effectiveConfig.github?.draftByDefault ?? false;
    const action = await promptCreateAction(draftByDefault);

    switch (action) {
      case "create": {
        const isDraft = options.draft ?? false;
        await submitPR(state, owner, repo, isDraft, images);
        return;
      }

      case "draft": {
        await submitPR(state, owner, repo, true, images);
        return;
      }

      case "edit": {
        const edited = await openInEditor(state.current.title, state.current.body);
        state = editDraft(state, edited);
        display.displayDraft(state.current.title, state.current.body);
        continue;
      }

      case "cancel": {
        display.warn("PR creation cancelled.");
        return;
      }
    }
  }
}

/**
 * Resolve and validate --image file paths into ImageAttachment objects.
 */
async function resolveImages(imagePaths?: string[]): Promise<ImageAttachment[]> {
  if (!imagePaths || imagePaths.length === 0) return [];

  const images: ImageAttachment[] = [];
  let nextId = 1;

  for (const rawPath of imagePaths) {
    // Support "path:alt text" syntax
    let filePath: string;
    let altText: string;

    const colonIdx = rawPath.indexOf(":");
    // Only treat as alt-text separator if the colon is not part of a drive letter (e.g., C:\)
    if (colonIdx > 1) {
      filePath = rawPath.slice(0, colonIdx);
      altText = rawPath.slice(colonIdx + 1);
    } else {
      filePath = rawPath;
      altText = "";
    }

    filePath = resolve(filePath);

    let fileStat;
    try {
      fileStat = await stat(filePath);
    } catch {
      display.error(`Image file not found: ${filePath}`);
      process.exit(1);
    }

    if (!fileStat.isFile()) {
      display.error(`Not a file: ${filePath}`);
      process.exit(1);
    }

    const fileName = basename(filePath);
    validateImage(fileName, fileStat.size);

    const contentType = getImageContentType(fileName);
    if (!contentType) {
      display.error(`Unsupported image type: ${fileName}`);
      process.exit(1);
    }

    if (!altText) {
      altText = fileName.replace(/\.[^.]+$/, ""); // filename without extension
    }

    const id = String(nextId++);
    images.push({
      id,
      fileName,
      localPath: filePath,
      altText,
      contentType,
      size: fileStat.size,
    });
  }

  return images;
}

/**
 * Ensure the current branch exists on the remote and is up to date.
 *
 * Scenario 1: Branch not on remote → must push or cancel (can't create PR without it)
 * Scenario 2: Branch on remote but has unpushed commits → push, continue, or cancel
 * Scenario 3: Branch on remote, no unpushed commits → proceed silently
 */
async function ensureBranchPushed(
  branch: string,
  _baseBranch: string,
  autoConfirm: boolean,
): Promise<void> {
  const remoteBranchExists = await hasRemoteBranch(branch);

  if (!remoteBranchExists) {
    // Scenario 1: Branch not on remote — push is required
    if (autoConfirm) {
      const spinner = ora(`Pushing ${branch} to origin...`).start();
      try {
        await pushBranch(branch);
        spinner.succeed(`Pushed ${branch} to origin.`);
      } catch (err) {
        spinner.fail(`Failed to push ${branch} to origin.`);
        throw err;
      }
      return;
    }

    const action = await promptPushRequired(branch);
    if (action === "cancel") {
      display.warn("PR creation cancelled.");
      process.exit(0);
    }

    const spinner = ora(`Pushing ${branch} to origin...`).start();
    try {
      await pushBranch(branch);
      spinner.succeed(`Pushed ${branch} to origin.`);
    } catch (err) {
      spinner.fail(`Failed to push ${branch} to origin.`);
      throw err;
    }
    return;
  }

  // Branch exists on remote — check for unpushed commits
  const unpushedCount = await getUnpushedCommitCount(branch);

  if (unpushedCount > 0) {
    // Scenario 2: Has unpushed local commits
    if (autoConfirm) {
      const commitLabel = unpushedCount === 1 ? "1 commit" : `${unpushedCount} commits`;
      const spinner = ora(`Pushing ${commitLabel} to origin...`).start();
      try {
        await pushBranch(branch);
        spinner.succeed(`Pushed ${commitLabel} to origin.`);
      } catch (err) {
        spinner.fail("Failed to push to origin.");
        throw err;
      }
      return;
    }

    const action = await promptPushOptional(branch, unpushedCount);
    if (action === "cancel") {
      display.warn("PR creation cancelled.");
      process.exit(0);
    }

    if (action === "push") {
      const commitLabel = unpushedCount === 1 ? "1 commit" : `${unpushedCount} commits`;
      const spinner = ora(`Pushing ${commitLabel} to origin...`).start();
      try {
        await pushBranch(branch);
        spinner.succeed(`Pushed ${commitLabel} to origin.`);
      } catch (err) {
        spinner.fail("Failed to push to origin.");
        throw err;
      }
    }

    // action === "continue" → proceed without pushing
  }

  // Scenario 3: Branch on remote, no unpushed commits → nothing to do
}

/**
 * Resolve Jira ticket for the PR.
 *
 * Returns a JiraTicket if one should be included, or undefined to skip.
 * Handles all prompt flows: explicit flag, inference, URL setup, disable.
 */
async function resolveJiraTicket(
  currentBranch: string,
  repoRoot: string,
  config: PrBuildrConfig,
  explicitTicket?: string,
  autoConfirm?: boolean,
): Promise<JiraTicket | undefined> {
  const jiraConfig = config.jira;

  // If Jira is explicitly disabled, skip completely
  if (jiraConfig?.enabled === false) {
    return undefined;
  }

  const hasUrl = Boolean(jiraConfig?.projectUrl);
  const hasKey = Boolean(jiraConfig?.projectKey);
  const isConfigured = hasUrl && hasKey;

  // 1. Explicit --jira flag
  if (explicitTicket) {
    if (isConfigured) {
      const url = buildJiraUrl(jiraConfig!.projectUrl!, explicitTicket);
      return { id: explicitTicket, url };
    }
    // No URL/key configured — ask for them
    const url = await promptAndSaveJiraConfig(repoRoot, explicitTicket);
    if (url) {
      return { id: explicitTicket, url };
    }
    // User skipped URL — just use ticket ID in title, no link
    return { id: explicitTicket };
  }

  // 2. No explicit flag — try inference if configured
  if (isConfigured) {
    const inferred = inferTicketFromBranch(currentBranch, jiraConfig!.projectKey!);
    if (inferred) {
      if (autoConfirm) {
        const url = buildJiraUrl(jiraConfig!.projectUrl!, inferred);
        return { id: inferred, url };
      }
      const include = await promptJiraTicketConfirm(inferred);
      if (include) {
        const url = buildJiraUrl(jiraConfig!.projectUrl!, inferred);
        return { id: inferred, url };
      }
    }
    return undefined;
  }

  // 3. Not configured but has a project key — try inference with just the key
  if (hasKey && !hasUrl) {
    const inferred = inferTicketFromBranch(currentBranch, jiraConfig!.projectKey!);
    if (inferred) {
      const action = await promptJiraNoUrlAction(inferred);
      if (action === "enter-url") {
        const url = await promptAndSaveJiraConfig(repoRoot, inferred);
        if (url) {
          return { id: inferred, url };
        }
        return { id: inferred };
      }
      if (action === "disable") {
        await disableJira(repoRoot);
        return undefined;
      }
      // "skip"
      return undefined;
    }
  }

  // 4. Not configured at all — skip silently (no prompts)
  return undefined;
}

/**
 * Prompt for Jira project URL and key, optionally save to config.
 * Returns the full browse URL for the ticket, or undefined if skipped.
 */
async function promptAndSaveJiraConfig(
  repoRoot: string,
  ticketId: string,
): Promise<string | undefined> {
  const url = await promptJiraUrl();
  if (!url.trim()) return undefined;

  const key = await promptJiraKey();
  if (!key.trim()) return undefined;

  const save = await promptSaveJiraConfig();
  if (save) {
    const existing = await readConfigFile(repoRoot);
    existing.jira = existing.jira ?? {};
    existing.jira.projectUrl = url.trim();
    existing.jira.projectKey = key.trim();
    await writeConfigFile(repoRoot, existing);
    display.success("Jira config saved to .pr-builder.json");
  }

  return buildJiraUrl(url.trim(), ticketId);
}

/**
 * Disable Jira integration by writing jira.enabled: false to config.
 */
async function disableJira(repoRoot: string): Promise<void> {
  const existing = await readConfigFile(repoRoot);
  existing.jira = existing.jira ?? {};
  existing.jira.enabled = false;
  await writeConfigFile(repoRoot, existing);
  display.success("Jira integration disabled. Run 'pr-buildr config init' to re-enable.");
}

/**
 * Create a PR without AI generation (--no-ai or --body-file).
 */
async function createWithoutAI(
  options: CreateOptions,
  owner: string,
  repo: string,
  head: string,
  base: string,
  templateContent: string,
  jiraTicket?: JiraTicket,
  images?: ImageAttachment[],
): Promise<void> {
  let title = options.title ?? "";
  let body = "";

  if (options.bodyFile) {
    body = await readFile(options.bodyFile, "utf-8");
  } else {
    body = templateContent;
  }

  if (!title) {
    // Open editor to fill in title and body
    display.warn("No AI and no title provided. Opening editor...");
    const edited = await openInEditor(title, body);
    title = edited.title;
    body = edited.body;
  }

  if (!title.trim()) {
    display.error("PR title cannot be empty.");
    process.exit(1);
  }

  // Apply Jira ticket to title and body
  if (jiraTicket) {
    title = formatTitleWithTicket(title, jiraTicket.id);
    if (jiraTicket.url) {
      body = ensureJiraLinkInBody(body, jiraTicket.url);
    }
  }

  const isDraft = options.draft ?? false;
  const state = createDraft({ title, body }, base, head);

  if (options.yes) {
    await submitPR(state, owner, repo, isDraft, images ?? []);
    return;
  }

  display.displayDraft(state.current.title, state.current.body);

  const action = await promptCreateAction(false);

  switch (action) {
    case "create":
      await submitPR(state, owner, repo, false, images ?? []);
      break;
    case "draft":
      await submitPR(state, owner, repo, true, images ?? []);
      break;
    case "edit": {
      const edited = await openInEditor(state.current.title, state.current.body);
      const updatedState = editDraft(state, edited);
      await submitPR(updatedState, owner, repo, isDraft, images ?? []);
      break;
    }
    case "cancel":
      display.warn("PR creation cancelled.");
      break;
  }
}

/**
 * Submit the PR to GitHub. If images are attached, upload them first
 * and insert their URLs into the body.
 */
async function submitPR(
  state: DraftState,
  owner: string,
  repo: string,
  draft: boolean,
  images: ImageAttachment[],
): Promise<void> {
  let finalBody = state.current.body;

  // Upload images if any are attached
  if (images.length > 0) {
    // Acquire session cookie: auto-extract → env var → interactive prompt
    let sessionCookie: string | null = null;

    try {
      sessionCookie = await getGitHubSessionCookie();
    } catch {
      // Auto-extraction failed — try env var
      sessionCookie = process.env["PR_BUILDR_GITHUB_SESSION_COOKIE"]?.trim() || null;
    }

    if (!sessionCookie) {
      display.warn(
        "Could not read GitHub session cookie from browser automatically.\n" +
          "You can also set the PR_BUILDR_GITHUB_SESSION_COOKIE environment variable.",
      );
      sessionCookie = await promptGitHubCookie();
    }

    if (sessionCookie) {
      const imageSpinner = ora("Uploading images...").start();

      try {
        const token = getGitHubToken();

        const uploadResults = await uploadImages(images, {
          owner,
          repo,
          token,
          sessionCookie,
          onProgress: (current, total) => {
            imageSpinner.text = `Uploading image ${current} of ${total}...`;
          },
        });

        finalBody = insertImagesIntoBody(state.current.body, uploadResults);
        imageSpinner.succeed(
          `Uploaded ${uploadResults.length} image${uploadResults.length === 1 ? "" : "s"}.`,
        );
      } catch (err: unknown) {
        imageSpinner.fail("Failed to upload images.");
        const msg = err instanceof Error ? err.message : String(err);
        display.warn(msg);
        display.warn("Creating PR without images. You can add them manually on GitHub.");
      }
    } else {
      display.warn("No session cookie provided. Creating PR without images.");
    }
  }

  const spinner = ora("Creating pull request...").start();

  try {
    const token = getGitHubToken();
    const result = await createPullRequest({
      owner,
      repo,
      title: state.current.title,
      body: finalBody,
      head: state.head,
      base: state.base,
      draft,
      token,
    });

    spinner.succeed(draft ? "Draft PR created!" : "PR created!");
    display.displayResult(result.htmlUrl, result.number, result.draft);
  } catch (err: unknown) {
    spinner.fail("Failed to create PR.");
    throw err;
  }
}
