# pr-buildr
AI-powered pull request builder. Generates PR titles and descriptions from your git diff and commit history.
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
git clone https://github.com/<your-username>/pr-buildr.git
cd pr-buildr
pnpm install
pnpm run build
# Link the CLI globally
cd packages/cli
pnpm link --global
Now pr-buildr is available as a command.
Alternatively, run directly without linking:
node packages/cli/dist/index.js <command>
```

## Environment Variables
Variable
GITHUB_TOKEN
OPENAI_API_KEY
ANTHROPIC_API_KEY
GH_TOKEN
PR_BUILDR_PROVIDER
PR_BUILDR_MODEL
PR_BUILDR_DEFAULT_BASE

## GitHub Token Setup
pr-buildr needs a GitHub token to create pull requests. A fine-grained personal access token scoped to a single repo is recommended.
### Create the token
1. Go to github.com/settings/personal-access-tokens/new (https://github.com/settings/personal-access-tokens/new)
2. Token name: pr-buildr (or whatever you like)
3. Expiration: Choose a duration you're comfortable with
4. Repository access: Select "Only select repositories" → choose your repo
5. Permissions — set these three:
Permission
Pull requests
Contents
Metadata
6. Click "Generate token" and copy it
## Set the token
export GITHUB_TOKEN="github_pat_..."
Add it to your shell profile (~/.bashrc, ~/.zshrc, etc.) to persist it.
## Usage
### Create a PR
#### Full interactive flow - generates draft, lets you review/edit, then creates (will confirm branch in origin else will request to push to origin)
pr-buildr create
#### Create as a draft PR
pr-buildr create --draft
#### Skip review and create immediately
pr-buildr create --yes
#### Use a specific AI provider and model
pr-buildr create --provider anthropic --model claude-sonnet-4-20250514
#### Use Ollama (local, no API key needed — requires ollama serve running)
pr-buildr create --provider ollama
#### Specify the base branch
pr-buildr create --base develop
#### Skip AI generation — opens your editor for manual entry
pr-buildr create --no-ai --title "My PR title"
#### Read PR body from a file
pr-buildr create --body-file ./pr-body.md --title "My PR title"
#### Use a custom PR template
pr-buildr create --template ./my-template.md
### Manage base branches
Useful for stacked PR workflows where each feature branch targets another feature branch instead of main.
#### Save a base branch for the current branch
pr-buildr set-base feature/parent-branch
#### Show the resolved base branch and where it came from
pr-buildr show-base
#### Clear the saved base
pr-buildr clear-base
## Configure
### Interactive config file creation
pr-buildr config init
This creates a .pr-builder.json at the repo root. Example:
```json
{
  "defaultBase": "main",
  "ai": {
    "provider": "openai",
    "model": "gpt-4o"
  },
  "github": {
    "draftByDefault": false
  }
}
```
The config file is optional — pr-buildr works with just environment variables.

## PR Template
pr-buildr looks for your repo's PR template in this order:
1. pull_request_template.md (repo root)
2. PULL_REQUEST_TEMPLATE.md (repo root)
3. .github/pull_request_template.md
4. .github/PULL_REQUEST_TEMPLATE.md
5. docs/pull_request_template.md
If none is found, a built-in default template is used.

## AI Providers
- openai (default)
- anthropic
- ollama
- openai-compatible
