import { describe, expect, test } from "vite-plus/test";
import {
  canonicalShortcut,
  displayShortcut,
  eventMatchesShortcut,
  shortcutConflictMap,
  shortcutFromEvent,
} from "../src/lib/keyboard-shortcuts";

function event(overrides: Partial<KeyboardEvent> & { key: string }) {
  return {
    key: overrides.key,
    metaKey: overrides.metaKey ?? false,
    ctrlKey: overrides.ctrlKey ?? false,
    altKey: overrides.altKey ?? false,
    shiftKey: overrides.shiftKey ?? false,
  } as KeyboardEvent;
}

describe("keyboard shortcuts", () => {
  test("canonicalizes modifier order and key names", () => {
    expect(canonicalShortcut("shift+cmd+p")).toBe("Mod+Shift+P");
    expect(canonicalShortcut("option+left")).toBe("Alt+ArrowLeft");
    expect(canonicalShortcut("ctrl+shift+tab")).toBe("Ctrl+Shift+Tab");
  });

  test("displays macOS shortcuts without leaking the internal Mod token", () => {
    expect(displayShortcut("Mod+Shift+P")).toBe("Cmd+Shift+P");
    expect(displayShortcut("Alt+ArrowLeft")).toBe("Option+ArrowLeft");
    expect(displayShortcut("Ctrl+Shift+Tab")).toBe("Control+Shift+Tab");
  });

  test("turns key events into persisted shortcut strings", () => {
    expect(shortcutFromEvent(event({ key: "p", metaKey: true }))).toBe("Mod+P");
    expect(shortcutFromEvent(event({ key: "Tab", ctrlKey: true, shiftKey: true }))).toBe(
      "Ctrl+Shift+Tab",
    );
    expect(shortcutFromEvent(event({ key: "Meta", metaKey: true }))).toBeNull();
  });

  test("matches configured shortcuts exactly", () => {
    expect(eventMatchesShortcut(event({ key: "w", metaKey: true }), "Mod+W")).toBe(true);
    expect(eventMatchesShortcut(event({ key: "w", metaKey: true, shiftKey: true }), "Mod+W")).toBe(
      false,
    );
    expect(eventMatchesShortcut(event({ key: "ArrowLeft", altKey: true }), "Alt+ArrowLeft")).toBe(
      true,
    );
  });

  test("detects duplicate assigned shortcuts", () => {
    const conflicts = shortcutConflictMap({
      "shortcuts.search": "Mod+P",
      "shortcuts.command-palette": "Mod+P",
      "shortcuts.new-note": "Mod+N",
    });
    expect(conflicts.get("Mod+P")).toEqual(["shortcuts.search", "shortcuts.command-palette"]);
  });
});
