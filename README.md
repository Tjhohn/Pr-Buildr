# pr-buildr

AI-powered pull request builder. Generates PR titles and descriptions from your git diff and commit history.

Available as both a **CLI tool** and a **VS Code extension**.

## How It Works

1. Detects your repo, current branch, and base branch
2. Gathers the git diff, commit log, and changed files
3. Sends context to an AI provider (OpenAI, Anthropic, or Ollama)
4. Generates a PR title and body following your repo's PR template (or a built-in default)
5. Lets you review and edit before creating
6. Creates the PR via the GitHub API

## Installation

Requires Node.js 20+.

```bash
# Clone and build
git clone https://github.com/Tjhohn/Pr-Buildr.git
cd pr-buildr
pnpm install
pnpm run build

# Link the CLI globally
cd packages/cli
pnpm link --global
```

Now `pr-buildr` is available as a command.

Alternatively, run directly without linking:

```bash
node packages/cli/dist/index.js <command>
```

## Environment Variables

| Variable | Required | Description |
|---|---|---|
| `GITHUB_TOKEN` | Yes | GitHub token for creating PRs (see [GitHub Token Setup](#github-token-setup)) |
| `OPENAI_API_KEY` | If using OpenAI | API key from [platform.openai.com/api-keys](https://platform.openai.com/api-keys) |
| `ANTHROPIC_API_KEY` | If using Anthropic | API key from [console.anthropic.com](https://console.anthropic.com/settings/keys) |
| `GH_TOKEN` | No | Fallback if `GITHUB_TOKEN` is not set (used by GitHub CLI) |
| `PR_BUILDR_PROVIDER` | No | Override AI provider (`openai`, `anthropic`, `ollama`, `openai-compatible`) |
| `PR_BUILDR_MODEL` | No | Override AI model (e.g., `gpt-4o`, `claude-sonnet-4-20250514`) |
| `PR_BUILDR_DEFAULT_BASE` | No | Override default base branch |
| `PR_BUILDR_JIRA_URL` | No | Jira project base URL (e.g., `https://company.atlassian.net`) |
| `PR_BUILDR_JIRA_KEY` | No | Jira project key (e.g., `AA`, `PRD`, `DATATEAM`) |

## GitHub Token Setup

pr-buildr needs a GitHub token to create pull requests. A **fine-grained personal access token** scoped to a single repo is recommended.

### Create the token

1. Go to [github.com/settings/personal-access-tokens/new](https://github.com/settings/personal-access-tokens/new)
2. **Token name**: `pr-buildr` (or whatever you like)
3. **Expiration**: Choose a duration you're comfortable with
4. **Repository access**: Select **"Only select repositories"** → choose your repo
5. **Permissions** - set these three:

| Permission | Access | Why |
|---|---|---|
| Pull requests | Read and write | Create PRs via the API |
| Contents | Read | Verify branches exist |
| Metadata | Read | Required by default |

6. Click **"Generate token"** and copy it

### Set the token

```bash
export GITHUB_TOKEN="github_pat_..."
```

Add it to your shell profile (`~/.bashrc`, `~/.zshrc`, etc.) to persist it.

## Usage

### Create a PR

```bash
# Full interactive flow — generates draft, lets you review/edit, then creates
# Will prompt to push branch to origin if needed
pr-buildr create

# Create as a draft PR
pr-buildr create --draft

# Skip review and create immediately
pr-buildr create --yes

# Use a specific AI provider and model
pr-buildr create --provider anthropic --model claude-sonnet-4-20250514

# Use Ollama (local, no API key needed — requires ollama serve running)
pr-buildr create --provider ollama

# Specify the base branch
pr-buildr create --base develop

# Include a Jira ticket in the PR title and body
pr-buildr create --jira AA-1234

# Skip AI generation — opens your editor for manual entry
pr-buildr create --no-ai --title "My PR title"

# Read PR body from a file
pr-buildr create --body-file ./pr-body.md --title "My PR title"

# Use a custom PR template
pr-buildr create --template ./my-template.md
```

### Manage Base Branches

Useful for stacked PR workflows where each feature branch targets another feature branch instead of `main`.

```bash
# Save a base branch for the current branch
pr-buildr set-base feature/parent-branch

# Show the resolved base branch and where it came from
pr-buildr show-base

# Clear the saved base
pr-buildr clear-base
```

## Configuration

```bash
# Interactive config file creation
pr-buildr config init
```

This creates a `.pr-builder.json` at the repo root. Example:

```json
{
  "defaultBase": "main",
  "ai": {
    "provider": "openai",
    "model": "gpt-4o"
  },
  "github": {
    "draftByDefault": false
  },
  "jira": {
    "projectUrl": "https://company.atlassian.net",
    "projectKey": "AA"
  }
}
```

The config file is optional — pr-buildr works with just environment variables.

## PR Template

pr-buildr looks for your repo's PR template in this order:

1. `pull_request_template.md` (repo root)
2. `PULL_REQUEST_TEMPLATE.md` (repo root)
3. `.github/pull_request_template.md`
4. `.github/PULL_REQUEST_TEMPLATE.md`
5. `docs/pull_request_template.md`

If none is found, a built-in default template is used.

## AI Providers

| Provider | Requires API Key | Notes |
|---|---|---|
| `openai` (default) | Yes (`OPENAI_API_KEY`) | Uses GPT-4o by default |
| `anthropic` | Yes (`ANTHROPIC_API_KEY`) | Uses Claude Sonnet 4 by default |
| `ollama` | No | Requires [Ollama](https://ollama.com) running locally |
| `openai-compatible` | Optional | Any OpenAI-compatible API (configure `baseUrl` in config) |

## Jira Integration

pr-buildr includes a lightweight Jira integration — no Jira API calls or authentication required. It uses the Jira project key to detect ticket IDs from your branch name and includes them in the PR.

### What it does

1. **Detects ticket ID** from the branch name using your configured project key (e.g., branch `AA-1234-fix-login` → ticket `AA-1234`)
2. **Prepends ticket to PR title**: `AA-1234: <AI-generated title>`
3. **Adds Jira link in PR body**: The AI is instructed to include the link, and a fallback ensures it's appended at the bottom if the AI omits it

### Setup

Add to `.pr-builder.json`:

```json
{
  "jira": {
    "projectUrl": "https://company.atlassian.net",
    "projectKey": "AA"
  }
}
```

Or set via environment variables:

```bash
export PR_BUILDR_JIRA_URL="https://company.atlassian.net"
export PR_BUILDR_JIRA_KEY="AA"
```

Or run `pr-buildr config init` which includes Jira setup prompts.

### CLI flag

```bash
# Explicitly specify a Jira ticket (overrides branch name inference)
pr-buildr create --jira AA-1234
```

### Disabling Jira

If your branch names happen to match the Jira pattern but you don't use Jira, you can disable it permanently:

```json
{
  "jira": {
    "enabled": false
  }
}
```

Or select "Disable Jira integration" when prompted by the CLI.

## VS Code Extension

PR Buildr also works as a VS Code extension with a full graphical interface.

Install from the [VS Code Marketplace](https://marketplace.visualstudio.com/items?itemName=tjhohn.pr-buildr-vscode) or search "PR Buildr" in the Extensions view.

### Example

<img width="1131" height="758" alt="image" src="https://github.com/user-attachments/assets/92ee50b9-13fd-48f6-8b15-1591f83d5db2" />

### Access

Three ways to open the PR creation panel:

- **Source Control panel** — click the git-pull-request icon in the Source Control title bar
- **Status bar** — click "PR Buildr" in the bottom-left status bar
- **Command Palette** — `Ctrl+Shift+P` → "PR Builder: Create Pull Request"

### First-Time Setup

No environment variables needed. The extension handles everything through VS Code's UI:

1. **GitHub auth** — VS Code prompts you to sign in via GitHub OAuth on first use. Your token is stored securely by VS Code.
2. **AI API key** — If no key is found, you'll see a notification with a "Set API Key" button. This opens a masked input box. The key is stored in your OS keychain via VS Code's SecretStorage (encrypted, never in plain text files).

You can also set keys anytime via the command palette:

- `PR Builder: Set OpenAI API Key`
- `PR Builder: Set Anthropic API Key`
- `PR Builder: Set OpenAI-Compatible API Key`

### Jira in VS Code

- If Jira is configured (URL + key in VS Code settings or `.pr-builder.json`), a **Jira Ticket** field appears in the webview, auto-filled from your branch name
- If not configured, an **Integrations** dropdown appears where you can click to configure Jira
- You can also set Jira settings directly in VS Code Settings (`Ctrl+,`)

### Settings

Open VS Code Settings (`Ctrl+,`) and search "PR Buildr":

| Setting | Default | Description |
|---|---|---|
| `pr-buildr.defaultProvider` | `openai` | AI provider (`openai`, `anthropic`, `ollama`, `openai-compatible`) |
| `pr-buildr.defaultModel` | *(provider default)* | AI model override |
| `pr-buildr.ollamaBaseUrl` | `http://127.0.0.1:11434` | Ollama server URL |
| `pr-buildr.openaiCompatibleBaseUrl` | *(empty)* | OpenAI-compatible server URL |
| `pr-buildr.jiraProjectUrl` | *(empty)* | Jira project base URL (e.g., `https://company.atlassian.net`) |
| `pr-buildr.jiraProjectKey` | *(empty)* | Jira project key (e.g., `AA`, `PRD`) |

### Commands

All available via `Ctrl+Shift+P`:

| Command | Description |
|---|---|
| PR Builder: Create Pull Request | Open the PR creation panel |
| PR Builder: Set Base Branch | Pick a base branch for the current branch |
| PR Builder: Show Base Branch | Display the resolved base branch |
| PR Builder: Clear Base Branch | Remove the saved base branch |
| PR Builder: Regenerate Draft | Re-run AI generation on the active panel |
| PR Builder: Set OpenAI API Key | Store your OpenAI key securely |
| PR Builder: Set Anthropic API Key | Store your Anthropic key securely |
| PR Builder: Set OpenAI-Compatible API Key | Store a custom API key securely |

## Publishing the VS Code Extension

To publish a new version of the extension to the VS Code Marketplace:

### Prerequisites

1. **Azure DevOps account** — sign up at [dev.azure.com](https://dev.azure.com)
2. **Personal Access Token (PAT)** — create one with **Marketplace > Manage** scope and **All accessible organizations**
3. **Publisher account** — create at [marketplace.visualstudio.com/manage](https://marketplace.visualstudio.com/manage)

### One-time setup

```bash
# Login with your publisher ID and PAT
pnpm exec vsce login <your-publisher-id>
```

### Package locally (test before publishing)

```bash
pnpm run pack-vscode
# Creates packages/vscode/pr-buildr-vscode-X.Y.Z.vsix

# Install and test locally
code --install-extension packages/vscode/pr-buildr-vscode-X.Y.Z.vsix
```

### Publish

```bash
pnpm run publish-vscode
```

This builds all packages, then publishes the extension to the Marketplace.

### Updating the version

Update the `version` field in `packages/vscode/package.json` before publishing a new release.

## Development

### Build

```bash
pnpm install
pnpm run build        # Build all packages (core, cli, vscode)
pnpm run test         # Run all tests (181 tests)
```

### Test the VS Code extension

1. Open the project in VS Code
2. Press `F5` to launch the Extension Development Host
3. In the new window, open a git repository
4. Use the Source Control button, status bar, or Command Palette to open PR Buildr

### Project structure

```
pr-buildr/
├── packages/
│   ├── core/       @pr-buildr/core — shared library (config, git, AI, GitHub, Jira)
│   ├── cli/        @pr-buildr/cli  — command-line interface
│   └── vscode/     pr-buildr-vscode — VS Code extension
├── .pr-builder.json                 — per-repo configuration (optional)
└── package.json                     — monorepo root (build scripts)
```

## License

MIT
