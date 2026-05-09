# Keyboard Shortcuts Spec

## Status

Shipped in V2 (`v2.0.0`).

## Goal

Make the core Wraith keyboard workflow visible and configurable without changing
the app's files-first model or adding a heavy command system.

## Scope

- Add a Keyboard Shortcuts section to Preferences.
- Store shortcuts as ordinary settings so they persist in the existing global /
  workspace settings layer.
- Support the current app-level shortcuts:
  - open search / command palette;
  - create note;
  - go to file;
  - new tab;
  - close tab;
  - toggle left sidebar;
  - toggle right sidebar;
  - toggle split view;
  - back / forward navigation;
  - next / previous tab.
- Keep `Cmd+1` through `Cmd+9` as fixed tab-index shortcuts for now because
  they are a numbered pattern rather than one command binding.
- Keep editor text-formatting shortcuts owned by the editor keymap for now.

## Behavior

- A shortcut row shows the action name, description, current binding, and Reset.
- Clicking a binding starts capture mode; the next non-modifier keydown records
  the binding.
- `Escape` cancels capture.
- `Backspace` or `Delete` clears the binding, disabling that shortcut.
- `Mod` means Command on macOS and Ctrl elsewhere.
- Duplicate bindings are allowed but visibly marked as conflicts in Settings;
  runtime dispatch uses the first matching command in the existing shortcut
  priority order.
- App-level shortcuts should continue to avoid stealing text-editing behavior
  where that was already intentional. Back/forward remains disabled while an
  editable target is focused.

## Non-Goals

- No plugin command registry.
- No per-editor formatting shortcut customization yet.
- No import/export of shortcut profiles.
