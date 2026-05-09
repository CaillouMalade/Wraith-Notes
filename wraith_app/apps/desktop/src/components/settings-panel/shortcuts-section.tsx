import { useEffect, useMemo, useState, type KeyboardEvent as ReactKeyboardEvent } from "react";
import {
  SHORTCUT_ACTIONS,
  canonicalShortcut,
  displayShortcut,
  getShortcutValue,
  shortcutConflictMap,
  shortcutFromEvent,
  type ShortcutSettingKey,
} from "@/lib/keyboard-shortcuts";
import { SETTINGS_SCHEMA } from "@/lib/settings-schema";
import { useAllSettings, useResetSetting, useSetSetting } from "@/hooks/use-settings";

const SHORTCUT_DEFS = new Map(
  SETTINGS_SCHEMA.filter((def) => def.category === "Shortcuts").map((def) => [def.key, def]),
);

function ShortcutButton({
  actionKey,
  value,
  isCapturing,
  isConflict,
  onStartCapture,
  onCommit,
  onCancel,
}: {
  actionKey: ShortcutSettingKey;
  value: string;
  isCapturing: boolean;
  isConflict: boolean;
  onStartCapture: (key: ShortcutSettingKey) => void;
  onCommit: (value: string) => void;
  onCancel: () => void;
}) {
  function handleKeyDown(event: ReactKeyboardEvent<HTMLButtonElement>) {
    if (!isCapturing) return;
    event.preventDefault();
    event.stopPropagation();

    if (event.key === "Escape") {
      onCancel();
      return;
    }
    if (event.key === "Backspace" || event.key === "Delete") {
      onCommit("");
      return;
    }

    const shortcut = shortcutFromEvent(event.nativeEvent);
    if (!shortcut) return;
    onCommit(shortcut);
  }

  return (
    <button
      type="button"
      onClick={() => onStartCapture(actionKey)}
      onKeyDown={handleKeyDown}
      onBlur={() => {
        if (isCapturing) onCancel();
      }}
      className={`h-9 min-w-36 rounded-lg border px-3 text-center font-mono text-[13px] outline-none focus-visible:outline-none ${
        isCapturing
          ? "border-[var(--focus-border)] bg-[var(--surface-subtle-strong)] text-[var(--text-primary)]"
          : isConflict
            ? "border-[#ff5f57] bg-[var(--surface-input)] text-[var(--text-secondary)]"
            : "border-transparent bg-[var(--surface-input)] text-[var(--text-secondary)] hover:bg-[var(--surface-subtle)]"
      }`}
      aria-label={`Set ${actionKey} shortcut`}
    >
      {isCapturing ? "Press keys" : displayShortcut(value) || "Unassigned"}
    </button>
  );
}

export function ShortcutsSection() {
  const settings = useAllSettings();
  const setSetting = useSetSetting();
  const resetSetting = useResetSetting();
  const [capturing, setCapturing] = useState<ShortcutSettingKey | null>(null);

  const conflicts = useMemo(() => shortcutConflictMap(settings), [settings]);

  useEffect(() => {
    if (!capturing) return;

    const handleKeyDown = (event: KeyboardEvent) => {
      event.preventDefault();
      event.stopPropagation();
      event.stopImmediatePropagation();

      if (event.key === "Escape") {
        setCapturing(null);
        return;
      }

      if (event.key === "Backspace" || event.key === "Delete") {
        setCapturing(null);
        void setSetting(capturing, "");
        return;
      }

      const shortcut = shortcutFromEvent(event);
      if (!shortcut) return;

      setCapturing(null);
      void setSetting(capturing, canonicalShortcut(shortcut));
    };

    window.addEventListener("keydown", handleKeyDown, true);
    return () => window.removeEventListener("keydown", handleKeyDown, true);
  }, [capturing, setSetting]);

  function isModified(key: ShortcutSettingKey) {
    const def = SHORTCUT_DEFS.get(key);
    return JSON.stringify(settings[key]) !== JSON.stringify(def?.default ?? "");
  }

  return (
    <section className="mb-10">
      <h2 className="mb-3 text-[13px] font-medium text-[var(--text-muted)]">
        Keyboard Shortcuts
      </h2>
      <div className="-mx-4 overflow-hidden rounded-2xl border border-[var(--line-subtler)] bg-[var(--surface-card)]">
        {SHORTCUT_ACTIONS.map((action, index) => {
          const value = getShortcutValue(settings, action.key);
          const conflictKeys = value ? (conflicts.get(value) ?? []) : [];
          const isConflict = conflictKeys.length > 1;

          return (
            <div
              key={action.key}
              className={index === 0 ? undefined : "border-t border-[var(--line-subtler)]"}
            >
              <div className="flex items-start justify-between gap-4 px-4 py-3.5">
                <div className="min-w-0 flex-1">
                  <div className="text-[13px] font-medium text-[var(--text-primary)]">
                    {action.label}
                  </div>
                  <div className="mt-0.5 text-[13px] text-[var(--text-muted)]">
                    {action.description}
                  </div>
                  {isConflict ? (
                    <div className="mt-1 text-[12px] text-[#ff5f57]">
                      This shortcut is assigned more than once.
                    </div>
                  ) : null}
                </div>
                <div className="flex shrink-0 items-center gap-2">
                  <button
                    type="button"
                    onClick={() => {
                      setCapturing(null);
                      void resetSetting(action.key);
                    }}
                    aria-hidden={!isModified(action.key)}
                    tabIndex={isModified(action.key) ? 0 : -1}
                    className={`shrink-0 rounded-full px-2 py-0.5 text-[11px] text-[var(--text-muted)] transition-colors hover:bg-[var(--surface-subtle-strong)] hover:text-[var(--text-primary)] ${
                      isModified(action.key) ? "" : "invisible pointer-events-none"
                    }`}
                    title="Reset to default"
                  >
                    Reset
                  </button>
                  <ShortcutButton
                    actionKey={action.key}
                    value={value}
                    isCapturing={capturing === action.key}
                    isConflict={isConflict}
                    onStartCapture={setCapturing}
                    onCancel={() => setCapturing(null)}
                    onCommit={(nextValue) => {
                      setCapturing(null);
                      void setSetting(action.key, canonicalShortcut(nextValue));
                    }}
                  />
                </div>
              </div>
            </div>
          );
        })}
      </div>
    </section>
  );
}
