#!/usr/bin/env node
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const read = (relativePath) => fs.readFileSync(path.join(root, relativePath), "utf8");
const readJson = (relativePath) => JSON.parse(read(relativePath));

const schema = readJson("apps/desktop/shared/settings.schema.json");
const byKey = new Map(schema.settings.map((entry) => [entry.key, entry]));

const expectedThemeFields = [
  ["ui-scale", { type: "range", min: 85, max: 115, step: 1, default: 100 }],
  ["editor-font-size", { type: "range", min: 13, max: 24, step: 1, default: 16 }],
  ["heading-font", { type: "string" }],
  ["heading-accent", { type: "boolean", default: false }],
];

for (const mode of ["light", "dark"]) {
  for (const [suffix, expected] of expectedThemeFields) {
    const key = `theme.${mode}.${suffix}`;
    const entry = byKey.get(key);
    assert.ok(entry, `missing schema setting ${key}`);
    assert.equal(entry.category, "Theme", `${key} should live in Theme category`);
    for (const [prop, value] of Object.entries(expected)) {
      assert.equal(entry[prop], value, `${key}.${prop} should be ${value}`);
    }
  }
}

const presetsDir = path.join(root, "apps/desktop/shared/themes");
for (const slug of fs.readdirSync(presetsDir)) {
  const slugDir = path.join(presetsDir, slug);
  if (!fs.statSync(slugDir).isDirectory()) continue;
  for (const mode of ["light", "dark"]) {
    const preset = JSON.parse(fs.readFileSync(path.join(slugDir, `${mode}.json`), "utf8"));
    for (const [suffix] of expectedThemeFields) {
      assert.ok(Object.hasOwn(preset, suffix), `${slug}/${mode}.json missing ${suffix}`);
    }
  }
}

const settingsSchema = read("apps/desktop/src/lib/settings-schema.ts");
for (const [suffix] of expectedThemeFields) {
  assert.ok(settingsSchema.includes(`| \"${suffix}\"`), `PrimarySuffix missing ${suffix}`);
}
assert.ok(
  settingsSchema.includes("string | number | boolean"),
  "PrimarySet should support boolean theme values",
);

const themeTs = read("apps/desktop/src/lib/theme.ts");
assert.ok(themeTs.includes("--wraith-ui-scale"), "theme.ts should derive --wraith-ui-scale");
assert.ok(themeTs.includes("--writer-heading-color"), "theme.ts should derive --writer-heading-color");

const appCss = read("apps/desktop/src/App.css");
assert.ok(appCss.includes("--wraith-ui-scale"), "App.css missing UI scale CSS variable");
assert.ok(
  appCss.includes("font-size: calc(16px * var(--wraith-ui-scale))"),
  "App.css should make rem-based UI chrome scale from UI Scale",
);
assert.ok(
  appCss.includes("--writer-heading-font-family"),
  "App.css missing heading font family CSS variable",
);
assert.ok(
  appCss.includes("--writer-heading-color"),
  "App.css missing heading color CSS variable",
);

const editorSetup = read("apps/desktop/src/components/editor-area/use-prosemark-editor.ts");
assert.ok(
  editorSetup.includes("--writer-heading-font-family"),
  "editor heading highlight should use heading font CSS variable",
);
assert.ok(
  editorSetup.includes("--writer-heading-color"),
  "editor heading highlight should use heading color CSS variable",
);

console.log("theme builder validation passed");
