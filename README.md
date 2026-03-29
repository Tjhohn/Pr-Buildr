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
#### Full interactive flow - generates draft, lets you review/edit, then creates (will confirm branch in origin else will request to push to origin, will also allow you to push commmits not in origin)
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

## VS Code Extension
PR Builder also works as a VS Code extension with a full graphical interface.
### Access
Three ways to open the PR creation panel:
- **Source Control panel** — click the `$(git-pull-request)` icon in the Source Control title bar
- **Status bar** — click "PR Builder" in the bottom-left status bar
- **Command Palette** — `Ctrl+Shift+P` → "PR Builder: Create Pull Request"
### First-Time Setup
No environment variables needed. The extension handles everything through VS Code's UI:
1. **GitHub auth** — VS Code prompts you to sign in via GitHub OAuth on first use. Your token is stored securely by VS Code.
2. **AI API key** — If no key is found, you'll see a notification with a "Set API Key" button. This opens a masked input box. The key is stored in your OS keychain via VS Code's SecretStorage (encrypted, never in plain text files).
You can also set keys anytime via the command palette:
- `PR Builder: Set OpenAI API Key`
- `PR Builder: Set Anthropic API Key`
- `PR Builder: Set OpenAI-Compatible API Key`
### Settings
Open VS Code Settings (`Ctrl+,`) and search "PR Builder":
| Setting | Default | Description |
|---|---|---|
| `pr-buildr.defaultProvider` | `openai` | AI provider (`openai`, `anthropic`, `ollama`, `openai-compatible`) |
| `pr-buildr.defaultModel` | *(provider default)* | AI model override |
| `pr-buildr.ollamaBaseUrl` | `http://127.0.0.1:11434` | Ollama server URL |
| `pr-buildr.openaiCompatibleBaseUrl` | *(empty)* | OpenAI-compatible server URL |
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
### Development / Testing
To test the extension locally:
1. Open the project in VS Code
2. Press `F5` to launch the Extension Development Host
3. In the new window, open a git repository
4. Use any of the access methods above to open the PR panel
/agents      
Switch agent
/compact     
Compact session
/connect     
Connect provider
/copy        
Copy session transcript
/editor      
Open editor
/exit        
Exit the app
/export      
Export session transcript
/fork        
Fork from message
/help        
Help
/init        
create/update AGENTS.md
/mcps        
Toggle MCPs
/models      
Switch model
/new         
New session
/rename      
Rename session
/review      
review changes [commit|branch|pr], defaults to uncommitted
/sessions    
Switch session
/share       
Share session
/skills      
Skills
/status      
View status
/themes      
Switch theme
/thinking    
Hide thinking
/timeline    
Jump to message
/timestamps  
Show timestamps
/undo        
Undo previous message
Plan 
Claude Opus 4.6
Anthropic
