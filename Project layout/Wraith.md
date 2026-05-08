---
type: project
status: active
---

# Wraith

Wraith is the working name for the future custom note-taking app / vault console.

## Goal

Build a desktop app over the existing Markdown vault, without replacing the vault as the source of truth.

Core principle: **files first, app second**.

## Current direction

- Desktop shell: Tauri.
- Native layer: Rust.
- UI: React + TypeScript.
- Editor: CodeMirror 6 first.
- Preview: Markdown renderer with Obsidian/Tolaria syntax support.
- Folder-first navigation, especially when using Obsidian-style workflows.
- Proper frontmatter preservation/editing on every note.
- Wikilinks in the body should work normally.
- Frontmatter wikilinks should display/round-trip correctly, even if they are not used for sidebar semantics.
- Obsidian callouts and embedded media should render or degrade cleanly.
- Old Obsidian path-style links should resolve where possible.
- Git: useful later for history/sync, not the first feature.
- Agent sidebar: future layer, not v0.

## V0 scope

V0 is deliberately smaller than the compatibility roadmap: **get Writer Computer's source code, rename/rebrand it to Wraith, and have the app open on the MacBook.**

That means:

- Wraith repo exists.
- Writer Computer codebase is present with attribution/license preserved.
- App name, visible title, bundle/product naming, and basic branding say Wraith.
- Dependencies install cleanly on the MacBook.
- App launches locally.
- App can open a vault/workspace at least as well as Writer Computer already can.
- No large renderer/indexing changes are required for V0 unless they block launch.

## Not V0

- Block editor.
- Graph visualization.
- Full Git conflict UI.
- AI chat/sidebar.
- Plugin system.
- Mobile sync.
- Custom database as source of truth.
- Backlinks.
- Saved views / filters.
- Semantic index over frontmatter relationships.
- Semantic sidebar.

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

## Reference app

Writer Computer (`joelbqz/writer-computer`) is the current closest base/reference.

Useful existing pieces:

- Tauri v2 + React + TypeScript + Rust.
- CodeMirror/Prosemark Markdown editor.
- Existing frontmatter parsing and property panel.
- Local-first folder workspace model.
- Rust file index, watcher, `.gitignore` handling, multi-window workspace state.
- Mermaid, tables, code blocks, body wikilinks, and clean nested-bullet handling.
- File extension filtering in the UI.
- macOS release/signing flow.

Observed gaps against the active vault:

- Obsidian callouts such as `> [!important]` render as plain quotes, not colored callout boxes.
- Embedded Obsidian images such as `![[...png]]` do not render.
- Wikilinks work in the body but not as links inside frontmatter/property fields.
- Old path-style links/embeds, e.g. `![[2_PROJECTS/.../Pasted image.png]]`, do not resolve.
- Image/PDF files can be allowed by extension filters but do not appear as first-class browsable/openable files yet.
- Saving preserves frontmatter correctly.

Main gap for Wraith V0: keep Writer’s simple folder-first model and add the missing Obsidian/Tolaria compatibility layer around callouts, embeds, frontmatter wikilinks, and old-path resolution. Semantic indexing, backlinks, and saved views are optional later work, not required for the first usable version.

License note: Writer Computer is GPL-3.0, so a fork/distributed derivative stays GPL-compatible/open.

## Status

Name chosen. Writer Computer looks like the strongest base to probe before starting fresh.

## Next actions

- Inspect Tolaria’s editor/rendering pieces for callouts, embeds, frontmatter wikilinks, file-type handling, and old-path link resolution.
- Decide fork-and-prune vs direct patch on Writer Computer.
- Prototype the compatibility layer on top of Writer’s existing Markdown renderer/editor.
- Keep folder tree and frontmatter preservation unchanged unless necessary.
