# Right Sidebar Integration Polish Spec

## Goal

Make the V2 right-sidebar integrations behave like first-class Wraith surfaces instead of placeholders, while preserving the app-only build path and the existing Wraith visual language.

## Scope

- Agent sidebar:
  - provider is selectable, not hardwired to Claude;
  - command output streams into a persistent chat-like panel;
  - runs can be stopped;
  - panel state survives sidebar tab changes and sidebar collapse.
- Terminal sidebar:
  - uses an embedded PTY-backed terminal at the workspace root;
  - terminal resizes with the panel;
  - terminal state survives sidebar tab changes and sidebar collapse.
- Git sidebar:
  - detects non-Git folders and offers initialization;
  - shows branch, upstream, remotes, ahead/behind state, changes, and conflicts;
  - supports status refresh, pull, push, sync, commit-all, add-remote, per-file open/reveal, and diff inspection.
- Drag/drop:
  - Finder/webview drops into the file tree copy files into the target folder, including empty tree states;
  - Finder/webview drops onto the editor copy image/PDF assets into root `attachments/` and insert Obsidian embeds at the cursor.

## Non-Goals

- No DMG bundling in this pass.
- No hosted localhost/browser app surface.
- No full merge-conflict resolver modal yet; conflicts must be detected and surfaced clearly, with direct file/diff access.
