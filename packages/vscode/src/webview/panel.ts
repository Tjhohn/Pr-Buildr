import * as vscode from "vscode";
import {
  resolveConfig,
  getRemoteUrl,
  parseGitHubRepo,
  getCurrentBranch,
  getBranches,
  getDiff,
  getCommitLog,
  getChangedFiles,
  resolveBaseBranch,
  resolveTemplate,
  createAIProvider,
  createPullRequest,
  hasRemoteBranch,
  getUnpushedCommitCount,
  getCommitCount,
  pushBranch,
  inferTicketFromBranch,
  buildJiraUrl,
  formatTitleWithTicket,
  ensureJiraLinkInBody,
} from "@pr-buildr/core";
import type { PrBuildrConfig, JiraTicket } from "@pr-buildr/core";
import type { FromWebviewMessage, ToWebviewMessage } from "./messages.js";
import { getVSCodeGitHubToken, getAIApiKey, getProviderEnvVar } from "../auth.js";
import { getVSCodeConfig } from "../config.js";
import { randomBytes } from "node:crypto";

// ── Singleton panel state ──

let currentPanel: vscode.WebviewPanel | undefined;

interface PanelState {
  context: vscode.ExtensionContext;
  repoRoot: string;
  owner: string;
  repo: string;
  head: string;
  base: string;
  config: PrBuildrConfig;
  githubToken: string;
  jiraTicket?: JiraTicket;
}

let panelState: PanelState | undefined;

/**
 * Create or reveal the PR Builder webview panel.
 */
export function createOrShow(
  context: vscode.ExtensionContext,
  repoRoot: string,
): void {
  if (currentPanel) {
    currentPanel.reveal(vscode.ViewColumn.One);
    return;
  }

  const panel = vscode.window.createWebviewPanel(
    "pr-buildr.createPR",
    "PR Builder",
    vscode.ViewColumn.One,
    {
      enableScripts: true,
      retainContextWhenHidden: true,
      localResourceRoots: [
        vscode.Uri.joinPath(context.extensionUri, "src", "webview", "html"),
        vscode.Uri.joinPath(context.extensionUri, "dist", "webview"),
        vscode.Uri.joinPath(context.extensionUri, "node_modules", "@vscode", "webview-ui-toolkit", "dist"),
      ],
    },
  );

  currentPanel = panel;

  panel.webview.html = getHtmlContent(panel.webview, context.extensionUri);

  // Handle messages from webview
  panel.webview.onDidReceiveMessage(
    (message: FromWebviewMessage) => handleWebviewMessage(message),
    undefined,
    context.subscriptions,
  );

  // Clean up on close
  panel.onDidDispose(
    () => {
      currentPanel = undefined;
      panelState = undefined;
    },
    undefined,
    context.subscriptions,
  );

  // Start initialization
  initializePanel(context, repoRoot).catch((err: unknown) => {
    const msg = err instanceof Error ? err.message : String(err);
    sendMessage({ type: "status", data: { message: msg, isError: true } });
  });
}

/**
 * Trigger re-generation from outside the webview (e.g., command palette).
 */
export function regenerate(): void {
  if (!currentPanel || !panelState) return;
  generateDraft().catch((err: unknown) => {
    const msg = err instanceof Error ? err.message : String(err);
    sendMessage({ type: "status", data: { message: msg, isError: true } });
  });
}

/**
 * Check if the panel is currently open.
 */
export function isPanelOpen(): boolean {
  return currentPanel !== undefined;
}

// ── Initialization ──

async function initializePanel(
  context: vscode.ExtensionContext,
  repoRoot: string,
): Promise<void> {
  // 1. Detect repo
  const remoteUrl = await getRemoteUrl("origin", repoRoot);
  const { owner, repo } = parseGitHubRepo(remoteUrl);
  const head = await getCurrentBranch(repoRoot);

  // 2. Resolve config with VS Code overrides
  const coreConfig = await resolveConfig(repoRoot);
  const vsConfig = getVSCodeConfig();
  const config: PrBuildrConfig = {
    ...coreConfig,
    ai: {
      ...coreConfig.ai,
      ...(vsConfig.provider ? { provider: vsConfig.provider } : {}),
      ...(vsConfig.model ? { model: vsConfig.model } : {}),
    },
    providers: {
      ...coreConfig.providers,
      ...(vsConfig.ollamaBaseUrl
        ? { ollama: { ...coreConfig.providers?.ollama, baseUrl: vsConfig.ollamaBaseUrl } }
        : {}),
      ...(vsConfig.openaiCompatibleBaseUrl
        ? {
            openaiCompatible: {
              ...coreConfig.providers?.openaiCompatible,
              baseUrl: vsConfig.openaiCompatibleBaseUrl,
            },
          }
        : {}),
    },
  };

  // Apply Jira config from VS Code settings
  if (vsConfig.jiraProjectUrl || vsConfig.jiraProjectKey) {
    config.jira = config.jira ?? {};
    if (vsConfig.jiraProjectUrl) config.jira.projectUrl = vsConfig.jiraProjectUrl;
    if (vsConfig.jiraProjectKey) config.jira.projectKey = vsConfig.jiraProjectKey;
  }

  // 3. Resolve base branch
  const base = await resolveBaseBranch(head, config);

  // 4. Get branches and template
  const branches = await getBranches(repoRoot);
  const template = await resolveTemplate(repoRoot);

  const provider = config.ai?.provider ?? "openai";
  const model = config.ai?.model ?? "default";

  // 5. Resolve Jira ticket
  const jiraEnabled = config.jira?.enabled !== false;
  const jiraProjectUrl = config.jira?.projectUrl;
  const jiraProjectKey = config.jira?.projectKey;
  let jiraTicketId: string | undefined;

  if (jiraEnabled && jiraProjectKey) {
    jiraTicketId = inferTicketFromBranch(head, jiraProjectKey) ?? undefined;
  }

  // 6. Send init to webview
  sendMessage({
    type: "init",
    data: {
      branches,
      base,
      head,
      templateSource: template.source === "builtin" ? "Built-in default" : `Repo`,
      provider,
      model,
      jiraEnabled,
      jiraProjectUrl,
      jiraProjectKey,
      jiraTicketId,
    },
  });

  // 6. Check push status
  sendMessage({ type: "status", data: { message: "Checking branch..." } });
  const pushed = await ensureBranchPushed(head, base, repoRoot);
  if (!pushed) {
    sendMessage({
      type: "status",
      data: { message: "PR creation cancelled — branch not pushed.", isError: true },
    });
    return;
  }

  // 7. Resolve GitHub token
  sendMessage({ type: "status", data: { message: "Authenticating with GitHub..." } });
  let githubToken: string;
  try {
    githubToken = await getVSCodeGitHubToken();
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : String(err);
    sendMessage({ type: "status", data: { message: msg, isError: true } });
    return;
  }

  // 8. Resolve AI API key (if not ollama)
  if (provider !== "ollama") {
    const apiKey = await getAIApiKey(context.secrets, provider);
    if (!apiKey) {
      const envVar = getProviderEnvVar(provider);
      const setCommand = getSetKeyCommand(provider);

      const action = await vscode.window.showWarningMessage(
        `${provider} API key not configured. Set it via command palette or ${envVar} env var.`,
        "Set API Key",
        "Cancel",
      );

      if (action === "Set API Key" && setCommand) {
        await vscode.commands.executeCommand(setCommand);
        // Check again after setting
        const retryKey = await getAIApiKey(context.secrets, provider);
        if (!retryKey) {
          sendMessage({
            type: "status",
            data: { message: "API key not set. Cannot generate draft.", isError: true },
          });
          return;
        }
        // Key was set — set it in env for the provider factory to find
        setEnvKeyForProvider(provider, retryKey);
      } else {
        sendMessage({
          type: "status",
          data: { message: "API key not configured. Cannot generate draft.", isError: true },
        });
        return;
      }
    } else {
      // Ensure the key is available via env var for the provider factory
      setEnvKeyForProvider(provider, apiKey);
    }
  }

  // Store state for message handler (including Jira ticket if resolved)
  let initialJiraTicket: JiraTicket | undefined;
  if (jiraEnabled && jiraTicketId && jiraProjectUrl) {
    initialJiraTicket = { id: jiraTicketId, url: buildJiraUrl(jiraProjectUrl, jiraTicketId) };
  } else if (jiraEnabled && jiraTicketId) {
    initialJiraTicket = { id: jiraTicketId };
  }

  panelState = {
    context, repoRoot, owner, repo, head, base, config, githubToken,
    jiraTicket: initialJiraTicket,
  };

  // 10. Generate draft
  await generateDraft();
}

// ── Draft generation ──

async function generateDraft(): Promise<void> {
  if (!panelState) return;

  const { repoRoot, head, base, config } = panelState;

  sendMessage({ type: "status", data: { message: "Gathering git context..." } });

  const [diff, commits, files] = await Promise.all([
    getDiff(base, head, repoRoot),
    getCommitLog(base, head, repoRoot),
    getChangedFiles(base, head, repoRoot),
  ]);

  if (!diff && commits.length === 0) {
    sendMessage({
      type: "status",
      data: { message: `No changes found between ${base} and ${head}.`, isError: true },
    });
    return;
  }

  sendMessage({ type: "status", data: { message: "Generating PR draft..." } });

  const template = await resolveTemplate(repoRoot);
  const aiProvider = createAIProvider(config);

  // Build Jira ticket for AI context if we have one stored in panel state
  const jiraTicket = panelState.jiraTicket;

  const result = await aiProvider.generateDraft({
    template: template.content,
    baseBranch: base,
    headBranch: head,
    diff,
    fileSummary: files,
    commitSummary: commits,
    jiraTicket: jiraTicket ? { id: jiraTicket.id, url: jiraTicket.url } : undefined,
  });

  // Apply Jira ticket to title and body after AI generation
  let title = result.title;
  let body = result.body;
  if (jiraTicket) {
    title = formatTitleWithTicket(title, jiraTicket.id);
    if (jiraTicket.url) {
      body = ensureJiraLinkInBody(body, jiraTicket.url);
    }
  }

  sendMessage({ type: "draft", data: { title, body } });
}

// ── Webview message handler ──

async function handleWebviewMessage(message: FromWebviewMessage): Promise<void> {
  try {
    switch (message.type) {
      case "create":
        await handleCreate(message.data);
        break;
      case "changeBase":
        handleChangeBase(message.data.base);
        break;
      case "regenerate":
        await generateDraft();
        break;
      case "configureJira":
        await handleConfigureJira();
        break;
      case "ignoreIntegrations":
        // Nothing to persist for now — the webview handles hiding the section
        break;
    }
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : String(err);
    sendMessage({ type: "status", data: { message: msg, isError: true } });
  }
}

async function handleConfigureJira(): Promise<void> {
  const url = await vscode.window.showInputBox({
    prompt: "Jira project URL (e.g., https://company.atlassian.net)",
    placeHolder: "https://company.atlassian.net",
    ignoreFocusOut: true,
  });
  if (!url?.trim()) return;

  const key = await vscode.window.showInputBox({
    prompt: "Jira project key (e.g., AA, PRD, DATATEAM)",
    placeHolder: "AA",
    ignoreFocusOut: true,
  });
  if (!key?.trim()) return;

  // Save to VS Code settings
  const config = vscode.workspace.getConfiguration("pr-buildr");
  await config.update("jiraProjectUrl", url.trim(), vscode.ConfigurationTarget.Global);
  await config.update("jiraProjectKey", key.trim(), vscode.ConfigurationTarget.Global);

  vscode.window.showInformationMessage(`Jira configured: ${key.trim()} at ${url.trim()}`);

  // Update panel state config and re-send init with Jira info
  if (panelState) {
    panelState.config.jira = panelState.config.jira ?? {};
    panelState.config.jira.projectUrl = url.trim();
    panelState.config.jira.projectKey = key.trim();

    const head = panelState.head;
    const jiraTicketId = inferTicketFromBranch(head, key.trim()) ?? undefined;

    // Re-send init to update the webview with Jira state
    const branches = await getBranches(panelState.repoRoot);
    const template = await resolveTemplate(panelState.repoRoot);
    sendMessage({
      type: "init",
      data: {
        branches,
        base: panelState.base,
        head,
        templateSource: template.source === "builtin" ? "Built-in default" : "Repo",
        provider: panelState.config.ai?.provider ?? "openai",
        model: panelState.config.ai?.model ?? "default",
        jiraEnabled: true,
        jiraProjectUrl: url.trim(),
        jiraProjectKey: key.trim(),
        jiraTicketId,
      },
    });
  }
}

async function handleCreate(data: {
  title: string;
  body: string;
  base: string;
  draft: boolean;
  jiraTicketId?: string;
}): Promise<void> {
  if (!panelState) return;

  sendMessage({ type: "creating" });

  const result = await createPullRequest({
    owner: panelState.owner,
    repo: panelState.repo,
    title: data.title,
    body: data.body,
    head: panelState.head,
    base: data.base,
    draft: data.draft,
    token: panelState.githubToken,
  });

  sendMessage({
    type: "created",
    data: { url: result.htmlUrl, number: result.number, draft: result.draft },
  });
}

function handleChangeBase(newBase: string): void {
  if (!panelState) return;
  panelState.base = newBase;
  sendMessage({
    type: "status",
    data: { message: "Base changed. Click Regenerate to update the draft." },
  });
}

// ── Push detection (VS Code notification style) ──

async function ensureBranchPushed(
  branch: string,
  baseBranch: string,
  cwd: string,
): Promise<boolean> {
  const remoteBranchExists = await hasRemoteBranch(branch, "origin", cwd);

  if (!remoteBranchExists) {
    const commitCount = await getCommitCount(baseBranch, "HEAD", cwd);
    const commitLabel = commitCount === 1 ? "1 commit" : `${commitCount} commits`;

    const action = await vscode.window.showWarningMessage(
      `Branch "${branch}" has not been pushed to origin (${commitLabel}). A remote branch is required to create a PR.`,
      "Push to origin",
      "Cancel",
    );

    if (action !== "Push to origin") {
      return false;
    }

    await vscode.window.withProgress(
      { location: vscode.ProgressLocation.Notification, title: `Pushing ${branch} to origin...` },
      async () => {
        await pushBranch(branch, "origin", cwd);
      },
    );

    vscode.window.showInformationMessage(`Pushed ${branch} (${commitLabel}) to origin.`);
    return true;
  }

  // Branch exists — check for unpushed commits
  const unpushedCount = await getUnpushedCommitCount(branch, "origin", cwd);

  if (unpushedCount > 0) {
    const commitLabel = unpushedCount === 1 ? "1 commit" : `${unpushedCount} commits`;

    const action = await vscode.window.showWarningMessage(
      `Branch "${branch}" has ${commitLabel} not yet pushed to origin.`,
      `Push ${commitLabel}`,
      "Continue without pushing",
      "Cancel",
    );

    if (action === "Cancel" || action === undefined) {
      return false;
    }

    if (action?.startsWith("Push")) {
      await vscode.window.withProgress(
        { location: vscode.ProgressLocation.Notification, title: `Pushing to origin...` },
        async () => {
          await pushBranch(branch, "origin", cwd);
        },
      );
      vscode.window.showInformationMessage(`Pushed ${commitLabel} to origin.`);
    }
    // "Continue without pushing" → proceed
  }

  return true;
}

// ── Helpers ──

function sendMessage(message: ToWebviewMessage): void {
  if (currentPanel) {
    currentPanel.webview.postMessage(message);
  }
}

function getSetKeyCommand(provider: string): string | undefined {
  switch (provider) {
    case "openai":
      return "pr-buildr.setOpenAIKey";
    case "anthropic":
      return "pr-buildr.setAnthropicKey";
    case "openai-compatible":
      return "pr-buildr.setOpenAICompatibleKey";
    default:
      return undefined;
  }
}

/**
 * Set the API key in process.env so the core provider factory can find it.
 * The provider factory reads from env vars — we bridge the SecretStorage value.
 */
function setEnvKeyForProvider(provider: string, key: string): void {
  switch (provider) {
    case "openai":
      process.env["OPENAI_API_KEY"] = key;
      break;
    case "anthropic":
      process.env["ANTHROPIC_API_KEY"] = key;
      break;
    case "openai-compatible":
      process.env["LOCAL_AI_API_KEY"] = key;
      break;
  }
}

function getNonce(): string {
  return randomBytes(16).toString("hex");
}

// ── HTML generation ──

function getHtmlContent(
  webview: vscode.Webview,
  extensionUri: vscode.Uri,
): string {
  // Resolve URIs for webview resources
  const toolkitUri = webview.asWebviewUri(
    vscode.Uri.joinPath(extensionUri, "node_modules", "@vscode", "webview-ui-toolkit", "dist", "toolkit.js"),
  );

  // Try dist/webview first (built), fall back to src/webview/html (development)
  const scriptUri = webview.asWebviewUri(
    vscode.Uri.joinPath(extensionUri, "dist", "webview", "main.js"),
  );
  const styleUri = webview.asWebviewUri(
    vscode.Uri.joinPath(extensionUri, "dist", "webview", "styles.css"),
  );

  const nonce = getNonce();

  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <meta http-equiv="Content-Security-Policy" content="default-src 'none'; style-src ${webview.cspSource} 'unsafe-inline'; script-src 'nonce-${nonce}' ${webview.cspSource}; font-src ${webview.cspSource};">
  <link rel="stylesheet" href="${styleUri}">
  <title>PR Builder</title>
</head>
<body>
  <h2>Create Pull Request</h2>

  <div class="info-grid">
    <span class="info-label">Head:</span>
    <span class="info-value" id="head-value">...</span>

    <span class="info-label">Base:</span>
    <span class="info-value">
      <vscode-dropdown id="base-dropdown">
        <vscode-option>Loading...</vscode-option>
      </vscode-dropdown>
    </span>

    <span class="info-label">Template:</span>
    <span class="info-value" id="template-value">...</span>

    <span class="info-label">Provider:</span>
    <span class="info-value" id="provider-value">...</span>
  </div>

  <!-- Jira ticket field (shown when configured) -->
  <div id="jira-section" class="form-group hidden">
    <label class="form-label" for="jira-field">Jira Ticket</label>
    <vscode-text-field id="jira-field" placeholder="e.g., AA-1234" disabled></vscode-text-field>
  </div>

  <!-- Integrations section (shown when Jira NOT configured) -->
  <div id="integrations-section" class="integrations-section hidden">
    <div class="integrations-header" id="integrations-toggle">
      <span class="integrations-chevron" id="integrations-chevron">&#9654;</span>
      Integrations
    </div>
    <div id="integrations-body" class="integrations-body hidden">
      <div class="integration-item jira-disabled" id="jira-configure-btn">
        <span>Jira: Not configured</span>
        <vscode-link id="jira-configure-link">Configure</vscode-link>
      </div>
      <div class="integration-item" id="ignore-integrations-btn">
        <vscode-link>Ignore integrations</vscode-link>
      </div>
    </div>
  </div>

  <vscode-divider></vscode-divider>

  <div class="form-group">
    <label class="form-label" for="title-field">Title</label>
    <vscode-text-field id="title-field" placeholder="PR title..." disabled></vscode-text-field>
  </div>

  <div class="form-group">
    <label class="form-label" for="body-field">Body</label>
    <vscode-text-area id="body-field" rows="20" placeholder="PR description..." resize="vertical" disabled></vscode-text-area>
  </div>

  <div id="stale-warning" class="stale-warning hidden">
    Base branch changed. Click Regenerate to update the draft.
  </div>

  <div class="button-row">
    <vscode-checkbox id="draft-checkbox">Draft</vscode-checkbox>
    <span class="spacer"></span>
    <vscode-button id="regenerate-btn" appearance="secondary" disabled>
      Regenerate
    </vscode-button>
    <vscode-button id="create-btn" disabled>
      Create PR
    </vscode-button>
  </div>

  <div id="success-result" class="success-result hidden"></div>

  <div class="status-bar" id="status-bar">
    <vscode-progress-ring id="progress-ring" class="hidden"></vscode-progress-ring>
    <span id="status-message" class="status-message">Initializing...</span>
  </div>

  <script type="module" nonce="${nonce}" src="${toolkitUri}"></script>
  <script nonce="${nonce}" src="${scriptUri}"></script>
</body>
</html>`;
}
