# Wraith V4 Polished Wraith Roadmap

## Status

Active roadmap for the post-`v3.0.1` V4 development cycle.

This document turns Arthur's `New features ideas.md` note into a Wraith-owned
roadmap without editing the source idea note. The idea note stays a scratchpad;
this spec is the implementation reference once V4 work starts.

## Product Goal

Make V4 the polished daily Wraith release: the same files-first Markdown app,
but smoother, calmer, and more coherent in the surfaces Arthur touches every
day.

V4 should not reopen the app's product model. Markdown files remain the source
of truth, the editor remains one predictable surface, and the V1/V2/V3 visual
language remains the anchor.

## Design Direction

- Preserve Wraith's current radius scale. The app already sits close to compact
  native macOS controls: rows/buttons mostly at 6-8px, larger overlays higher.
- Improve the right sidebar by tuning contrast, borders, spacing, and corner
  feel before changing global radius. The issue is more "CSS circular corners
  feel abrupt" than "everything needs larger radius".
- Prefer subtle easing and continuity over decorative animation.
- Motion should make state changes legible: sidebar open/close, tab creation,
  tab deletion, split transitions, and tree drag targets.
- Avoid adding a motion dependency unless CSS transitions and browser-native
  techniques are not enough.
- Keep UI dense and useful. V4 is polish for a working local app, not a
  marketing redesign.

## Arthur Decisions For Unattended Work

These decisions were captured before starting V4 implementation so an agent can
work while Arthur is away.

- When a taste ambiguity appears, choose conservatively, log the decision in the
  relevant spec or changelog, and keep moving.
- User-visible V4 work should update the relevant spec and `CHANGELOG.md`.
- Do not edit `New features ideas.md`; it is an input scratchpad.
- Preserve the ghost icon's shape and look. The surrounding background,
  transparency, and asset treatment may change as needed to make the icon look
  good in macOS dark/tinted contexts.
- Motion should be playful for the specific surfaces Arthur named: sidebar
  opening/closing, tabs, file open/delete transitions, and split behavior. Do
  not make native menus or the command palette feel less native.
- The editor cursor should follow Wraith's configured accent color and be
  slightly thicker than today.
- Compact right-sidebar controls may move from roughly 8px to roughly 6px
  radius if visual testing confirms it looks cleaner. Do not change the global
  radius system.
- Regular Markdown images should render previews after/below the source
  Markdown, not fold/replace the source text.
- Bottom typing scroll should move roughly three lines earlier than current
  behavior.
- Expanded folder state should be restored per workspace when reopening Wraith,
  like tab session state, without writing anything into Markdown notes.
- File/folder color customization should stay clean: each file/folder kind may
  choose default color or accent color. Do not add arbitrary per-kind color
  pickers for V4.
- The terminal should blend into Wraith's native panel language instead of using
  a heavy black terminal block, while staying readable and fully usable.
- Git status should include a compact summary and a small color-coded state
  indicator: green for clean/up to date, orange for pending work/ahead/behind,
  and an error/conflict treatment when needed.
- The V4 agent direction is Tolaria-style Safe / Power User modes, not true
  interactive approve/reject prompts as the first target.
- Codex and Claude Code are the first-class V4 agent targets. Hermes and custom
  commands may remain configurable but generic.

## Workstream 1: Polish Baseline

These are the first V4 implementation candidates because they are visible,
bounded, and low risk.

Status: implemented in the first V4 polish pass on 2026-05-09, with same-day
and next-day feedback correction passes for motion visibility, terminal
blending, Git refresh, drag-to-split reliability, and scrollbar thickness.

Decision log:

- App icon: removed the old cream squircle/background by making only the
  outside-connected background pixels transparent. The dark ghost shape,
  gradient, and eyes are preserved, and Tauri-generated PNG/ICNS/ICO assets
  now come from the transparent `source.png`.
- Motion: kept the implementation dependency-free and CSS-only. The chosen
  curve is a short playful easing for sidebar widths, tab entry/hover, and
  split-pane transitions, with reduced-motion fallback.
- Right-sidebar shape: used smaller `6px`/`5px` radii on compact controls and
  icon buttons while leaving larger content cards at the existing app radius.
- Drag-to-open-split: kept the secondary behavior scoped to files already in
  the Wraith tree that can open inside Wraith (Markdown, image, PDF). External
  file drops continue to mean import into the tree/editor rather than split
  open.
- Feedback correction: Arthur accepted the icon, cursor, and bottom-scroll
  changes, but the first motion/terminal/Git/drag-to-split pass was too subtle
  or too static. The correction pass keeps the same product scope while making
  those visible behaviors easier to notice and more dynamic.
- Follow-up correction: Arthur confirmed the left/right sidebar motion and main
  editor scrollbar feel right. The next pass leaves those surfaces unchanged,
  slows only the tab hover glimmer, makes Git freshness visible with an active
  checked timestamp, replaces file-tree drag-to-split's native drag dependency
  with Wraith pointer events, and adds a Settings-backed terminal font family.

### App Icon Transparency

The macOS dark tinted app icon currently shows a square beige area around the
ghost.

Desired behavior:

- Regenerate or replace app icon assets so the ghost background is properly
  transparent where appropriate.
- Preserve the ghost shape/look; only the surrounding background/transparency
  treatment is open.
- Verify the source icon and generated PNG/ICNS assets match.
- Preserve dev/release app identity separation.

Implementation:

- `apps/desktop/src-tauri/icons/source.png` is now transparent around the
  ghost mark instead of carrying the cream squircle background.
- Tauri icon generation refreshed the generated PNG, ICNS, ICO, iOS, Android,
  and Windows assets from that source.
- `apps/desktop/public/wraith-icon.png` was synced from the generated app PNG.
- Dev/release identifiers and bundle config were not changed.

### Motion And Easing

Current sidebar and tab changes feel blunt.

Desired behavior:

- Use a more intentional easing curve for left/right sidebar open and close.
- Improve tab strip interactions when opening and closing tabs.
- Improve split-view transitions without making the editor feel unstable.
- Use a playful Arc/Dia-inspired feel for these transitions, while keeping
  native menus and the command palette native-feeling.
- Keep animation durations short enough for a writing app.
- Respect reduced-motion preferences if this becomes more than simple
  opacity/transform/width transitions.

Acceptance:

- Sidebar transitions feel smoother but do not lag resizing.
- Tab additions/removals do not shift text in a jarring way.
- Split toggling is visually legible and does not duplicate or lose tabs.

Implementation:

- Sidebar and right-sidebar width changes use the same short playful easing,
  and resizing still disables transitions during pointer drag.
- Tab buttons now get a small entry/hover motion without changing their stable
  height or max width.
- Split panes animate on entry and split ratio changes ease when not actively
  dragging.
- The feedback pass lengthened the chrome duration and added a subtle
  diagonal glimmer/arc treatment on app chrome and tab hover so the motion is
  visible without changing native menus or command palette behavior.
- The next feedback pass slowed the tab hover glimmer only, because the
  sidebar open/close timing was accepted and the tab shimmer read too much like
  a fast blink.
- Reduced-motion preferences collapse animation/transition duration.

### Editor Cursor

Arthur wants to test a slightly thicker cursor, potentially accent-colored.

Desired behavior:

- Make the caret slightly thicker.
- Use Wraith's configured accent color for the caret, preserving readability in
  all themes.
- Keep selection/drop cursor behavior readable.

Implementation:

- CodeMirror cursor and drop cursor now use a `2px` accent-colored caret while
  keeping the existing accent selection color.

### File Tree Drag Affordance

Folder-tree drag/drop works but should communicate target state better.

Desired behavior:

- Highlight valid folder/file-row drop targets while dragging external files.
- Make empty-tree and empty-folder drop affordances visible if needed.
- Keep the behavior unchanged: dropping on a folder imports into that folder;
  dropping on a file imports into the file's parent folder.

Implementation:

- External file drags now highlight the root tree and individual row targets.
- Empty trees change from the quiet "No files" state to a dashed "Drop files
  here" target while an external file drag is active.
- Import target behavior is unchanged.

### Editor Bottom Scroll Comfort

When typing near the bottom of a note, the line currently gets too low before
scrolling.

Desired behavior:

- Nudge scroll behavior earlier by roughly three lines.
- Avoid jumpy typing.
- Preserve search-result safe-zone behavior from V3.

Implementation:

- Added a bottom `EditorView.scrollMargins` margin of roughly three editor
  lines for default cursor tracking. The custom search safe-zone handler remains
  gated to search/replace navigation.

### Drag File To Open Split

As a secondary polish behavior, support the Arc/Dia-like workflow where a user
can drag a file from the folder tree into/around the center editor area to open
it in a split tab, especially when only one tab is currently open.

Desired behavior:

- Dragging a file from the folder tree over the center area should reveal a
  clear split-open target or affordance.
- Dropping should open the dragged file in the opposite/new split pane without
  disturbing the current tab.
- This is secondary to the main polish baseline and may move later if it
  conflicts with existing folder-tree drag/drop import behavior.

Implementation:

- Markdown, image, and PDF rows in the file tree can now be dragged over the
  editor area.
- The center editor shows a left/right split target while dragging; dropping
  opens the file/asset in the chosen split pane through the existing split-tab
  APIs.
- The behavior uses a Wraith-specific drag MIME type so it does not interfere
  with external Finder/browser file imports.
- The feedback pass added an in-memory Wraith drag fallback in addition to the
  custom MIME type, so Tauri/WebKit drag-data quirks are less likely to prevent
  the center split target from activating.
- The next feedback pass replaced the internal file-tree row gesture with
  pointer-driven Wraith drag events. This keeps Finder/browser imports on the
  native drop path, but makes tree-to-split independent of native HTML5 drag
  activation so the editor can show the split affordance immediately.

### Terminal Panel Visual Polish

The terminal works, but the current panel looks heavier than the rest of
Wraith and the scrollbar can obscure text.

Desired behavior:

- Theme xterm to better match Wraith surfaces and text contrast.
- Reduce visual weight of the terminal frame; it should blend into Wraith's
  native panel language rather than look like a separate black terminal block.
- Ensure the terminal scrollbar does not sit on top of readable text.
- Keep the terminal functional and native-shell-backed.

Implementation:

- Terminal panel now uses a lighter native-blending surface, subtler border,
  accent cursor, Wraith text tokens, and a right-side text gutter for the xterm
  scrollbar.
- The feedback pass enabled xterm's `allowTransparency` option and removed the
  xterm canvas/viewport black background layer, so the terminal is not a heavy
  black box when Wraith is translucent.
- The next feedback pass added a `Terminal > Font Family` setting that accepts
  any installed font name or CSS font stack and applies to the live xterm
  instance without restarting the shell.
- A later feedback pass rejected the separate Terminal color/transparency
  controls as too much. Terminal keeps the native-blending surface, keeps the
  font-family setting, and only forces readable text contrast: black text in
  light mode and warm white text in dark mode.
- PTY startup, resize, input, output, restart, and stop behavior were left
  unchanged.

### Git Panel Visual Polish

The Git panel is useful but can communicate state more clearly.

Desired behavior:

- Add a calm status summary such as "Everything up to date" or "3 changes
  pending".
- Add a compact color-coded state dot: green for clean/up to date, orange for
  pending changes/ahead/behind, and a distinct conflict/error treatment where
  needed.
- Use accent color sparingly for actionable state, conflicts, or pending work.
- Preserve current commit/pull/push/sync behavior.

Implementation:

- Git panel now derives a compact summary from porcelain status and shows a
  state dot: green for clean/up to date, orange for pending/ahead/behind, red
  for conflicts/errors.
- Existing refresh, initialize, remote, diff, open/reveal, pull, push, sync,
  and commit-all actions are unchanged.
- The feedback pass made Git status refresh event-driven: successful saves,
  file-tree create/import/rename/delete actions, Git panel operations,
  AutoGit/Auto Pull actions, file watcher changes, window focus, and a shorter
  background poll now all request a status refresh.
- The next feedback pass refreshes every 2 seconds while the Git panel is the
  active right-sidebar view and shows a last-checked timestamp. Dirty-file
  summaries now say "local change(s)" to distinguish unsaved/uncommitted local
  work from remote sync state.
- A later feedback pass split remote sync state from the dirty-file list. The
  top card now describes only upstream/ahead/behind state, while the
  Tolaria-style pending-change list carries the local change count and checked
  timestamp. Watcher-triggered refreshes no longer ignore `.git` changes, so
  external commits, pulls, and pushes prune the list without waiting on normal
  file edits.
- The Git action model was clarified after testing: Check fetches remote state
  and refreshes ahead/behind, Pull brings remote commits into the local working
  tree, Push now commits all local file changes first and then pushes, and Sync
  runs Pull followed by that commit-and-push path.

### Right Sidebar Shape Pass

The compact right-sidebar buttons can feel slightly too rounded and abrupt.

Desired behavior:

- Keep global radius scale as-is.
- Test `rounded-md`/6px on compact right-sidebar controls where current 8px
  corners feel too bubbly; use the cleaner result.
- Prefer better contrast/border tuning before broad radius changes.
- Avoid pill-like controls unless the control is genuinely a segmented/toggle
  control.

Implementation:

- Compact right-sidebar buttons, icon buttons, inputs, segmented view tabs, and
  the Agent controls now use smaller local radii and subtler borders.
- Global radius tokens and larger app/card surfaces were not changed.

## Workstream 2: Editor And Media

### Regular Markdown Image Embeds

V3 has strong HTML image rendering and Obsidian `![[...]]` embeds. V4 should
also render regular Markdown image syntax well:

```md
![Alt text](attachments/image.png)
```

Desired behavior:

- Render regular Markdown image references inline in the editor.
- Show the preview after/below the Markdown source instead of replacing it.
- Resolve vault-relative, note-relative, and remote image paths consistently
  with existing HTML and Obsidian embed paths.
- Keep Markdown source editable and preserved.
- Clicking a rendered image should open the image asset where practical.
- Do not regress HTML `<img>` rendering or Obsidian embed rendering.

Acceptance:

- Drag/drop's HTML-first insert path still works.
- Existing Markdown image files render usefully.
- Missing image states are visible but quiet.

## Workstream 3: Sidebar State And Organization

### Persist Expanded Folder State

The hierarchical folder tree resets when Wraith closes.

Desired behavior:

- Persist expanded directories per workspace.
- Restore them on workspace open/restore.
- Store this as Wraith workspace/session state, similar to reopened tabs, not
  as vault Markdown content.
- Rewrite persisted paths when folders are renamed.
- Avoid expanding stale paths forever after deletes.

### Sorting Sections

The current hierarchy remains the default and should stay first-class.

Near-term desired behavior:

- Keep "Hierarchical" as the default section.
- Add the architecture needed for additional sidebar sections without changing
  the file-first source of truth.

Later/spec-needed behavior:

- Allow Arthur to define sidebar sort/group sections based on a frontmatter
  property.
- Allow these sections to be ordered and collapsed.
- Decide how property grouping interacts with normal folders, missing property
  values, multi-value frontmatter, and non-Markdown assets.

This needs a dedicated `v4-organization.md` spec before implementation.

### File And Folder Colors

Desired behavior:

- Start with conservative file/folder-kind coloring if useful.
- For each file/folder kind, allow only "default color" or "accent color".
- Keep the current look as the default.
- Defer arbitrary color pickers and custom per-folder colors unless explicitly
  reopened later.
- Do not make the tree visually noisy.

## Workstream 4: Git And Shortcuts

### Git Operation Hotkeys

Add configurable shortcuts for Git actions with no defaults assigned.

Desired behavior:

- Add Settings shortcut entries for Git pull, push, and sync.
- Default values are empty/unassigned.
- Hook shortcuts into the same actions as the Git panel.
- Avoid stealing common editor/browser shortcuts.

## Workstream 5: Agent Panel

The current Wraith Agent panel is a useful V3 bridge, but V4 should not treat
raw CLI stdout as the final UX. Tolaria's agent backend and structured event
model are the primary reference.

This needs a dedicated `v4-agent-panel.md` spec before implementation.

Desired direction:

- Move from command-output streaming toward structured agent events where
  available: text, reasoning/thinking, tool start, tool done, error, done.
- Support Codex and Claude Code as the first-class local CLI agents for the
  first V4 agent pass.
- Keep Hermes and custom commands configurable but generic unless a later spec
  promotes them to first-class behavior.
- Add a clear permission mode model. Tolaria's "Safe" vs "Power User" split is
  the right reference:
  - Safe: read-oriented or approval-oriented behavior.
  - Power User: workspace-write / accept-edits style behavior when Arthur
    explicitly chooses it.
- Make command/tool output readable and collapsible instead of flooding the
  chat transcript.
- Keep conversations alive when switching right-sidebar tabs.
- Keep the app local-first. No hosted agent backend.

Important non-goals:

- Do not directly port VS Code's Claude/Codex extensions unless a later
  investigation proves they expose a clean reusable surface.
- Do not build a database-backed conversation system.
- Do not make agents the source of truth for files.

Open questions for the agent spec:

- Which Codex and Claude CLI output formats are stable enough to depend on.
- How much Tolaria MCP behavior should be adapted for Wraith's simpler
  Markdown-vault model.
- Whether Wraith should expose a small bundled agent-docs context like Tolaria.

## Explicit Deferrals

These are not first-pass V4 polish tasks.

- A broad "smooth writing like iA Writer" experiment. This is worth exploring,
  but cursor, scrolling, selection, and CodeMirror rendering can regress
  easily. Treat it as an experiment after the concrete scroll/cursor polish.
- Property-based sidebar sections without a dedicated organization spec.
- True interactive CLI approval handling. V4's first agent direction is
  Tolaria-style Safe / Power User modes.
- Direct VS Code extension porting.
- Broad visual redesign or global radius changes.
- Arbitrary per-kind color pickers and custom per-folder colors.

## Suggested Spec Split

Create these only when starting the related implementation slice:

- `v4-agent-panel.md` for structured local-agent execution, permission modes,
  UI states, and Tolaria borrowing decisions.
- `v4-organization.md` for property-based sidebar grouping, custom colors, and
  persisted view/section settings.

The easy polish and editor/media items can stay tracked in this umbrella spec
unless they grow beyond their current scope.

## Implementation Order

1. Polish baseline: icon, easing, cursor, tree drag affordance, right-sidebar
   shape, terminal polish, Git status polish, and secondary drag-to-split
   affordance if it stays contained.
2. Editor/media: regular Markdown image embed rendering and bottom-scroll
   comfort.
3. Sidebar state: persisted expanded folder state and conservative color work.
4. Git shortcuts.
5. Agent panel spec, then implementation.
6. Organization spec, then implementation.

This order intentionally does the easy and medium work first, but only after
the roadmap defines the desired feel. The hard work follows once the specs
make the behavioral choices explicit.

## Verification Expectations

For code work spawned from this roadmap:

- Run `pnpm --filter desktop run build` for frontend/typecheck-sensitive work.
- Run Rust tests or targeted Rust checks when touching Tauri commands.
- Use the native dev app for UI behavior that depends on Tauri, terminal,
  Git, drag/drop, or agent behavior.
- Visually verify sidebar, tab, and right-sidebar polish in both light/dark or
  at least the currently used dark/translucent setup.
