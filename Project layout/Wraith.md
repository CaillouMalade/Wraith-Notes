---
type: project
status: active
---

# Wraith

Wraith is Arthur's local-first desktop Markdown vault app.

## Goal

Build a desktop app over the existing Markdown vault, without replacing the
vault as the source of truth.

Core principle: **files first, app second**.

## Current State

- V1 (`v1.0.0`) is the historical Writer Computer rebrand baseline.
- V2 (`v2.0.0`) shipped on 2026-05-09 as the historical daily-app compatibility baseline.
- V3 (`v3.0.0`) shipped on 2026-05-09 as the post-V2 stabilization release.
- V3.0.1 (`v3.0.1`) shipped on 2026-05-09 as the packaged agent hotfix and is the current daily release.
- Active source lives in `wraith_app/` and should remain aligned with the
  current shipped tag plus intentional post-release fixes.
- Writer and Tolaria source trees are read-only implementation references:
  inspect and selectively adapt what already works there instead of rebuilding
  solved behavior from scratch.

## Current Capabilities

- Desktop shell: Tauri v2.
- Native layer: Rust.
- UI: React + TypeScript.
- Editor: CodeMirror/Prosemark with direct Markdown editability.
- Folder-first navigation over local vault files.
- Proper frontmatter preservation/editing on every note.
- Body wikilinks, old path-style resolver fallback, and frontmatter wikilink
  display/navigation.
- Supported image/PDF assets visible in the sidebar, search, command palette,
  and first-class read-only asset tabs.
- Markdown image links and Obsidian-style image/PDF embeds resolve through the
  shared vault resolver.
- HTML image blocks resolve for local absolute, vault-relative, and remote
  sources.
- Note-body image drops copy into root `attachments/` and insert portable HTML
  `<img ... width="300">` embeds.
- Obsidian callout rendering, KaTeX math decorations, Mermaid, tables, code
  blocks, and existing Markdown editing polish.
- Configurable app-level keyboard shortcuts.
- Independent split center panes with per-pane tab stacks.
- Right sidebar with Settings-backed Agent profiles, Terminal, Git, Properties,
  and Outline surfaces.
- Integrated terminal and Git workflows are accepted as strong daily surfaces.
- Agent workflows are local CLI-backed and configurable for Codex, Claude Code,
  Hermes, and custom commands.

## Post-V3 Focus

- Keep docs, release notes, and agent guidance aligned with the shipped source.
- Fix concrete daily-use rough edges as they appear, especially around the
  shipped Agent/media/split surfaces.
- Define the next substantial roadmap slice in a focused spec before coding.
- Keep borrowing from Writer/Tolaria where they already contain an
  implementation pattern Wraith can adapt.
- Preserve the V1/V2 visual language; do not redesign the app away from its
  quiet folder-first feel.

## Non-Goals For Now

- Custom database as source of truth.
- Mobile sync.
- Plugin marketplace/system.
- Notion/Tolaria-style database collections.
- Broad semantic sidebar or saved-view system unless Arthur explicitly expands
  scope.
- Graph/backlink surfaces unless they become useful support plumbing for a
  concrete workflow.

## Stack map

```text
Vault files
  ↓
Rust/Tauri backend: file IO, watcher, folder tree, optional Git
  ↓
Light cache: file metadata, parsed frontmatter for display/editing, wikilink targets
  ↓
React/TypeScript frontend
  ↓
Views + CodeMirror editor + Markdown preview
```

## Reference Apps

Writer Computer (`joelbqz/writer-computer`) is the upstream base/reference.

Useful existing pieces:

- Tauri v2 + React + TypeScript + Rust.
- CodeMirror/Prosemark Markdown editor.
- Existing frontmatter parsing and property panel.
- Local-first folder workspace model.
- Rust file index, watcher, `.gitignore` handling, multi-window workspace state.
- Mermaid, tables, code blocks, body wikilinks, and clean nested-bullet handling.
- File extension filtering in the UI.
- macOS release/signing flow.

Tolaria is the main future-direction reference, especially for vault asset
handling, Markdown/media rendering, properties/frontmatter behavior,
right-sidebar workflows, Git/sync/publishing behavior, and implementation
patterns that can be adapted without importing Tolaria's full semantic model.

License note: Writer Computer is GPL-3.0, so a fork/distributed derivative stays GPL-compatible/open.

## Key Logs

- [[V0 Setup Log]]: Writer to Wraith rebrand baseline, retroactively V1.
- [[V2 Release Log]]: shipped V2 contents, release identity, and explicit V3
  deferrals.
- [[V3 Release Log]]: shipped V3 stabilization contents and V3.0.1 packaged
  agent hotfix.
- [[Feature Workflow & Versions]]: current version tracker and release process.
