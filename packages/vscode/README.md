# PR Buildr

AI-powered pull request builder for VS Code. Generates PR titles and descriptions from your git diff, commit history, and repo PR template using OpenAI, Anthropic, or Ollama.

## Features

- **One-click PR creation** from the Source Control panel or status bar
- **AI-generated drafts** — fills in your PR template automatically based on the actual diff
- **Review and edit** before creating — editable title, body, base branch, and draft toggle
- **Multiple AI providers** — OpenAI, Anthropic, Ollama (local), or any OpenAI-compatible server
- **Secure API key storage** — keys stored in your OS keychain via VS Code's SecretStorage, never in plain text
- **GitHub OAuth** — automatic sign-in via VS Code's built-in GitHub authentication
- **Push detection** — prompts to push unpushed branches before creating a PR
- **Jira integration** — auto-detect ticket from branch name, prepend to PR title, add link in body
- **Stacked PR support** — save base branch per feature branch for stacked workflows
- **PR template support** — uses your repo's PR template or a built-in default

## Getting Started

### 1. Open PR Buildr

Three ways to access it:

- **Source Control panel** — click the git-pull-request icon in the title bar
- **Status bar** — click "PR Buildr" in the bottom-left
- **Command Palette** — `Ctrl+Shift+P` → "PR Builder: Create Pull Request"

### 2. GitHub Authentication

On first use, VS Code will prompt you to sign in with GitHub via OAuth. This is automatic — no tokens to copy or environment variables to set.

### 3. AI Provider Setup

The extension will prompt you to set an API key on first use. Keys are stored securely in your OS keychain.

Set a key anytime via the Command Palette:

- `PR Builder: Set OpenAI API Key`
- `PR Builder: Set Anthropic API Key`
- `PR Builder: Set OpenAI-Compatible API Key`

Ollama requires no API key — just have [Ollama](https://ollama.com) running locally.

Environment variables (`OPENAI_API_KEY`, `ANTHROPIC_API_KEY`) are also supported as a fallback.

## Commands

| Command | Description |
|---|---|
| PR Builder: Create Pull Request | Open the PR creation panel |
| PR Builder: Set Base Branch | Pick a base branch for the current branch |
| PR Builder: Show Base Branch | Display the resolved base branch |
| PR Builder: Clear Base Branch | Remove the saved base branch |
| PR Builder: Regenerate Draft | Re-run AI generation on the active panel |
| PR Builder: Set OpenAI API Key | Store your OpenAI key securely |
| PR Builder: Set Anthropic API Key | Store your Anthropic key securely |
| PR Builder: Set OpenAI-Compatible API Key | Store a custom server API key securely |

## Settings

Open VS Code Settings (`Ctrl+,`) and search "PR Buildr":

| Setting | Default | Description |
|---|---|---|
| `pr-buildr.defaultProvider` | `openai` | AI provider (`openai`, `anthropic`, `ollama`, `openai-compatible`) |
| `pr-buildr.defaultModel` | *(provider default)* | AI model override (e.g., `gpt-4o`, `claude-sonnet-4-20250514`) |
| `pr-buildr.ollamaBaseUrl` | `http://127.0.0.1:11434` | Ollama server URL |
| `pr-buildr.openaiCompatibleBaseUrl` | *(empty)* | OpenAI-compatible server URL |
| `pr-buildr.jiraProjectUrl` | *(empty)* | Jira project base URL (e.g., `https://company.atlassian.net`) |
| `pr-buildr.jiraProjectKey` | *(empty)* | Jira project key (e.g., `AA`, `PRD`, `DATATEAM`) |

## PR Template

The extension looks for your repo's PR template in this order:

1. `pull_request_template.md` (repo root)
2. `PULL_REQUEST_TEMPLATE.md` (repo root)
3. `.github/pull_request_template.md`
4. `.github/PULL_REQUEST_TEMPLATE.md`
5. `docs/pull_request_template.md`

If none is found, a built-in default template is used.

## Jira Integration

PR Buildr includes a lightweight Jira integration — no Jira API or authentication required.

### How it works

1. Configure your Jira project URL and key (in VS Code settings or `.pr-builder.json`)
2. When creating a PR, the extension detects ticket IDs from your branch name (e.g., `AA-1234-fix-login` → `AA-1234`)
3. The ticket is prepended to the PR title: `AA-1234: <AI title>`
4. A link to the Jira ticket is included in the PR body

### Setup in VS Code

- If Jira is configured, a **Jira Ticket** text field appears in the webview panel, auto-filled from your branch name. You can edit or clear it.
- If Jira is not configured, a collapsible **Integrations** section appears. Click it to expand, then click **Configure** next to Jira to enter your project URL and key.
- You can also set the values directly in VS Code Settings (`Ctrl+,`) under `pr-buildr.jiraProjectUrl` and `pr-buildr.jiraProjectKey`.

### Disabling Jira

Set `jira.enabled: false` in `.pr-builder.json` to hide all Jira UI and skip ticket detection entirely.

## Base Branch / Stacked PRs

For stacked PR workflows, save a base branch per feature branch:

1. `Ctrl+Shift+P` → "PR Builder: Set Base Branch"
2. Select the branch your current branch should target
3. This is saved in `.pr-builder.json` and used automatically for future PRs

## Also Available as a CLI

PR Buildr also has a command-line interface. See the [project repository](https://github.com/Tjhohn/Pr-Buildr) for CLI installation and usage.

## License

MIT
