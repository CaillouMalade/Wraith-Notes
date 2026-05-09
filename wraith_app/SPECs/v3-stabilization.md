# Wraith V3 Stabilization Spec

## Status

Shipped on 2026-05-09 as Wraith `3.0.0`.

This spec is now the historical V3 stabilization record. V3 made the shipped V2
shell feel intentional, especially the agent sidebar, split tabs, media embeds,
and drag/drop paths, without reopening the whole V2 roadmap or redesigning the
app away from the V1/V2 visual language.

## Product Goal

Make Wraith V3 feel like the app Arthur actually wants to live in every day:
local files remain the source of truth, notes stay directly editable, and the
new V2 side surfaces become reliable enough to trust.

## Accepted As-Is

Do not spend V3 time reworking these unless a concrete bug appears:

- Terminal sidebar: works flawlessly.
- Git sidebar: accepted as perfect.
- Settings: accepted as perfect, except for adding agent configuration.
- Asset preview tabs for opened PDFs/images: accepted as perfect.
- Outline panel behavior: accepted as perfect, except for its right-sidebar
  icon.
- Properties panel behavior: accepted as good, except for its right-sidebar
  icon.

## Priority 0: Agent Chat Sidebar

The V2 Agent sidebar is not good enough. Tolaria currently has the better
interaction model and should be inspected as the primary reference before
implementation.

### Desired Behavior

- Add a Settings section for configured agents.
- Arthur can define the agents he has installed, with display names and launch
  commands. Current real examples:
  - Codex -> launched from Terminal as `codex`
  - Claude Code -> launched from Terminal as `claude` or the local Claude Code
    command Arthur configures
  - Hermes -> launched from Terminal as `hermes`
- The Agent sidebar shows these configured agents as first-class options.
- The Agent sidebar should feel like a proper chat interface, not command
  plumbing with a text box attached.
- Agent output streams into the current conversation.
- Runs can be stopped.
- Switching right-sidebar tabs or collapsing/reopening the sidebar must not
  destroy the conversation.

### Settings Model

Each configured agent should have at least:

- display name;
- command string;
- enabled/disabled state;
- optional default args or full command parsing;
- default working directory, initially vault root;
- optional notes/description for Arthur's own memory.

### Chat UX

- Agent selector should show Arthur's configured names.
- Messages should be visually separated by role.
- Composer should stay pinned at the bottom.
- Streaming output should be readable while it arrives.
- Empty state should be quiet and useful, not marketing copy.
- Error states should name the command that failed and include stderr/stdout
  where useful.

### Non-Goals

- No hosted/cloud agent service.
- No database-backed conversation system.
- No agent autonomy beyond launching the configured local command.
- No changes to the Terminal sidebar, which already works well.

## Priority 0: Image Embeds And Drag/Drop

V2 Obsidian-style image embeds and note-body drag/drop are still unreliable.
Arthur observed that literal HTML image tags render extremely well in Wraith:

```html
<img src="/Users/arthurbrourhant/Vaults/Agentic_Vault/Projects/Wraith/BP7T9914.jpg" width="300">
<img src="https://obsidian.md/images/banner.png" width="300">
```

V3 should treat HTML image tags as a first-class image embed path.

### Desired Behavior

- Preserve support for existing Markdown image syntax and Obsidian `![[...]]`
  embeds.
- Add explicit support/tests for HTML `<img>` rendering with:
  - absolute local file paths;
  - vault-relative local paths;
  - remote HTTPS URLs;
  - width attributes.
- When importing a local image into the vault, prefer a portable vault-relative
  path over an absolute machine path.
- Consider making note-body image drop insert HTML image syntax by default:

```html
<img src="attachments/example.jpg" width="300">
```

- If the insert syntax becomes configurable, the default for V3 should likely
  be HTML image tags because that path currently behaves best in the editor.
- Dragging images into an open note should copy them into root `attachments/`
  and insert at the cursor reliably.
- Dragging files into the folder tree should reliably copy/import to the
  targeted folder.

### Explicitly Out

- Dragging PDFs into an open note is not required for V3.
- PDF/image asset preview tabs are already good and should not be redesigned.
- Audio/video embeds are still out of scope.

## Priority 0: Split Tabs

V2 split view uses one global tab strip, then derives what appears in the split.
This causes bad behavior:

- clicking a tab chooses the left side and the following tab becomes the right
  side;
- the user cannot choose each side independently;
- if the desired left tab is rightmost, it can appear twice;
- there is no clear way to move a tab from one side to the other;
- the folder tree has no direct "open in split" action.

### Desired Behavior

- When split view is enabled, the center should have two independent tab
  stacks.
- Each split pane has its own tab strip and active tab.
- Tabs can move between left and right stacks.
- Opening a file from the folder tree targets the active pane.
- File context menu includes an "Open in split" action.
- Toggling split view should preserve the user's current work without
  duplicating tabs unexpectedly.
- Existing asset tabs, Settings tabs, and Markdown tabs should all behave
  predictably inside split panes.

## Priority 1: Sidebar Icon Polish

Small but visible V3 fit-and-finish:

- Properties right-sidebar icon should not be a gear. Use a code/angle-bracket
  flavored icon, similar in spirit to `<>`.
- Outline right-sidebar icon should not reuse the terminal icon. Use a small
  bulleted/list icon.
- File tree icons should communicate file type:
  - folders keep the current folder icons;
  - Markdown keeps a document/note icon;
  - images use a picture/image icon;
  - PDFs use a PDF/document icon;
  - unknown other file types, if surfaced in the tree, use a question-mark file
    icon.

## Priority 1: File Tree Drag/Drop Reliability

Folder-tree drag/drop still feels finicky. V3 should harden it separately from
note-body drops.

Acceptance criteria:

- Dropping one or many Finder files on a folder row imports them into that
  folder.
- Dropping one or many Finder files on a file row imports them into that file's
  containing folder.
- Dropping into empty folder/tree states works.
- The sidebar refreshes after import.
- Failures are visible and explain which path failed.

## Priority 2: HTML Rendering Extras

HTML rendering is not a major product priority, but a few low-cost improvements
would be nice if they fall out naturally.

Observed status:

- HTML table with styled cells works well.
- HTML image tags work very well and are promoted to Priority 0.
- Columns do not work and are not important.
- `<details>` click-to-expand is a little finicky but not important.
- `<sup>`, `<sub>`, and strikethrough do not matter now.
- `<kbd>` and `<abbr>` are not important now.
- Inline `<span style="...">` color/background rendering would be nice if easy,
  especially for highlight-like use cases.

Non-goal: do not turn the editor into a full arbitrary HTML renderer if that
threatens editability, safety, or app stability.

## Ship Summary

V3 shipped:

- settings-backed Agent profiles for Codex, Claude Code, Hermes, and custom
  local commands;
- note-body image drops that copy into root `attachments/` and insert portable
  HTML `<img ... width="300">` embeds;
- HTML image block rendering for absolute local, vault-relative, and remote
  image paths;
- independent left/right split tab stacks with per-pane tab bars and "Open in
  split";
- clearer file-tree import errors and file-type icons;
- right-sidebar icon polish;
- Tauri webview zoom hotkeys for `Command +` and `Command -`;
- final split-tab/sidebar-collapsed overlap and callout-in-quote rendering
  polish.

V3.0.1 shipped as a packaged-app hotfix: agent CLIs are resolved the same way a
GUI app needs to find Terminal-installed tools on macOS, blank newly added agent
profiles remain editable in Settings, and the Agent chat's outgoing message and
Send button use the active accent color.

## Implementation Order

Suggested V3 sequence:

1. Capture this spec and land the low-risk icon polish.
2. Inspect Tolaria's agent/chat implementation and design the settings-backed
   Wraith agent profile model.
3. Rebuild the Agent sidebar around configured local commands.
4. Stabilize HTML image embeds and make image note-drop insert the chosen image
   syntax reliably.
5. Rework split view into two independent tab stacks.
6. Harden file-tree drag/drop import behavior.
7. Sweep small HTML rendering extras only if the higher-priority work is stable.

## Validation

Before shipping V3:

- `pnpm --filter desktop run build`
- `cd apps/desktop/src-tauri && cargo test`
- `cd apps/desktop/src-tauri && cargo clippy`
- `cd apps/desktop/src-tauri && cargo fmt --check`
- Manual Tauri dev pass through:
  - configured Agent sidebar with Codex, Claude Code, and Hermes;
  - Terminal sidebar unchanged;
  - Git sidebar unchanged;
  - right-sidebar icon states;
  - image HTML embeds for local absolute, vault-relative, and remote URLs;
  - image drop into note body;
  - folder-tree drop into folder, file row, and empty folder/tree;
  - split view with independent left/right tab stacks;
  - open file in split from the folder tree.
