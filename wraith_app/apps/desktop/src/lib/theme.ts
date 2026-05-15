import {
  getPrimaryDefs,
  SETTINGS_SCHEMA,
  suffixOf,
  type PrimarySuffix,
  type SettingDef,
  type ThemeMode,
} from "./settings-schema";

export type ThemePreference = "system" | "light" | "dark";

let systemThemeCleanup: (() => void) | null = null;
// Cached so the OS dark/light listener can re-derive when system flips.
// The settings-store is the only caller of `applyTheme` and always passes the
// latest settings, so we just stash them here for the listener's use.
let lastSettings: Record<string, unknown> = {};

function setThemeAttribute(isDark: boolean) {
  document.documentElement.setAttribute("data-theme", isDark ? "dark" : "light");
}

function resolveMode(preference: ThemePreference): ThemeMode {
  if (preference === "dark" || preference === "light") return preference;
  if (typeof window === "undefined") return "dark";
  return window.matchMedia("(prefers-color-scheme: dark)").matches ? "dark" : "light";
}

/** Theme controls that do not map 1:1 to their stored values. UI scale is
 *  stored as a percent but CSS wants a multiplier; heading accent is a boolean
 *  but CSS wants the active heading color. The translucent/contrast sliders also
 *  normalize from human-friendly 0–100 ranges into CSS inputs. */
const DERIVED_PRIMARIES: Partial<Record<PrimarySuffix, (v: unknown) => [string, string]>> = {
  "ui-scale": (v) => {
    const percent = clamp(Number(v) || 100, 85, 115);
    return ["--wraith-ui-scale", String(percent / 100)];
  },
  "heading-accent": (v) => [
    "--writer-heading-color",
    v === true ? "var(--accent)" : "var(--text-primary)",
  ],
  translucent: (v) => {
    const t = clamp(Number(v) || 0, 0, 100);
    return ["--bg-opacity", String(1 - (t / 100) * 0.95)];
  },
  contrast: (v) => {
    // Slider 0-100 maps to effective 0.2-1.0
    const c = clamp(Number(v) || 0, 0, 100);
    return ["--contrast", String(0.2 + (c / 100) * 0.8)];
  },
};

function clamp(n: number, min: number, max: number) {
  return Math.max(min, Math.min(max, n));
}

/** Coerce an unknown setting value into a CSS string. Returns null for
 *  values we can't sensibly stringify (objects, arrays) so the caller can
 *  skip them rather than write `[object Object]` into a CSS variable. */
function formatCssValue(value: unknown, format: SettingDef["cssFormat"]): string | null {
  let str: string;
  if (typeof value === "string") str = value;
  else if (typeof value === "number") str = value.toString();
  else return null;
  return format === "px" ? `${str}px` : str;
}

function valueForPrimary(mode: ThemeMode, def: SettingDef, settings: Record<string, unknown>): unknown {
  const value = settings[def.key];
  if (value !== undefined && value !== null) return value;

  // Existing configs may only have the historical global editor font-size. Use
  // it as the first-run fallback for the new per-mode theme token so upgrades
  // do not visually reset the editor before the user saves a theme preset.
  if (suffixOf(mode, def.key) === "editor-font-size") {
    const legacyEditorSize = settings["editor.font-size"];
    if (typeof legacyEditorSize === "number") return legacyEditorSize;
  }

  return def.default;
}

/** Push the active mode's primaries onto :root. Direct 1:1 bindings come
 *  from each schema entry's `cssVar`; derived tokens (translucent → bg-opacity,
 *  contrast → /100) are mapped explicitly via `DERIVED_PRIMARIES`. */
function applyPrimaries(mode: ThemeMode, settings: Record<string, unknown>) {
  if (typeof document === "undefined") return;
  const root = document.documentElement;
  for (const def of getPrimaryDefs(mode)) {
    const suffix = suffixOf(mode, def.key);
    const value = valueForPrimary(mode, def, settings);
    if (value === undefined || value === null) continue;
    const derive = DERIVED_PRIMARIES[suffix];
    if (derive) {
      const [varName, formatted] = derive(value);
      root.style.setProperty(varName, formatted);
    } else if (def.cssVar) {
      const formatted = formatCssValue(value, def.cssFormat);
      if (formatted !== null) root.style.setProperty(def.cssVar, formatted);
    }
  }
}

/** Generic side effect: any non-theme schema entry with a `cssVar` binding gets
 *  pushed to :root automatically. New CSS-var-driven settings declare the
 *  binding in JSON; no view code needs to change. Mode-aware tokens
 *  (`theme.{mode}.*`) are handled by `applyPrimaries` instead — only the
 *  active mode's values flow through. */
export function applyCssVarBindings(settings: Record<string, unknown>) {
  if (typeof document === "undefined") return;
  const root = document.documentElement;
  for (const def of SETTINGS_SCHEMA) {
    if (!def.cssVar) continue;
    if (def.key.startsWith("theme.")) continue;
    // The V3 polished theme builder owns editor font size per light/dark mode.
    // Keep the historical `editor.font-size` setting in the schema for config
    // compatibility, but do not let it overwrite the active theme token.
    if (def.key === "editor.font-size") continue;
    const value = settings[def.key];
    if (value === undefined || value === null) continue;
    const formatted = formatCssValue(value, def.cssFormat);
    if (formatted !== null) root.style.setProperty(def.cssVar, formatted);
  }
}

function pushForMode(mode: ThemeMode, settings: Record<string, unknown>) {
  setThemeAttribute(mode === "dark");
  applyPrimaries(mode, settings);
}

/**
 * Apply the active theme: sets data-theme attribute, pushes primaries.
 * Re-listens for system changes when preference is "system". Called only
 * by the settings store as a side effect of every settings change.
 */
export function applyTheme(preference: unknown, settings: Record<string, unknown>) {
  if (typeof document === "undefined") return;

  lastSettings = settings;

  if (systemThemeCleanup) {
    systemThemeCleanup();
    systemThemeCleanup = null;
  }

  const pref: ThemePreference =
    preference === "dark" || preference === "light" || preference === "system"
      ? preference
      : "system";

  if (pref !== "system") {
    pushForMode(pref, settings);
    return;
  }

  const mq = window.matchMedia("(prefers-color-scheme: dark)");
  pushForMode(mq.matches ? "dark" : "light", settings);

  const handler = (e: MediaQueryListEvent) => {
    pushForMode(e.matches ? "dark" : "light", lastSettings);
  };
  mq.addEventListener("change", handler);
  systemThemeCleanup = () => mq.removeEventListener("change", handler);
}

/** Resolve the active mode given a preference and current system state. */
export function activeMode(preference: unknown): ThemeMode {
  const pref: ThemePreference =
    preference === "dark" || preference === "light" || preference === "system"
      ? preference
      : "system";
  return resolveMode(pref);
}
