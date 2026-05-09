---
type: project
status: active
Belongs to: "[[Wraith]]"
---

# V2 Release Log

Records the V2 daily-app pass shipped on 2026-05-09.

## Release Identity

- Version: `2.0.0`.
- Git tag: `v2.0.0`.
- Release commit: `c557794 Release Wraith v2.0.0`.
- Active source: `wraith_app/main` is at `v2.0.0`. V2 was originally produced
  in a one-shot release worktree; that worktree has been removed and `v2.0.0`
  is now the V2 baseline.
- Bundle/version files:
  - `wraith_app/apps/desktop/package.json` -> `2.0.0`.
  - `wraith_app/apps/desktop/src-tauri/tauri.conf.json` -> `2.0.0`.

## What Shipped

V2 turned Wraith from the V1 rebrand baseline into the first real daily vault
app pass.

- Shared vault target resolver for note links, Markdown links/images,
  Obsidian embeds, frontmatter wikilinks, ambiguity, missing targets, and
  unsafe traversal.
- Supported image/PDF assets in the sidebar, search index, command palette,
  duplication/import flows, and first-class read-only asset preview tabs.
- Local image/PDF links route into the asset preview system.
- Obsidian image/PDF embeds render as editable-source-friendly decorations.
- Obsidian callouts render as styled readable blocks while preserving raw
  Markdown.
- Frontmatter wikilinks render as clickable chips/links without rewriting the
  underlying YAML.
- KaTeX math decorations for inline and block math.
- Keyboard Shortcuts preferences for app-level shortcut visibility, remapping,
  reset, conflict display, and runtime dispatch.
- Right sidebar shell with Agent, Terminal, Git, Properties, and Outline views.
- Agent panel with provider selection, chat-style history, streaming output,
  stop action, and persistence for provider/custom command choice.
- Integrated PTY-backed Terminal at the vault root.
- Git sidebar with repository detection, initialize/add remote, status,
  changed-file list, pull/push/sync/commit-all, diff viewing, and conflict
  surfacing.
- Git automation preferences for Auto Pull and AutoGit checkpoints.
- Split center view with a draggable divider.
- File-tree drag/drop import support, including empty folder/tree states.
- V2 ship fixes for right-sidebar layering, asset tab chrome spacing, split
  scroll containment, shortcut capture, non-invasive embed previews, and DMG
  bundling.

## Explicit V3 Deferrals

Arthur accepted V2 with these known follow-ups instead of blocking the release:

- Note-body Finder image/PDF drag/drop is not reliable enough to promise.
  Current behavior can copy/import and insert Obsidian embed placeholders, but
  the preview path needs more stabilization before it becomes a supported
  workflow.
- Split view works, but tab/split interactions need V3 polish before the UX
  should be considered fully finished.
- Project docs needed a follow-up cleanup so normal `wraith_app/` source and
  planning notes describe V2 as shipped.

## Source Alignment Cleanup

On 2026-05-09, the normal `wraith_app/` checkout was fast-forwarded from
`96bee6a updated the roadmap` to `c557794 Release Wraith v2.0.0`. The
one-shot release worktree was then removed; `v2.0.0` on `main` is the
single V2 baseline going forward.

## Validation Notes

This log records the shipped release state from the V2 tag and changelog.

Post-ship cleanup validation:

- `pnpm install` from `wraith_app/` reconciled the local checkout with the V2
  lockfile after fast-forwarding active source.
- `pnpm --filter desktop run build` passed on 2026-05-09.
- Rust tests/clippy/fmt were not rerun during this documentation/source
  alignment pass.
