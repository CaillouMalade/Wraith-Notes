# AGENTS.md — Wraith Workspace

This workspace is the Wraith project plus reference source trees. Load this file first when an agent starts from the workspace root.

## Source Boundaries

- `wraith_app/` — active Wraith app source. This is the only codebase to change during normal Wraith work.
- `writer_source_code/` — upstream Writer Computer reference snapshot. Read-only unless Arthur explicitly asks to modify it.
- `tolaria_source_code_ref_only/` — Tolaria reference/documentation source. Important feature reference for future Wraith work. Read-only unless Arthur explicitly asks to modify it.
- `Project layout/` — project planning notes and durable roadmap/release context. Edit this when framing direction, recording decisions, or updating release/project docs.
- `.claude/` — workspace-local Claude settings. Do not treat permissions here as Wraith product guidance.

## Current Project State

- Wraith is a local-first Tauri v2 / React / TypeScript / Rust Markdown vault app forked from Writer Computer.
- Core principle: files first, app second. The Markdown filesystem is the source of truth.
- V1 is tagged `v1.0.0` and installed at `/Applications/Wraith.app`.
- The next product focus is V2: Obsidian/Tolaria compatibility for the existing folder-first Wraith app.
- V2 must keep one predictable editor surface; do not introduce hidden editor/viewer swaps or confusing global raw/preview modes.

## Working Rules

- For code work, `cd wraith_app` and read `wraith_app/AGENTS.md` before editing.
- Do not follow Tolaria/Laputa task workflow, Todoist commands, CodeScene gates, or Codacy gates for Wraith unless Arthur explicitly asks. Tolaria is reference material here, not the active project process.
- Inspect Tolaria freely for behavior and implementation ideas, but make changes in `wraith_app/`.
- For non-trivial features, write or update a spec under `wraith_app/SPECs/` before coding.
- Preserve Wraith's dev/release split and local-first file model.
- Preserve attribution/license files inherited from Writer; do not remove them during normal cleanup.

## Common Commands

Run from `wraith_app/` unless noted:

```bash
pnpm app:dev      # native dev app, productName Wraith Dev, identifier com.wraith.dev
pnpm app:build    # release build, productName Wraith, identifier com.wraith
pnpm --filter desktop run build
cd apps/desktop/src-tauri && cargo test
cd apps/desktop/src-tauri && cargo clippy
cd apps/desktop/src-tauri && cargo fmt --check
```

Do not confuse `pnpm dev` with native app development. It is frontend/Vite only and does not launch the Tauri window.

## Roadmap Context

V2 compatibility should be framed holistically before implementation. Expected themes:

1. Shared vault path / link / asset resolver.
2. Obsidian image embeds such as `![[image.png]]`.
3. First-class image/PDF browsing or opening.
4. Obsidian callouts such as `> [!important]`.
5. Frontmatter wikilinks that display and navigate cleanly while preserving raw files.
6. Compatibility QA against Arthur's real vault patterns.

Use `wraith_app/SPECs/v2-obsidian-tolaria-compatibility-roadmap.md` as the current roadmap working surface. Keep semantic indexing, backlinks, saved views, agent sidebar, and database-like abstractions out of V2 unless Arthur explicitly expands scope.
