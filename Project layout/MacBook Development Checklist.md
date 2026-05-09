---
type: project
status: active
Belongs to: "[[Wraith]]"
---

# Wraith MacBook Development Checklist

> Status, 2026-05-09: historical MacBook setup checklist from the V1 import
> phase. V2 is now shipped/tagged `v2.0.0`; use [[Dev vs Release Builds]] and
> `wraith_app/AGENTS.md` for current app commands.

This is the MacBook setup list for taking Writer Computer’s source code, renaming it to Wraith, and getting the app open locally.

## Goal

The MacBook should be able to:

- clone/pull/push the Wraith repo;
- install JavaScript/TypeScript dependencies;
- compile the Rust/Tauri backend;
- run the app in development mode;
- edit code comfortably in VS Code or Zed;
- run Claude Code and Codex against the repo.

## Required accounts and access

- GitHub account access.
- SSH key or GitHub CLI auth on the MacBook.
- Access to the future Wraith GitHub repo.
- Access to the active vault clone if testing against the real vault.

## Required base tools

### Xcode Command Line Tools

Needed for native builds, Git, compilers, and Rust/Tauri dependencies.

Check:

```bash
xcode-select -p
```

Install if missing:

```bash
xcode-select --install
```

### Homebrew

Package manager for macOS developer tools.

Check:

```bash
brew --version
```

Install from: `https://brew.sh/`

### Git

Needed for repo work and PR branches.

Check:

```bash
git --version
git config --global user.name
git config --global user.email
```

Recommended identity:

```bash
git config --global user.name "Arthur Brht"
git config --global user.email "arthurbrht@gmail.com"
```

### GitHub CLI

Useful for login, cloning, PRs, and checking auth.

Install:

```bash
brew install gh
```

Login:

```bash
gh auth login
```

Check:

```bash
gh auth status
```

## JavaScript / TypeScript toolchain

Writer Computer uses a TypeScript frontend. Wraith will inherit that.

### Node.js

Recommended route: install via Homebrew for simplicity, or `nvm`/`fnm` later if version switching becomes useful.

Simple install:

```bash
brew install node
```

Check:

```bash
node --version
npm --version
```

### pnpm

Likely needed because modern TS/Tauri monorepos often use pnpm. Check the repo lockfile when cloned; if it has `pnpm-lock.yaml`, use pnpm.

Install:

```bash
corepack enable
corepack prepare pnpm@latest --activate
```

Check:

```bash
pnpm --version
```

## Rust / Tauri toolchain

Writer Computer uses Tauri v2 with a Rust backend.

### Rust

Install:

```bash
curl --proto '=https' --tlsv1.2 -sSf https://sh.rustup.rs | sh
```

Then restart the terminal or run the command rustup prints for loading Cargo into PATH.

Check:

```bash
rustc --version
cargo --version
rustup --version
```

### Tauri CLI

Usually installed as a project dependency, not globally. First try repo commands from `package.json`.

If a global CLI is needed later:

```bash
cargo install tauri-cli --version '^2.0.0'
```

But default preference: **use the repo’s package scripts**, e.g. `pnpm tauri dev`, `pnpm dev`, or whatever Writer Computer defines.

## Editor choice

You do not have to decide permanently between VS Code and Zed.

### VS Code

Safer default because:

- best extension ecosystem;
- easiest with TypeScript, Rust, Tauri, ESLint, Prettier;
- Claude/Codex docs and agent tooling often assume it;
- better when you are new to non-Python projects.

Recommended extensions:

- `rust-lang.rust-analyzer`
- `tauri-apps.tauri-vscode`
- `svelte.svelte-vscode` only if the repo uses Svelte; likely not needed for Writer Computer if React.
- `dbaeumer.vscode-eslint`
- `esbenp.prettier-vscode`
- `bradlc.vscode-tailwindcss`
- `GitHub.vscode-pull-request-github`

### Zed

Good if you like speed and low visual friction. Fine for editing, but slightly less beginner-proof for debugging a new stack.

Recommended approach:

- Use **VS Code first** until Wraith launches and the project shape is understood.
- Try Zed later for normal editing once the build commands are known.

## Agent coding tools

### Claude Code

Check:

```bash
claude --version
```

If missing, install using the current Anthropic instructions.

### Codex

Check:

```bash
codex --version
```

If missing, install using the current OpenAI/Codex instructions.

## First repo commands once Wraith exists

Clone:

```bash
gh repo clone <owner>/wraith
cd wraith
```

Install dependencies:

```bash
pnpm install
```

Find available commands:

```bash
pnpm run
```

Likely dev command, depending on Writer Computer’s package scripts:

```bash
pnpm tauri dev
```

or:

```bash
pnpm dev
```

## V0 success check

V0 is done when:

- repo is cloned on the MacBook;
- dependencies install without unexplained errors;
- app opens locally;
- visible app name says Wraith somewhere meaningful;
- the renamed baseline is committed and pushed;
- the app can open a workspace/vault at least as well as Writer Computer did before renaming.

## Do not install yet unless needed

Avoid extra stack until there is a real reason:

- Docker;
- PostgreSQL / SQLite GUIs;
- native packaging/signing certificates;
- app auto-updater tooling;
- mobile tooling;
- custom plugin tooling.

V0 should stay: GitHub repo, Node/pnpm, Rust/Tauri, editor, app opens.
