---
type: project
status: active
Belongs to: "[[Wraith]]"
---

# Wraith Development Setup

> Status, 2026-05-09: historical setup/planning note. Wraith currently lives
> in this workspace under `wraith_app/`; V3.0.1 is shipped/tagged `v3.0.1`. Keep
> this file for the original repo/machine setup rationale, not as current
> release state.

## Decision

Wraith should live in a **new GitHub repository**, not inside the vault.

The vault remains the source of truth for notes and project thinking. The Wraith repo becomes the source of truth for code, app-specific docs, implementation plans, tests, issues, and pull requests.

Reason: the app is supposed to **open and operate on the vault**, not be mixed into the vault. Keeping code outside avoids build artifacts, dependency folders, generated files, and Git churn polluting the knowledge base.

## Repository layout

Recommended shape:

```text
wraith/
├── README.md
├── AGENTS.md / CLAUDE.md
├── docs/
│   ├── vision.md
│   ├── architecture.md
│   ├── decisions/
│   └── plans/
├── apps/
│   └── desktop/
│       ├── src/              React / TypeScript UI
│       └── src-tauri/        Rust / Tauri backend
├── crates/                   Optional shared Rust crates later
├── packages/                 Optional shared TS packages later
└── tests/
```

For the first pass, do not overbuild the monorepo. If Writer Computer already has a sensible structure, preserve it and add docs around it rather than reorganizing immediately.

## Source base

Writer Computer (`joelbqz/writer-computer`) is the best starting foundation.

Practical route:

1. Create a new GitHub repo for Wraith.
2. Bring in Writer Computer as the initial codebase, either by forking or importing with attribution.
3. Preserve its folder-first workflow, frontmatter preservation, Tauri shell, Rust watcher/index, and editor stack.
4. Patch only the missing compatibility layer first:
   - Obsidian callouts.
   - `![[...]]` image embeds.
   - frontmatter wikilinks.
   - old path-style link/embed resolution.
   - basic image/PDF opening.
5. Inspect Tolaria for implementation ideas, especially rendering/link/file-opening behavior, but do not copy Tolaria’s semantic sidebar/index as V0 scope.

## License note

Writer Computer is GPL-3.0. If Wraith is a derivative/fork distributed publicly, Wraith should be GPL-compatible/open as well. This is fine for a personal/open tool, but it matters if the project later becomes commercial/proprietary.

## Vault vs repo responsibilities

Vault responsibilities:

- Product thinking.
- High-level roadmap.
- Personal requirements.
- Decisions that should remain visible in the knowledge base.
- Links to the code repo and important PRs.

Repo responsibilities:

- Source code.
- Runnable app.
- Developer docs.
- Implementation plans.
- Tests.
- GitHub issues and pull requests.
- CI/release config.

The vault can contain a short project note and strategy notes. The repo should contain the operational development docs needed by agents and human editors.

## Machine layout

### MacBook

Role: **primary product/runtime machine**.

Use it for:

- Running the desktop app as a real macOS app.
- Visual QA.
- VS Code editing.
- Claude Code / Codex coding sessions.
- Tauri macOS packaging and signing later.
- Pulling branches and reviewing PRs locally.

Expected tools:

- VS Code.
- GitHub auth.
- Node + pnpm.
- Rust toolchain.
- Tauri prerequisites.
- Xcode Command Line Tools.

### G14

Role: **agent/build/coordination machine**.

Use it for:

- Hermes planning and repo orchestration.
- Codex / Claude Code work from WSL.
- Reading docs, writing implementation plans, reviewing diffs.
- TS/Rust logic work that does not need macOS GUI verification.
- Creating branches, commits, PRs.
- Running tests that work under Linux/WSL.

Limitations:

- It should not be the final authority on macOS app behavior.
- Tauri desktop GUI and macOS packaging need MacBook verification.

## Hermes role

Hermes lives on the G14, but can still be useful from Telegram because it can:

- maintain the Wraith vault project note;
- clone/pull/push the Wraith repo on the G14;
- write implementation plans;
- dispatch Codex/Claude-style work if configured;
- review diffs and tests;
- turn chat decisions into durable repo docs or vault notes.

Hermes does not need to run on the MacBook for this to work. The MacBook and G14 only need to share the GitHub repo.

## Development workflow

Default loop:

1. Capture product decision in the vault if it affects direction.
2. Mirror actionable developer context into `docs/` in the Wraith repo.
3. Create a branch for one small feature/fix.
4. Let Codex or Claude Code implement against that branch.
5. Run tests locally on the machine doing the work.
6. Push branch to GitHub.
7. Open a PR.
8. Pull/review on MacBook for visual behavior.
9. Merge once it works.

Use PRs even when working alone. They give a clean checkpoint for agents, reviews, and rollback.

## Recommended first milestone

First milestone: **Writer Computer source code imported/forked, renamed to Wraith, and launching on the MacBook.**

This is already a real V0 because it proves the toolchain, repo shape, app shell, and local runtime are under control.

First technical tasks:

1. Create/fork/import the Wraith repo.
2. Install the MacBook development prerequisites.
3. Install project dependencies.
4. Run Writer Computer unchanged once.
5. Rename visible app/product identifiers to Wraith.
6. Launch the app again and verify it opens.
7. Commit the clean baseline.

After V0, the first compatibility milestone is to render the active vault better than Writer does today:

- frontmatter wikilink fields;
- `> [!important]` callouts;
- `![[image.png]]` embeds;
- old path-style embeds;
- ordinary body wikilinks.

## Open decision

Choose whether to:

- fork Writer Computer directly under GitHub, preserving history; or
- create a clean Wraith repo and import Writer Computer as the initial codebase with attribution.

Default recommendation: **fork first for speed**, then rename/rebrand once the prototype proves itself.
