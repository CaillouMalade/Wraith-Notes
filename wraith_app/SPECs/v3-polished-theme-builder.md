# V3 Polished Theme Builder

Status: planned for the V3 polished package.

## Goal

Make Wraith feel tighter and more visually personal without turning the Preferences page into an overgrown theme laboratory. The appeal is the look: colors/transparency are already strong, so this pass focuses on typography, UI scale, heading treatment, and making saved presets capture those choices.

## Non-goals

- Do not add more color knobs beyond the existing background, foreground, accent, translucency, and contrast controls.
- Do not add AI chat work in this slice.
- Do not change Markdown/frontmatter persistence behavior.
- Do not add import/export/rename for theme presets unless it becomes clearly useful later.

## User-facing behavior

Each Light Theme and Dark Theme card should expose the same concise builder:

1. Preset selector
   - Custom
   - built-in presets
   - saved presets
   - Save current
   - Delete saved
2. Existing color/material controls
   - Accent
   - Background
   - Foreground
   - Translucent
   - Contrast
3. UI tightness
   - UI Scale, stored as a percentage and adjustable one percent at a time.
   - Default is 100%.
   - First safe range is 85–115%.
   - This should tighten or loosen Wraith chrome/controls without changing editor text size.
4. Editor typography
   - Editor font family.
   - Editor font size, per light/dark mode.
5. Heading typography
   - Heading font family, per light/dark mode.
   - Toggle: headings use accent color.
   - If no heading font is chosen, headings use the editor font.

## Persistence model

- Keep separate light and dark settings.
- Keep saved presets in app settings, not vault Markdown.
- Saved presets must include the new typography and UI scale fields:
  - `ui-scale`
  - `editor-font-size`
  - `heading-font`
  - `heading-accent`
- Existing built-in theme preset JSON files should include defaults for the new fields so preset application is deterministic.
- Existing `editor.font-size` remains a compatibility setting, but the visible builder owns editor font size going forward.

## Acceptance criteria

- Light and dark builders both show UI Scale, Editor font size, Heading font, and heading accent toggle.
- UI Scale changes are applied live through CSS variables and can be dialed one percent at a time.
- Editor font size is applied per active light/dark mode.
- Heading font and accent toggle affect CodeMirror/ProseMark Markdown headings.
- Saved presets capture and restore the new fields.
- Built-in presets still apply cleanly.
- Current color/transparency controls remain, with no extra color controls added.
- TypeScript build passes for the desktop app.
