# AGENTS.md — Wraith Workspace

This workspace is the Wraith project plus reference source trees. Load this file first when an agent starts from the workspace root.

## Source Boundaries

- `wraith_app/` — active Wraith app source. This is the only codebase to change during normal Wraith work.
- `writer_source_code/` — upstream Writer Computer reference snapshot. Read-only unless Arthur explicitly asks to modify it. Use it as an implementation reference when a Wraith feature already exists upstream.
- `tolaria_source_code_ref_only/` — Tolaria reference/documentation source. Read-only unless Arthur explicitly asks to modify it. Inspect and selectively adapt Tolaria behavior/implementation ideas instead of redeveloping solved pieces from scratch.
- `Project layout/` — project planning notes and durable roadmap/release context. Edit this when framing direction, recording decisions, or updating release/project docs.
- `.claude/` — workspace-local Claude settings. Do not treat permissions here as Wraith product guidance.

## Current Project State

- Wraith is a local-first Tauri v2 / React / TypeScript / Rust Markdown vault app forked from Writer Computer.
- Core principle: files first, app second. The Markdown filesystem is the source of truth.
- V1 is tagged `v1.0.0` as the historical rebrand baseline.
- V2 is shipped/tagged `v2.0.0` as the historical daily-app compatibility baseline.
- V3 is shipped/tagged `v3.0.0`; `v3.0.1` is the current packaged agent hotfix and current daily Wraith release.
- Active `wraith_app/` source should stay aligned with `v3.0.1` plus any intentional post-release fixes.
- Post-V3 focus is cleanup and next-slice stabilization: keep docs current, fix concrete daily-use rough edges as they appear, and polish shipped compatibility/shell surfaces without drifting away from Wraith's files-first model.
- Wraith must keep one predictable editor surface; do not introduce hidden editor/viewer swaps or confusing global raw/preview modes.

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

V2 shipped a broader daily-app pass: shared vault resolver, asset visibility/opening, Obsidian image/PDF embeds, callouts, frontmatter wikilinks, math rendering, configurable shortcuts, split center panes, and right-sidebar Agent/Terminal/Git/Properties/Outline surfaces.

V3 shipped the accepted post-V2 stabilization work: settings-backed Agent profiles, packaged-app CLI resolution for agents, HTML-first image drops into notes, HTML image rendering for local and remote sources, independent split-tab stacks, file-tree drag/drop polish, right-sidebar icon polish, zoom hotkeys, and final callout/split visual fixes.

Known post-V3 follow-ups:

1. Keep documentation, release notes, and agent guidance aligned with the shipped source.
2. Fix concrete daily-use rough edges as Arthur finds them, especially around the shipped Agent/media/split surfaces.
3. Keep selectively borrowing from Writer/Tolaria when they already solve the behavior Wraith needs.
4. Create focused specs for substantial V4/next-slice work instead of reopening the historical V2 or V3 specs.

Use `wraith_app/SPECs/v2-obsidian-tolaria-compatibility-roadmap.md` as the historical V2 spec and `wraith_app/SPECs/v3-stabilization.md` as the historical V3 stabilization record. For new non-trivial work, create or update a focused spec under `wraith_app/SPECs/`.
