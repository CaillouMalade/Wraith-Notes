import { SETTINGS_SCHEMA } from "@/lib/settings-schema";

export type ShortcutSettingKey =
  | "shortcuts.search"
  | "shortcuts.command-palette"
  | "shortcuts.new-note"
  | "shortcuts.go-to-file"
  | "shortcuts.new-tab"
  | "shortcuts.close-tab"
  | "shortcuts.toggle-sidebar"
  | "shortcuts.toggle-right-sidebar"
  | "shortcuts.toggle-split-view"
  | "shortcuts.navigate-back"
  | "shortcuts.navigate-forward"
  | "shortcuts.next-tab"
  | "shortcuts.previous-tab";

export interface ShortcutAction {
  key: ShortcutSettingKey;
  label: string;
  description: string;
}

export const SHORTCUT_ACTIONS: ShortcutAction[] = [
  {
    key: "shortcuts.search",
    label: "Search",
    description: "Open the search palette.",
  },
  {
    key: "shortcuts.command-palette",
    label: "Command Palette",
    description: "Open commands and search.",
  },
  {
    key: "shortcuts.new-note",
    label: "New Note",
    description: "Create a new Markdown note.",
  },
  {
    key: "shortcuts.go-to-file",
    label: "Go to File",
    description: "Search for a file in the current workspace.",
  },
  {
    key: "shortcuts.new-tab",
    label: "New Tab",
    description: "Open a blank tab.",
  },
  {
    key: "shortcuts.close-tab",
    label: "Close Tab",
    description: "Close the active tab.",
  },
  {
    key: "shortcuts.toggle-sidebar",
    label: "Toggle Left Sidebar",
    description: "Show or hide the file tree.",
  },
  {
    key: "shortcuts.toggle-right-sidebar",
    label: "Toggle Right Sidebar",
    description: "Show or hide the agent, terminal, Git, properties, and outline panel.",
  },
  {
    key: "shortcuts.toggle-split-view",
    label: "Toggle Split View",
    description: "Show or hide the second center pane.",
  },
  {
    key: "shortcuts.navigate-back",
    label: "Back",
    description: "Move back in the active tab history.",
  },
  {
    key: "shortcuts.navigate-forward",
    label: "Forward",
    description: "Move forward in the active tab history.",
  },
  {
    key: "shortcuts.next-tab",
    label: "Next Tab",
    description: "Activate the next tab.",
  },
  {
    key: "shortcuts.previous-tab",
    label: "Previous Tab",
    description: "Activate the previous tab.",
  },
];

export type ShortcutEvent = Pick<
  KeyboardEvent,
  "key" | "metaKey" | "ctrlKey" | "altKey" | "shiftKey"
>;

interface ParsedShortcut {
  key: string;
  mod: boolean;
  ctrl: boolean;
  alt: boolean;
  shift: boolean;
}

const SHORTCUT_DEFAULTS = new Map(
  SETTINGS_SCHEMA.filter((def) => def.category === "Shortcuts").map((def) => [
    def.key,
    typeof def.default === "string" ? def.default : "",
  ]),
);

const MODIFIER_KEYS = new Set(["Meta", "Control", "Alt", "Shift"]);

function isMacLike() {
  if (typeof navigator === "undefined") return true;
  return typeof navigator !== "undefined" && /Mac|iPhone|iPad|iPod/.test(navigator.platform);
}

function normalizeKeyName(key: string): string {
  const trimmed = key.trim();
  if (trimmed.length === 0) return "";

  const lower = trimmed.toLowerCase();
  if (lower === " " || lower === "spacebar") return "Space";
  if (lower === "esc") return "Escape";
  if (lower === "return") return "Enter";
  if (lower === "left") return "ArrowLeft";
  if (lower === "right") return "ArrowRight";
  if (lower === "up") return "ArrowUp";
  if (lower === "down") return "ArrowDown";
  if (lower === "arrowleft") return "ArrowLeft";
  if (lower === "arrowright") return "ArrowRight";
  if (lower === "arrowup") return "ArrowUp";
  if (lower === "arrowdown") return "ArrowDown";
  if (lower === "tab") return "Tab";
  if (lower === "enter") return "Enter";
  if (lower === "escape") return "Escape";
  if (lower === "backspace") return "Backspace";
  if (lower === "delete" || lower === "del") return "Delete";
  if (trimmed.length === 1) return trimmed.toUpperCase();
  return trimmed[0].toUpperCase() + trimmed.slice(1);
}

function parseShortcut(shortcut: string): ParsedShortcut | null {
  const rawParts = shortcut
    .split("+")
    .map((part) => part.trim())
    .filter(Boolean);
  if (rawParts.length === 0) return null;

  const parsed: ParsedShortcut = { key: "", mod: false, ctrl: false, alt: false, shift: false };

  for (const part of rawParts) {
    const lower = part.toLowerCase();
    if (lower === "mod" || lower === "cmd" || lower === "command" || lower === "meta") {
      parsed.mod = true;
    } else if (lower === "ctrl" || lower === "control") {
      parsed.ctrl = true;
    } else if (lower === "alt" || lower === "option" || lower === "opt") {
      parsed.alt = true;
    } else if (lower === "shift") {
      parsed.shift = true;
    } else {
      parsed.key = normalizeKeyName(part);
    }
  }

  return parsed.key ? parsed : null;
}

export function canonicalShortcut(shortcut: string): string {
  const parsed = parseShortcut(shortcut);
  if (!parsed) return "";
  const parts: string[] = [];
  if (parsed.mod) parts.push("Mod");
  if (parsed.ctrl) parts.push("Ctrl");
  if (parsed.alt) parts.push("Alt");
  if (parsed.shift) parts.push("Shift");
  parts.push(parsed.key);
  return parts.join("+");
}

export function displayShortcut(shortcut: string): string {
  const parsed = parseShortcut(shortcut);
  if (!parsed) return "";
  const mac = isMacLike();
  const parts: string[] = [];
  if (parsed.mod) parts.push(mac ? "Cmd" : "Ctrl");
  if (parsed.ctrl) parts.push(mac ? "Control" : "Ctrl");
  if (parsed.alt) parts.push(mac ? "Option" : "Alt");
  if (parsed.shift) parts.push("Shift");
  parts.push(parsed.key);
  return parts.join("+");
}

export function getShortcutValue(
  settings: Record<string, unknown>,
  key: ShortcutSettingKey,
): string {
  const value = settings[key];
  if (typeof value === "string") return canonicalShortcut(value);
  return canonicalShortcut(SHORTCUT_DEFAULTS.get(key) ?? "");
}

export function shortcutFromEvent(event: ShortcutEvent): string | null {
  if (MODIFIER_KEYS.has(event.key)) return null;

  const key = normalizeKeyName(event.key);
  if (!key) return null;

  const mac = isMacLike();
  const parts: string[] = [];
  if (mac ? event.metaKey : event.ctrlKey) parts.push("Mod");
  if (event.ctrlKey && mac) parts.push("Ctrl");
  if (event.altKey) parts.push("Alt");
  if (event.shiftKey) parts.push("Shift");
  parts.push(key);
  return canonicalShortcut(parts.join("+"));
}

export function eventMatchesShortcut(event: ShortcutEvent, shortcut: string): boolean {
  const parsed = parseShortcut(shortcut);
  if (!parsed) return false;

  const mac = isMacLike();
  const expectedMeta = parsed.mod && mac;
  const expectedCtrl = parsed.ctrl || (parsed.mod && !mac);

  return (
    normalizeKeyName(event.key) === parsed.key &&
    event.metaKey === expectedMeta &&
    event.ctrlKey === expectedCtrl &&
    event.altKey === parsed.alt &&
    event.shiftKey === parsed.shift
  );
}

export function shortcutConflictMap(settings: Record<string, unknown>) {
  const seen = new Map<string, ShortcutSettingKey[]>();
  for (const action of SHORTCUT_ACTIONS) {
    const shortcut = getShortcutValue(settings, action.key);
    if (!shortcut) continue;
    const existing = seen.get(shortcut) ?? [];
    existing.push(action.key);
    seen.set(shortcut, existing);
  }
  return seen;
}
