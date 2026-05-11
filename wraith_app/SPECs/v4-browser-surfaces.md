# V4 Browser Surfaces

## Status

Active V4 implementation spec.

## Goal

Add a real right-sidebar browser that can stay alive while Arthur moves around
Wraith, without turning the center editor into a web app shell.

The browser is a side tool. Markdown files remain the source of truth, and the
main editor remains Wraith's primary surface.

## Right-Sidebar Browser

### First Pass

- Add a Browser tab to the right sidebar.
- Host pages in a native Tauri child webview rather than an HTML iframe.
- Keep a small React chrome above the webview: Back, Forward, Reload, address
  field, and Go.
- Keep the child webview alive across right-sidebar tab changes so page state,
  scroll position, login/cookie state, and in-page memory survive normal Wraith
  use.
- Hide the child webview when the Browser tab or right sidebar is not visible.
- Persist the last visited URL in app settings so the browser can reopen where
  Arthur left off after app restart.
- Default to a simple home URL setting.

### Boundaries

- This is not a hosted/cloud Wraith mode.
- This does not expose vault files through the browser.
- The browser should not receive Wraith's Tauri IPC bridge on arbitrary remote
  pages.
- Downloads, permissions, devtools, named sessions, and per-workspace browser
  profiles are later work unless the first pass proves too limited.

### Implementation Notes

- Tauri's desktop child webview API is behind the `unstable` feature. Enable it
  deliberately for Wraith rather than approximating the feature with an iframe.
- The React Browser panel owns measuring the content slot. Rust owns creating,
  moving, navigating, hiding, and closing the native child webview.
- Browser memory has two layers:
  - Runtime memory: the native webview instance stays mounted while Wraith is
    open.
  - Restart memory: the current URL is persisted in app settings.

## Localhost Wraith Mode

This remains separate from the right-sidebar browser.

Open questions:

- Whether localhost Wraith should be read/write or read-only.
- How browser access should authenticate to local files.
- Which Tauri IPC-only features need browser equivalents.
- Whether this should begin as a development/debug surface before it becomes a
  daily user feature.

