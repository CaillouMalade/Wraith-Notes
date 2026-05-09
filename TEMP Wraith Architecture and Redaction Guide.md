---
type: temp-doc
status: draft
Belongs to: "[[Wraith]]"
created: 2026-05-09
---

# TEMP Wraith Architecture and Redaction Guide

This is a temporary orientation document for explaining Wraith: what it is, how
it works, how it is built, and what should be redacted when sharing screenshots,
logs, demos, or source context with agents or other people.

Authoritative project guidance still lives in:

- `AGENTS.md`
- `wraith_app/AGENTS.md`
- `Project layout/Wraith.md`
- `Project layout/Feature Workflow & Versions.md`
- `Project layout/V2 Release Log.md`
- `Project layout/V3 Release Log.md`
- `wraith_app/SPECs/v3-stabilization.md`

## Short Description

Wraith is a local-first desktop Markdown vault app.

It is built on:

- Tauri v2 for the native desktop shell;
- Rust for filesystem, watcher, shell, Git, terminal, and native integration;
- React and TypeScript for the UI;
- CodeMirror/Prosemark for the editor surface;
- local Markdown files, folders, assets, and YAML frontmatter as the source of
  truth.

Core principle: files first, app second.

Wraith should open an existing folder in place, read the vault directly from the
filesystem, and avoid turning the vault into an app-owned database. The Markdown
files remain ordinary files that can be edited by other tools.

## Product Model

Wraith treats a vault folder as the working unit.

Inside that folder:

- Markdown files are editable notes.
- YAML frontmatter is metadata, preserved as source text.
- Images and PDFs are supported assets.
- Folders are ordinary filesystem folders.
- Git, if present, is the real Git repository in the vault, not an app-specific
  sync abstraction.

The app adds a better working surface over these files:

- file tree;
- search and command palette;
- tabbed editor;
- asset preview tabs;
- optional split center panes;
- right sidebar tools;
- keyboard shortcuts;
- settings and theme controls.

The app should never silently rewrite an entire vault, migrate it into a hidden
store, or make Markdown/frontmatter non-authoritative.

## Main UI Surfaces

### Left Sidebar

The left sidebar is the vault browser.

It shows:

- folders;
- Markdown notes;
- supported image files;
- supported PDF files.

Expected behavior:

- open notes in editor tabs;
- open images/PDFs in read-only asset preview tabs;
- create, rename, duplicate, delete, and reveal files/folders;
- copy relative or absolute paths;
- import files by drag/drop;
- search from the sidebar search entry.

Current status: V3 added distinct file type icons and hardened folder-tree
drag/drop imports, including clearer failure messages.

### Center Editor

The center surface is for open tabs.

Tab kinds include:

- Markdown note tabs;
- image/PDF asset tabs;
- Settings tab;
- launcher/new tab surface.

Markdown tabs use one predictable editor surface. Wraith should avoid confusing
raw/preview swaps where it is unclear whether the user is editing source or
viewing a separate representation.

Supported note behaviors include:

- Markdown editing;
- H1/frontmatter-derived display titles;
- frontmatter panel;
- body wikilinks;
- frontmatter wikilinks;
- Markdown links;
- Obsidian-style image/PDF embeds;
- HTML image blocks for local absolute, vault-relative, and remote image
  sources;
- image/PDF link routing through the shared vault resolver;
- Obsidian callouts;
- KaTeX math;
- Mermaid diagrams;
- tables and code blocks;
- HTML blocks where CodeMirror/Prosemark support them.

Current status: V3 made HTML `<img>` tags a first-class image embedding path
and note-body image drops insert portable HTML image tags by default.

### Asset Preview Tabs

Images and PDFs open as read-only asset tabs.

Current accepted behavior:

- image preview UI is good;
- PDF preview UI is good;
- zoom/open/reveal controls are good;
- no V3 redesign needed unless a concrete bug appears.

### Split Center View

V2 introduced split center panes. V3 replaced the derived single-tab-order
model with independent split tab stacks.

Current behavior:

- two independent tab stacks;
- each split pane has its own active tab;
- tabs can move between panes;
- opening from the file tree targets the active pane;
- context menu can open a file in split.

### Right Sidebar

The right sidebar contains persistent tool surfaces:

- Agent;
- Terminal;
- Git;
- Properties;
- Outline.

Accepted as good:

- Terminal;
- Git;
- Settings;
- Properties behavior;
- Outline behavior;
- image/PDF asset previews.

Current right-sidebar status:

- Agent is a Settings-backed local CLI chat surface;
- Properties icon has been changed away from gear;
- Outline icon has been changed away from the terminal-like icon.

## How The App Works Internally

### Startup

On launch, Wraith restores or opens a workspace.

The Rust side resolves startup state and workspace information. The frontend
hydrates stores before rendering the active workspace where possible, so the app
avoids a blank or flashing welcome screen.

Dev and release builds are intentionally separate:

- dev product name: `Wraith Dev`;
- dev identifier: `com.wraith.dev`;
- release product name: `Wraith`;
- release identifier: `com.wraith`.

This keeps daily-release state separate from development state.

### Filesystem Reading

The Rust backend reads the vault directory and returns structured directory
entries to the frontend.

Directory entries include:

- name;
- absolute path;
- directory/file flag;
- Markdown flag;
- file kind;
- modified time;
- optional inferred title.

Supported file kinds currently include:

- directory;
- markdown;
- image;
- pdf.

The file tree only displays supported files and folders that contain supported
files. Hidden files and ignored files are not shown.

### File Watching

Wraith watches the workspace for filesystem changes.

When files are created, modified, deleted, or renamed outside the app, the
watcher notifies the frontend so the file tree and open documents can refresh.

The watcher must respect workspace ignore rules and avoid blocking workspace
switching.

### Editing And Saving Notes

Markdown files are loaded into the editor store as open files.

Each open file tracks:

- path;
- content;
- frontmatter;
- title/display title;
- dirty state;
- loading state;
- save errors;
- modified time;
- document stats.

Saving serializes frontmatter and body back to a normal Markdown file.

Important rule: unrelated frontmatter and Markdown formatting should not be
silently rewritten. Preservation matters because the file is the durable source.

### Frontmatter

YAML frontmatter is shown in a properties/frontmatter UI, but the source remains
YAML in the Markdown file.

Wraith should:

- preserve frontmatter when possible;
- expose simple key/value editing;
- render frontmatter wikilinks as clickable display chips/links;
- avoid broad formatting churn when editing one property.

### Link And Asset Resolution

Wraith uses shared resolver logic for local targets.

Resolution covers:

- body wikilinks;
- frontmatter wikilinks;
- Markdown links;
- Markdown image links;
- Obsidian image/PDF embeds;
- local asset opening.

The resolver should distinguish:

- resolved notes;
- resolved assets;
- same-file fragments;
- external URLs;
- external paths;
- ambiguous targets;
- missing targets;
- unsafe paths outside the vault.

Rule: unresolved or ambiguous targets should be visible. Wraith should not guess
silently between equal candidates.

### Images

Current supported paths:

- Markdown image syntax;
- Obsidian-style `![[image.png]]`;
- local asset preview tabs;
- HTML `<img>` tags when they render cleanly in the editor.

V3 direction:

- treat HTML `<img>` as a first-class image embed path;
- prefer vault-relative image paths for imported images;
- likely insert HTML image tags for image drops into note bodies;
- do not require PDF drag/drop into open notes.

Example target syntax:

```html
<img src="attachments/example.jpg" width="300">
```

### Terminal

The Terminal sidebar is a PTY-backed terminal opened at the vault root.

It should:

- remain mounted across sidebar tab changes;
- resize with the panel;
- preserve session state while the sidebar is collapsed/reopened;
- run ordinary shell commands in the current vault.

Current status: accepted as working well.

### Git

The Git sidebar operates on the real Git repository in the vault.

It supports:

- repository detection;
- initialization;
- remote listing/add remote;
- status;
- changed file list;
- pull;
- push;
- sync;
- commit all;
- diffs;
- conflict surfacing.

Current status: accepted as working well.

### Agent Sidebar

The Agent sidebar is a Settings-backed local CLI chat surface.

Current behavior:

- agent list configured in Settings;
- configured agents can include Codex, Claude Code, Hermes, and other local
  commands;
- sidebar presents the configured names directly;
- chat UI is closer to Tolaria's approach than the original V2 command form;
- command output streams into messages;
- runs can be stopped;
- conversation state survives sidebar tab changes and sidebar collapse.

The agent system should launch local CLI commands. It is not a hosted agent
platform and should not create a database-backed conversation model unless that
becomes explicitly necessary later.

## Codebase Layout

Active app source:

```text
wraith_app/
```

Reference-only source:

```text
writer_source_code/
tolaria_source_code_ref_only/
```

Planning and release notes:

```text
Project layout/
```

Important Wraith app paths:

```text
wraith_app/apps/desktop/src/
wraith_app/apps/desktop/src/components/
wraith_app/apps/desktop/src/hooks/
wraith_app/apps/desktop/src/lib/
wraith_app/apps/desktop/src/stores/
wraith_app/apps/desktop/src-tauri/src/
wraith_app/apps/desktop/src-tauri/src/commands/
wraith_app/SPECs/
```

## Build And Development

Run commands from `wraith_app/`.

Native dev app:

```bash
pnpm app:dev
```

Frontend build/type check:

```bash
pnpm --filter desktop run build
```

Release build:

```bash
pnpm app:build
```

Rust checks:

```bash
cd apps/desktop/src-tauri
cargo test
cargo clippy
cargo fmt --check
```

Important distinction:

- `pnpm app:dev` launches the native Tauri dev app.
- `pnpm dev` is Vite/frontend-only and is not the normal Wraith native dev
  loop.

## Version State

Current shipped release:

- V3.0.1;
- version `3.0.1`;
- tag `v3.0.1`;
- release date: 2026-05-09.

Current active work:

- post-V3 cleanup and next-slice stabilization;
- historical spec: `wraith_app/SPECs/v3-stabilization.md`.

Current post-V3 priority order:

1. Keep docs, release notes, and agent guidance aligned with shipped source.
2. Fix concrete daily-use rough edges around Agent, media, split panes, or
   folder-tree imports as they appear.
3. Define the next substantial roadmap slice in a focused spec before coding.
4. Continue borrowing from Writer/Tolaria when they already solve a behavior
   Wraith needs.

## Redaction Guidelines

Use these rules before sharing screenshots, screen recordings, logs, documents,
or source excerpts outside the local Wraith workspace.

### Always Redact

Always redact:

- API keys;
- access tokens;
- OAuth tokens;
- SSH keys;
- private keys;
- `.env` values;
- passwords;
- session cookies;
- authentication headers;
- personal email addresses;
- phone numbers;
- home addresses;
- private calendar/event details;
- private Todoist/task content;
- private client or school information;
- private repository remotes if they identify confidential locations;
- terminal commands that expose secrets;
- terminal output that includes secrets;
- browser URLs with tokens or private query parameters.

### Pictures And Screenshots

Before sharing pictures or screenshots, inspect them for:

- visible note text;
- filenames that reveal private projects;
- absolute filesystem paths;
- vault names;
- user account names;
- Finder sidebar locations;
- terminal prompts;
- Git branch names or remotes;
- app settings values;
- API keys or model/provider credentials;
- chat prompts and agent output;
- personal images in the background;
- people, faces, license plates, addresses, or identifying location details;
- documents visible behind translucent Wraith windows.

Wraith uses translucent/vibrancy-heavy UI, so background content can leak
through screenshots. Check the entire screenshot, not only the app foreground.

For images embedded in notes:

- redact private people or faces unless sharing is intentional;
- redact license plates, addresses, school/client badges, and private documents;
- avoid sharing EXIF-sensitive originals when location metadata may matter;
- prefer cropped or downscaled copies when only layout/debugging matters;
- avoid sending full-resolution photos unless image quality is the actual issue.

### Local Paths

Absolute paths often identify the user, machine, vault, or project.

Example:

```text
/Users/arthurbrourhant/Vaults/Agentic_Vault/Projects/Wraith/example.jpg
```

When sharing externally, usually redact to:

```text
/Users/<user>/Vaults/<vault>/Projects/<project>/example.jpg
```

or:

```text
attachments/example.jpg
```

Within the local Wraith project, absolute paths are fine when they help debug.

### Vault Content

Treat the vault as private by default.

Before sharing note content, redact:

- private names;
- private schedules;
- school/client content;
- unannounced project details;
- proprietary source text;
- prompt logs;
- agent outputs that quote private files;
- pasted external documents.

If the issue is about formatting or rendering, create a minimal synthetic note
that reproduces the behavior instead of sharing the real note.

### Agent And Terminal Output

Agent output can echo private source, note text, file paths, prompts, or tool
results.

Before sharing:

- remove command history unrelated to the issue;
- redact secrets and paths;
- check whether agents quoted large blocks of private files;
- check whether Git output shows private remotes or branch names;
- check whether logs include environment variables.

### Git Data

Usually safe to share:

- high-level status counts;
- generic command failures;
- public open-source commit hashes.

Redact or review first:

- private remote URLs;
- private branch names;
- commit messages containing private context;
- diffs containing note text, personal data, keys, or credentials;
- author emails if privacy matters.

### Settings

Settings screenshots may expose:

- configured agent commands;
- model/provider names;
- custom command paths;
- theme values;
- app support paths;
- Git automation settings.

Agent command names like `codex`, `claude`, and `hermes` are fine locally, but
full custom commands may include sensitive arguments or paths.

### Good Sharing Pattern

For bug reports or agent work, prefer:

1. Minimal synthetic file.
2. Cropped screenshot.
3. Redacted path.
4. Exact Wraith version.
5. Exact steps to reproduce.
6. Expected behavior.
7. Actual behavior.

Example:

```text
Wraith version: 3.0.1
File type: Markdown note
Fixture path: attachments/example.jpg
Steps:
1. Drop image into note body.
2. Save.
3. Reopen note.
Expected: image embed renders.
Actual: raw placeholder remains.
```

## Current Post-V3 Snapshot

Shipped in V3/V3.0.1:

- Settings-backed Agent profiles added.
- Packaged app agent CLI path resolution fixed.
- HTML image embeds stabilized.
- Note-body image drops copy into `attachments/` and insert HTML image tags.
- Split view uses independent tab stacks.
- File-tree "Open in split" added.
- Folder-tree drag/drop imports hardened.
- Properties icon changed away from gear.
- Outline icon changed to a bulleted/list icon.
- File tree image/PDF icons added.

Next:

- keep docs/source guidance current;
- address concrete Agent/media/split/file-tree bugs as Arthur finds them;
- write a focused spec for the next substantial roadmap slice.

## Maintenance Notes

This document is temporary. Useful durable parts have started moving into:

- `Project layout/Wraith.md`;
- `Project layout/Feature Workflow & Versions.md`;
- `wraith_app/AGENTS.md`;
- focused specs under `wraith_app/SPECs/`.

Delete this temp note when it becomes stale.
