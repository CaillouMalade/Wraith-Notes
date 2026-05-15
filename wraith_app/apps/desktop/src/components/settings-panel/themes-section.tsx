import { useMemo } from "react";
import { useAllSettings, useSetSetting } from "@/hooks/use-settings";
import {
  getPrimaryDefs,
  PRESET_NAMES,
  presetKey,
  readPrimaries,
  savedPresetsKey,
  suffixOf,
  THEME_PRESETS,
  type PrimarySet,
  type PrimarySuffix,
  type ThemeMode,
} from "@/lib/settings-schema";
import { SettingControl } from "./setting-control";

type SavedThemePreset = {
  name: string;
  values: PrimarySet;
};

type ThemeGroup = {
  title: string;
  suffixes: PrimarySuffix[];
};

const THEME_GROUPS: ThemeGroup[] = [
  { title: "Colors", suffixes: ["accent", "background", "foreground"] },
  { title: "UI", suffixes: ["ui-font", "ui-scale"] },
  { title: "Editor", suffixes: ["editor-font", "editor-font-size", "heading-font", "heading-accent"] },
  { title: "Material", suffixes: ["translucent", "contrast"] },
];

function parseSavedPresets(value: unknown): SavedThemePreset[] {
  if (!Array.isArray(value)) return [];
  const presets: SavedThemePreset[] = [];
  for (const item of value) {
    if (typeof item !== "string") continue;
    try {
      const parsed = JSON.parse(item) as Partial<SavedThemePreset>;
      if (typeof parsed.name !== "string" || !parsed.name.trim()) continue;
      if (!parsed.values || typeof parsed.values !== "object") continue;
      presets.push({ name: parsed.name.trim(), values: parsed.values as PrimarySet });
    } catch {
      // Ignore malformed saved presets rather than breaking Preferences.
    }
  }
  return presets.sort((a, b) => a.name.localeCompare(b.name));
}

function serializeSavedPresets(presets: SavedThemePreset[]) {
  return presets.map((preset) => JSON.stringify(preset));
}

export function ThemesSection() {
  return (
    <>
      <ThemeCard mode="light" />
      <ThemeCard mode="dark" />
    </>
  );
}

function ThemeCard({ mode }: { mode: ThemeMode }) {
  const settings = useAllSettings();
  const setSetting = useSetSetting();

  const primaryDefs = useMemo(() => getPrimaryDefs(mode), [mode]);
  const groupedPrimaryDefs = useMemo(
    () =>
      THEME_GROUPS.map((group) => ({
        ...group,
        defs: primaryDefs.filter((def) => group.suffixes.includes(suffixOf(mode, def.key) as PrimarySuffix)),
      })).filter((group) => group.defs.length > 0),
    [mode, primaryDefs],
  );
  const savedPresets = useMemo(
    () => parseSavedPresets(settings[savedPresetsKey(mode)]),
    [mode, settings],
  );
  const currentPreset =
    typeof settings[presetKey(mode)] === "string" ? (settings[presetKey(mode)] as string) : "Custom";
  const selectedPresetValue = savedPresets.some((preset) => preset.name === currentPreset)
    ? `saved:${currentPreset}`
    : PRESET_NAMES.includes(currentPreset)
      ? `builtin:${currentPreset}`
      : "custom";

  async function applyPrimarySet(name: string, values: PrimarySet) {
    await Promise.all([
      ...primaryDefs.map((def) => {
        const suffix = suffixOf(mode, def.key);
        return setSetting(def.key, values[suffix] ?? def.default);
      }),
      setSetting(presetKey(mode), name),
    ]);
  }

  async function handlePresetChange(value: string) {
    if (value === "custom") {
      await setSetting(presetKey(mode), "Custom");
      return;
    }

    const [kind, name] = value.split(/:(.*)/s);
    if (!name) return;
    if (kind === "builtin") {
      await applyPrimarySet(name, THEME_PRESETS[name][mode]);
      return;
    }

    const saved = savedPresets.find((preset) => preset.name === name);
    if (saved) await applyPrimarySet(saved.name, saved.values);
  }

  async function saveCurrentPreset() {
    const rawName = window.prompt(
      `Save ${mode === "light" ? "light" : "dark"} theme as:`,
      currentPreset && currentPreset !== "Custom" ? currentPreset : "",
    );
    const name = rawName?.trim();
    if (!name) return;
    if (PRESET_NAMES.includes(name)) {
      window.alert(`"${name}" is a built-in preset name. Choose a different name.`);
      return;
    }

    const existing = savedPresets.filter((preset) => preset.name !== name);
    if (existing.length !== savedPresets.length && !window.confirm(`Replace "${name}"?`)) {
      return;
    }

    const next = [...existing, { name, values: readPrimaries(mode, settings) }];
    await setSetting(savedPresetsKey(mode), serializeSavedPresets(next));
    await setSetting(presetKey(mode), name);
  }

  async function deleteCurrentPreset() {
    const savedName = selectedPresetValue.startsWith("saved:")
      ? selectedPresetValue.slice("saved:".length)
      : null;
    if (!savedName) return;
    if (!window.confirm(`Delete saved theme "${savedName}"?`)) return;
    const next = savedPresets.filter((preset) => preset.name !== savedName);
    await setSetting(savedPresetsKey(mode), serializeSavedPresets(next));
    await setSetting(presetKey(mode), "Custom");
  }

  return (
    <section className="mb-10">
      <h2 className="mb-3 text-[0.8125rem] font-medium text-[var(--text-muted)]">
        {mode === "light" ? "Light Theme" : "Dark Theme"}
      </h2>
      <div className="-mx-4 overflow-hidden rounded-2xl border border-[var(--line-subtler)] bg-[var(--surface-card)]">
        <div className="flex items-start justify-between gap-4 px-4 py-3.5">
          <div className="min-w-0 flex-1">
            <div className="text-[0.8125rem] font-medium text-[var(--text-primary)]">Preset</div>
            <div className="mt-0.5 text-[0.8125rem] text-[var(--text-muted)]">
              Save and recall this mode's current theme settings.
            </div>
          </div>
          <div className="flex shrink-0 items-center gap-2">
            <select
              value={selectedPresetValue}
              onChange={(event) => void handlePresetChange(event.target.value)}
              className="h-9 min-w-[160px] appearance-none rounded-lg border border-transparent bg-[var(--surface-input)] bg-[length:12px_12px] bg-[position:right_10px_center] bg-no-repeat pl-3 pr-8 text-[0.8125rem] text-[var(--text-secondary)] font-[inherit] outline-none focus:border-[var(--focus-border)] focus-visible:outline-none bg-[image:var(--select-chevron)]"
            >
              <option value="custom">Custom</option>
              {PRESET_NAMES.map((name) => (
                <option key={`builtin:${name}`} value={`builtin:${name}`}>
                  {name}
                </option>
              ))}
              {savedPresets.map((preset) => (
                <option key={`saved:${preset.name}`} value={`saved:${preset.name}`}>
                  {preset.name}
                </option>
              ))}
            </select>
            <button
              type="button"
              onClick={() => void saveCurrentPreset()}
              className="h-9 rounded-lg border border-transparent bg-[var(--surface-input)] px-3 text-[0.8125rem] text-[var(--text-secondary)] transition-colors hover:bg-[var(--surface-selected)]"
            >
              Save
            </button>
            <button
              type="button"
              onClick={() => void deleteCurrentPreset()}
              disabled={!selectedPresetValue.startsWith("saved:")}
              className="h-9 rounded-lg border border-transparent bg-[var(--surface-input)] px-3 text-[0.8125rem] text-[var(--text-secondary)] transition-colors hover:bg-[var(--surface-selected)] disabled:opacity-40"
            >
              Delete
            </button>
          </div>
        </div>
        {groupedPrimaryDefs.map((group) => (
          <div key={group.title}>
            <div className="border-t border-[var(--line-subtler)] px-4 pt-3 pb-1 text-[0.6875rem] font-semibold uppercase tracking-[0.12em] text-[var(--text-muted)]">
              {group.title}
            </div>
            {group.defs.map((def) => {
              const suffix = suffixOf(mode, def.key) as PrimarySuffix;
              const value = settings[def.key] ?? def.default;
              const isModified = JSON.stringify(value) !== JSON.stringify(def.default);
              return (
                <div key={def.key} className="border-t border-[var(--line-subtler)]">
                  <SettingControl
                    def={def}
                    value={value}
                    onChange={(v) => {
                      void setSetting(`theme.${mode}.${suffix}`, v);
                      void setSetting(presetKey(mode), "Custom");
                    }}
                    onReset={() => void setSetting(def.key, def.default)}
                    isModified={isModified}
                  />
                </div>
              );
            })}
          </div>
        ))}
      </div>
    </section>
  );
}
