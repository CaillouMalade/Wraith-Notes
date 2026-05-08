---
title: Wraith Agent Guide
---

# Wraith Agent Guide

Wraith is the active app. It is a local-first Tauri v2 desktop Markdown vault app: React/TypeScript frontend, Rust/Tauri backend, files-first storage.

## Project Boundary

- Active source: this directory, `wraith_app/`.
- Reference only: `../writer_source_code/` and `../tolaria_source_code_ref_only/`.
- Tolaria is an important feature reference for Wraith V2. Inspect it when useful, but do not edit it unless Arthur explicitly asks.
- Writer Computer is the upstream baseline/reference. Do not edit it unless Arthur explicitly asks.
- Planning notes live in `../Project layout/`.

## Current State

- V1 is shipped, tagged `v1.0.0`, and installed at `/Applications/Wraith.app`.
- Current source may be ahead of V1 as V2 work begins.
- Main next focus: V2 Obsidian/Tolaria compatibility while keeping Writer's simple folder-first model.

## Core Principle

Files first, app second. Markdown files and their frontmatter are the source of truth. Wraith should read, display, edit, and preserve the vault without forcing a database-shaped model onto it.

For Markdown UX, keep one predictable editor surface. Do not add hidden editor/viewer swaps, confusing global raw/preview modes, or behavior that makes Arthur unsure whether he is editing source or viewing a separate representation.

## Architecture

- Frontend: `apps/desktop/src/`
  - React, TypeScript, Zustand stores, CodeMirror/Prosemark editor surface.
  - Editor/UI components: `apps/desktop/src/components/`.
  - Shared frontend utilities: `apps/desktop/src/lib/` and `apps/desktop/src/hooks/`.
- Backend: `apps/desktop/src-tauri/src/`
  - Tauri IPC commands, workspace state, file watching, path handling, shell/CLI integration.
  - Command handlers: `apps/desktop/src-tauri/src/commands/`.
- Specs: `SPECs/`.
- Inherited docs: `docs/`. Useful, but many still describe Writer. Update or supersede them when Wraith behavior diverges.

## Commands

Run from this directory unless noted:

```bash
pnpm app:dev      # real native dev loop, Wraith Dev, com.wraith.dev
pnpm app:build    # release build, Wraith, com.wraith
pnpm --filter desktop run build
```

Rust checks:

```bash
cd apps/desktop/src-tauri
cargo test
cargo clippy
cargo fmt --check
```

Notes:

- `pnpm dev` is frontend/Vite only. Use `pnpm app:dev` for real app behavior.
- `pnpm app:dev` depends on `apps/desktop/package.json` preserving `tauri:dev` with `--config src-tauri/tauri.conf.dev.json`.
- Do not re-add the inherited `prepare: vp config` hook unless Wraith intentionally adopts and configures Vite+ staged hooks.

## Hard Rules

- Check `git status` before editing.
- Preserve user work and keep changes small/reversible.
- For non-trivial features, create or update a spec in `SPECs/` before coding.
- Update `CHANGELOG.md` when completing user-visible Wraith work.
- Do not silently alter Markdown/frontmatter formatting. Round-trip preservation matters.
- Do not collapse dev and release identifiers. `com.wraith.dev` and `com.wraith` must stay isolated.
- Do not restore Writer's updater configuration unless Wraith has its own release pipeline.
- Do not follow Tolaria/Laputa Todoist, CodeScene, Codacy, branch, or push workflow for Wraith unless Arthur explicitly says to.

## V2 Roadmap Frame

Before implementation, refine `SPECs/v2-obsidian-tolaria-compatibility-roadmap.md`. Keep V2 focused on compatibility, not a broad product rewrite.

Likely V2 sequence:

1. Shared vault path/link/asset resolver.
2. Obsidian image embeds: `![[image.png]]` and path-style variants.
3. First-class image/PDF browsing or opening.
4. Obsidian callouts: `> [!important]`, `> [!note]`, etc.
5. Frontmatter wikilinks that display/navigate cleanly while preserving raw files.
6. QA pass against Arthur's real vault patterns.

Useful Tolaria reference areas:

- `../tolaria_source_code_ref_only/src/utils/wikilink*.ts`
- `../tolaria_source_code_ref_only/src/utils/vaultImages.ts`
- `../tolaria_source_code_ref_only/src/utils/vaultAttachments.ts`
- `../tolaria_source_code_ref_only/src/utils/*Markdown.ts`
- `../tolaria_source_code_ref_only/src-tauri/src/vault/frontmatter.rs`
- `../tolaria_source_code_ref_only/src-tauri/src/vault/image.rs`
- `../tolaria_source_code_ref_only/src-tauri/src/vault/parsing.rs`
- `../tolaria_source_code_ref_only/src-tauri/src/frontmatter/`

## Known Gotchas From V1 Setup

- Paths containing spaces broke Writer's old Vite aliases when using `new URL(...).pathname`. Keep `fileURLToPath(new URL(...))` in `apps/desktop/vite.config.ts`.
- Vite+ pre-commit hooks blocked commits without staged config. Wraith removed the root `prepare` script and unset `core.hooksPath`. Do not reintroduce this casually.
- `CLAUDE.md` is a symlink to this file. Keep shared agent guidance here.
