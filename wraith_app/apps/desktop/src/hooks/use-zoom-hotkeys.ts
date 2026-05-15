import { useEffect } from "react";
import { useUIStore } from "@/stores/ui-store";
import { useSettingsStore } from "@/stores/settings-store";
import { activeMode } from "@/lib/theme";

/**
 * Cmd+= / Cmd+- / Cmd+0 routed to the focused panel instead of the whole
 * window. We disabled Tauri's built-in `zoomHotkeysEnabled` on the parent
 * webview because it scaled every Wraith surface — sidebar, tabs, chrome —
 * which broke the layout for users that just wanted a bigger editor.
 *
 * Routing decision:
 *   - Browser child webview owns its own zoom hotkeys (set via
 *     `zoom_hotkeys_enabled(true)` when the child is constructed in Rust), so
 *     Cmd+/- pressed while focus is in the embedded site never reaches this
 *     listener and zooms only the browser content.
 *   - In the parent webview we detect xterm focus and route to the terminal,
 *     detect browser-panel focus and route to the browser, and fall through to
 *     the editor for everything else (editor is the primary surface, so plain
 *     Cmd+/- on Wraith chrome should still adjust the writing area).
 */

// Aligned with theme.{mode}.editor-font-size schema range so values written by
// Cmd+/- persist as-is rather than being silently clamped on the next theme
// re-application.
const EDITOR_FONT_MIN = 13;
const EDITOR_FONT_MAX = 24;
const EDITOR_FONT_STEP = 1;
const EDITOR_FONT_DEFAULT = 16;

type ZoomDirection = "in" | "out" | "reset";

export const TERMINAL_ZOOM_EVENT = "wraith:terminal-zoom";
export const BROWSER_ZOOM_EVENT = "wraith:browser-zoom";

export interface ZoomEventDetail {
  direction: ZoomDirection;
}

function clamp(value: number, min: number, max: number) {
  return Math.max(min, Math.min(max, value));
}

function isZoomKey(event: KeyboardEvent): ZoomDirection | null {
  const mod = event.metaKey || event.ctrlKey;
  if (!mod) return null;
  // macOS reports the unshifted key on event.key for Cmd+= (= / +) and Cmd+-
  // (-). On some layouts Cmd+Shift+= is the only way to type "+" — accept
  // both. event.code is "Equal" / "Minus" / "Digit0" regardless of shift.
  if (event.key === "+" || event.key === "=" || event.code === "Equal") return "in";
  if (event.key === "-" || event.key === "_" || event.code === "Minus") return "out";
  if (event.key === "0" || event.code === "Digit0") return "reset";
  return null;
}

function focusContext(): "terminal" | "browser" | "editor" {
  const active = document.activeElement;
  if (active instanceof HTMLElement) {
    if (active.closest(".xterm")) return "terminal";
    // The browser child webview has its own focus tree; when focus is in
    // parent chrome adjacent to it (the address bar, panel buttons), we still
    // want Cmd+/- to zoom the browser. data-wraith-panel="browser" tags the
    // panel container.
    if (active.closest("[data-wraith-panel='browser']")) return "browser";
  }
  // No specific focus → fall back to editor since it is the primary surface.
  return "editor";
}

function adjustEditorFontSize(direction: ZoomDirection) {
  const store = useSettingsStore.getState();
  const mode = activeMode(store.settings["appearance.theme"]);
  const key = `theme.${mode}.editor-font-size`;
  const current = (() => {
    const raw = store.settings[key];
    if (typeof raw === "number" && Number.isFinite(raw)) return raw;
    const legacy = store.settings["editor.font-size"];
    if (typeof legacy === "number" && Number.isFinite(legacy)) return legacy;
    return EDITOR_FONT_DEFAULT;
  })();
  let next: number;
  if (direction === "reset") {
    next = EDITOR_FONT_DEFAULT;
  } else if (direction === "in") {
    next = current + EDITOR_FONT_STEP;
  } else {
    next = current - EDITOR_FONT_STEP;
  }
  next = clamp(Math.round(next), EDITOR_FONT_MIN, EDITOR_FONT_MAX);
  if (next === current) return;
  void store.setSetting(key, next);
}

function dispatchPanelZoom(eventName: string, direction: ZoomDirection) {
  const event = new CustomEvent<ZoomEventDetail>(eventName, { detail: { direction } });
  window.dispatchEvent(event);
}

export function useZoomHotkeys() {
  useEffect(() => {
    function handleKeyDown(event: KeyboardEvent) {
      const direction = isZoomKey(event);
      if (!direction) return;
      event.preventDefault();
      event.stopPropagation();

      const context = focusContext();
      if (context === "terminal") {
        dispatchPanelZoom(TERMINAL_ZOOM_EVENT, direction);
        return;
      }
      const ui = useUIStore.getState();
      if (context === "browser" && ui.isRightSidebarOpen && ui.rightSidebarView === "browser") {
        dispatchPanelZoom(BROWSER_ZOOM_EVENT, direction);
        return;
      }
      adjustEditorFontSize(direction);
    }
    window.addEventListener("keydown", handleKeyDown, true);
    return () => window.removeEventListener("keydown", handleKeyDown, true);
  }, []);
}
