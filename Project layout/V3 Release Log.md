---
type: project
status: active
Belongs to: "[[Wraith]]"
---

# V3 Release Log

Records the V3 stabilization pass shipped on 2026-05-09, plus the V3.0.1
packaged-agent hotfix.

## Release Identity

- Version: `3.0.0`.
- Git tag: `v3.0.0`.
- Release commit: `4958bec Ship Wraith v3.0.0`.
- Hotfix version: `3.0.1`.
- Hotfix tag: `v3.0.1`.
- Hotfix commit: `8595907 Fix packaged agent profiles`.
- Current active source: `wraith_app/main` is at `v3.0.1`.
- Bundle/version files:
  - `wraith_app/apps/desktop/package.json` -> `3.0.1`.
  - `wraith_app/apps/desktop/src-tauri/Cargo.toml` -> `3.0.1`.
  - `wraith_app/apps/desktop/src-tauri/tauri.conf.json` -> `3.0.1`.

## What Shipped In V3

V3 made the V2 daily-app shell feel intentional and reliable without changing
Wraith's files-first model or visual direction.

- Settings-backed Agent profiles for Codex, Claude Code, Hermes, and custom
  local commands.
- Agent chat remains a local CLI-backed side surface: configured commands run
  at the vault root, stream output into the conversation, and can be stopped.
- Note-body image drops copy images into root `attachments/` and insert
  portable HTML `<img ... width="300">` embeds.
- HTML image block rendering handles local absolute paths, vault-relative
  paths, and remote HTTPS image URLs.
- Split center view now has independent left/right tab stacks with per-pane
  tab bars and active tabs.
- File tree context menus can open files in split.
- Folder-tree drag/drop imports are clearer and more reliable, including empty
  folder/tree states and errors that name the target path.
- File tree icons distinguish Markdown, image, PDF, folder, and unknown file
  kinds.
- Right-sidebar Properties and Outline icons were polished.
- Tauri webview zoom hotkeys are enabled for `Command +` and `Command -`.
- Final V3 visual fixes landed for split-pane tab overlap, right-sidebar
  layering, asset tab chrome spacing, split-pane scroll containment, and
  callout rendering inside blockquotes.

## What Shipped In V3.0.1

V3.0.1 is a packaged-app hotfix focused on the Agent sidebar:

- Packaged macOS builds now resolve configured agent CLIs through the app PATH,
  the user's login shell, Homebrew/npm/mise/asdf/nvm, and common user shim
  directories before spawning.
- Newly added blank agent profiles stay visible in Settings so they can be
  filled in instead of disappearing immediately.
- Agent chat outgoing message bubbles and the Send button use the active accent
  color.

## Historical Inputs

- [[V2 Release Log]] captured the accepted V2 deferrals around note-body media
  drops and split-tab UX.
- `wraith_app/SPECs/v3-stabilization.md` captured the V3 stabilization plan and
  now serves as the historical implementation record.

## Validation Notes

Validation is recorded in the V3 implementation commits and changelog. The
expected release checks remain:

```bash
pnpm --filter desktop run build
cd apps/desktop/src-tauri && cargo test
cd apps/desktop/src-tauri && cargo clippy
cd apps/desktop/src-tauri && cargo fmt --check
```

Manual coverage for V3 centered on:

- configured Agent sidebar with Codex, Claude Code, Hermes, and custom agents;
- note-body image drops and HTML image rendering;
- folder-tree imports into folder rows, file rows, and empty states;
- split view with independent left/right tab stacks;
- asset previews, Terminal, Git, Properties, and Outline still behaving as
  accepted daily surfaces.
