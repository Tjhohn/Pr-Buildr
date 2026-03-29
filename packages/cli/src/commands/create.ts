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
} from "@pr-buildr/core";
import type { DraftState } from "@pr-buildr/core";
import { readFile } from "node:fs/promises";
import * as display from "../display.js";
import { openInEditor } from "../editor.js";
import { promptCreateAction, promptPushRequired, promptPushOptional } from "../prompts.js";

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
  await ensureBranchPushed(currentBranch, options.yes ?? false);

  // 5. Resolve template
  const template = await resolveTemplate(repoRoot, options.template);
  display.info("Template", template.source === "builtin" ? "Built-in default" : `Repo (${template.path})`);

  // 6. Check if AI is skipped (--no-ai or --body-file)
  if (options.ai === false || options.bodyFile) {
    await createWithoutAI(options, owner, repo, currentBranch, baseBranch, template.content);
    return;
  }

  // 7. Gather context for AI
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

  // 7. Generate draft via AI
  const aiProvider = createAIProvider(effectiveConfig);

  let generated: { title: string; body: string };
  try {
    generated = await aiProvider.generateDraft({
      template: template.content,
      baseBranch,
      headBranch: currentBranch,
      diff,
      fileSummary: files,
      commitSummary: commits,
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

  // 8. Review and edit loop
  let state: DraftState = createDraft(generated, baseBranch, currentBranch);

  if (options.yes) {
    // Skip review — create immediately
    const isDraft = options.draft ?? effectiveConfig.github?.draftByDefault ?? false;
    await submitPR(state, owner, repo, isDraft);
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
        await submitPR(state, owner, repo, isDraft);
        return;
      }

      case "draft": {
        await submitPR(state, owner, repo, true);
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
 * Ensure the current branch exists on the remote and is up to date.
 *
 * Scenario 1: Branch not on remote → must push or cancel (can't create PR without it)
 * Scenario 2: Branch on remote but has unpushed commits → push, continue, or cancel
 * Scenario 3: Branch on remote, no unpushed commits → proceed silently
 */
async function ensureBranchPushed(branch: string, autoConfirm: boolean): Promise<void> {
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
 * Create a PR without AI generation (--no-ai or --body-file).
 */
async function createWithoutAI(
  options: CreateOptions,
  owner: string,
  repo: string,
  head: string,
  base: string,
  templateContent: string,
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

  const isDraft = options.draft ?? false;
  const state = createDraft({ title, body }, base, head);

  if (options.yes) {
    await submitPR(state, owner, repo, isDraft);
    return;
  }

  display.displayDraft(state.current.title, state.current.body);

  const action = await promptCreateAction(false);

  switch (action) {
    case "create":
      await submitPR(state, owner, repo, false);
      break;
    case "draft":
      await submitPR(state, owner, repo, true);
      break;
    case "edit": {
      const edited = await openInEditor(state.current.title, state.current.body);
      const updatedState = editDraft(state, edited);
      await submitPR(updatedState, owner, repo, isDraft);
      break;
    }
    case "cancel":
      display.warn("PR creation cancelled.");
      break;
  }
}

/**
 * Submit the PR to GitHub.
 */
async function submitPR(
  state: DraftState,
  owner: string,
  repo: string,
  draft: boolean,
): Promise<void> {
  const spinner = ora("Creating pull request...").start();

  try {
    const token = getGitHubToken();
    const result = await createPullRequest({
      owner,
      repo,
      title: state.current.title,
      body: state.current.body,
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
