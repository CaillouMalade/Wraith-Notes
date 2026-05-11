# V4 Sidebar Organization

## Status

Active V4 implementation spec.

## Goal

Make the left sidebar easier to scan without making the vault less
filesystem-native.

The hierarchy remains the default and the safest mental model. Additional
sections should be opt-in views layered over the same files, not a second
database.

## First Pass: Conservative Type Colors

Arthur asked for file/folder type colors if they are not too hard. V4 should
start with a quiet setting rather than arbitrary color pickers.

Desired behavior:

- Add separate settings for folder, Markdown, image, PDF, and other supported
  file icons.
- Each setting can be `default` or `accent`.
- Default preserves the current sidebar look.
- `accent` only changes the icon tone, not row text, indentation, or selection
  styling.

## Property Sections

Property-based grouping is useful but broader than icon color. The first
implementation should avoid inventing a second source of truth.

Desired behavior:

- Keep Hierarchical as the default mode.
- Let Arthur define an ordered list of frontmatter properties to use as
  alternate sidebar sections.
- Render property sections as derived views over Markdown files, grouped by
  value, with an explicit "No value" group.
- Keep group open/closed state as app/session state.
- Keep non-Markdown assets in the normal hierarchy unless a later spec gives
  them property metadata.

Open questions:

- Whether property sections should be a mode switch or live below the
  hierarchical tree.
- Whether multi-value frontmatter should duplicate a note into several groups
  or render a joined value.
- How much of the existing workspace search index should be reused for the
  property scan.
- Whether to parse frontmatter in Rust with a YAML dependency or in the
  frontend using the existing `yaml` package.

