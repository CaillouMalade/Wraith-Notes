# Wraith Product Roadmap + V2 Compatibility Spec

## Status

Historical V2 roadmap/spec plus current deferral record.

V2 shipped on 2026-05-09 as `v2.0.0`. Do not read the early "Missing /
Wanted" inventory below as current app state; many items in it shipped during
the one-shot V2 release pass. Keep the detailed behavior sections because they
still document resolver, embed, callout, asset, and frontmatter decisions that
future work should preserve.

Current post-V2 use of this document:

- preserve the shipped V2 compatibility decisions;
- keep the explicit V3 deferrals visible;
- use Writer/Tolaria source as read-only implementation references when a
  future feature already exists there;
- create focused new specs for substantial V3 work instead of reopening the
  whole V2 plan.

V2 shipped:

- shared vault target resolver;
- image/PDF asset visibility, search, import, and preview tabs;
- Markdown image routing and Obsidian image/PDF embed rendering;
- Obsidian callout rendering;
- frontmatter wikilink display/navigation;
- KaTeX math decorations;
- configurable keyboard shortcuts;
- split center view;
- right sidebar Agent/Terminal/Git/Properties/Outline surfaces.

Known V3 deferrals:

- reliable note-body Finder image/PDF drag/drop;
- split-tab UX and tab/split interaction polish;
- continued source/docs cleanup after the one-shot release worktree.

## One-Line Goal

Make Wraith Arthur's daily local vault app: a fast files-first Markdown workspace that preserves plain Markdown as source of truth, keeps the current editor/file-browser/search strengths, fixes missing media/compatibility gaps, and can later grow toward Tolaria-style sync/publishing and optional agent/terminal workflows without becoming a database app.

## Historical Functionality Inventory

This section originally captured Arthur's stated wants/needs before chronological ordering or version splitting. It is preserved for context; the status block above and the V2 ship decision below are authoritative for what shipped vs. what moved to V3.

### Already Working / Preserve

- Markdown editing and reading already work and should not be reinvented.
- Body wikilinks already work and should be preserved while improving resolver consistency where needed.
- Mermaid diagrams already work and should be preserved.
- YAML frontmatter already works and should be preserved, especially avoiding unintended rewrites.
- Search/navigation is considered excellent; no major roadmap work needed now.
- Existing file/folder browser is considered great; only targeted missing behavior should be added.

### Missing / Wanted Functionality

- Media inside Markdown files:
  - view images referenced from Markdown files;
  - support Obsidian/Tolaria-style image embeds/links;
  - preserve Markdown source while rendering images usefully.
- Asset/media handling has several distinct layers:
  - show supported assets in the file explorer;
  - embed/render supported media inside Markdown files;
  - view/open images as files;
  - view/open PDFs as files.
- Media priority order:
  1. Inline images in Markdown notes are the most important next media behavior.
  2. Drag/drop external files into the vault is very useful and has two important target behaviors:
     - dropping pictures into the currently open note should copy the image into a root-level `attachments/` folder and insert an image embed/link at the cursor;
     - dropping files into the folder tree should copy the note/image/any file type into the targeted folder without editing the current note.
  3. Showing other supported file types in the sidebar is very useful and expected to be comparatively easy.
  4. PDFs linked from notes are less crucial because Arthur's agents often make Markdown versions of PDFs, but PDF opening/viewing is still a needed asset behavior.
- Do not treat "Obsidian compatibility" as a standalone product checklist. The roadmap is defined by Arthur's concrete Wraith specs and real vault needs; Obsidian/Tolaria only matter where they name a useful behavior Wraith should support.
- File browser/vault management is mostly already good:
  - live folder-tree reading works;
  - dynamic add/update works;
  - opening multiple tabs/windows in the app works;
  - Reveal in Finder works;
  - Copy Relative Path works;
  - Copy Absolute Path works;
  - rename note/file works;
  - delete file/folder works;
  - create new note works;
  - create new folder works;
  - duplicate file works;
  - open containing folder works;
  - filesystem changes are handled with a refresh option.
- File browser/vault management V2 status:
  - supported image/PDF files now appear in the sidebar/search and open in read-only asset tabs;
  - PDF opening/viewing shipped through in-app asset preview with fallback behavior;
  - file-tree drag/drop import shipped, including empty folder/tree states;
  - note-body image/PDF drag/drop remains a V3 deferral because the import/embed preview path is not reliable enough to promise yet.
- File browser/vault management later/not-needed items:
  - moving files by drag/drop within the tree is later;
  - dragging/dropping folders into the file tree does not work, but is not needed for now because folders can be created from the UI;
  - sorting is not needed beyond existing behavior;
  - recent files / quick reopen is not needed;
  - multi-select files is not needed.
- Hotkey customization shipped in V2 through a Preferences section for app-level shortcut visibility/remapping.
- Markdown/editor compatibility decisions:
  - Obsidian callouts shipped in V2.
  - Frontmatter wikilinks displayed as clickable chips/links shipped in V2.
  - Heading fragment scrolling is not important now; heading navigation may come later as file-heading navigation in the sidebar.
  - Embedding/transcluding another note inline is not needed; wikilinks are enough for note-to-note relationships.
  - Tolaria-style embeds for files/assets are the preferred reference behavior for file embeds.
  - Block references are not needed.
  - Markdown tables already work well and do not need roadmap work now.
  - Task checkboxes are not important now.
  - Tags are not needed for now.
  - LaTeX/math rendering shipped in V2.
  - Audio/video embeds are not needed.
  - HTML blocks appear to already render; no major roadmap work unless later testing shows a real gap.
  - Footnotes are not needed.
- Visual design and fluidity are extremely important:
  - V1's look/feel is considered perfect and should remain the design anchor;
  - the app should look beautiful and feel smooth/fluid;
  - the design language must not drift away from V1;
  - existing theme controls such as accent colors and background transparency should remain and govern the whole UI consistently;
  - current theme settings are considered perfect as-is.
- Layout/end-state shell:
  - left sidebar remains for folders and notes;
  - center panel is for files and should stay very clean;
  - center panel should support two side-by-side split tabs/panes, similar to Obsidian;
  - right sidebar should visually match the current left sidebar language;
  - left sidebar, right sidebar, and split center panes should be resizable;
  - focus mode is not needed because collapsing left/right sidebars is enough.
- Right sidebar and split panes are core product architecture for the end-state roadmap, not optional decoration. They become essential as soon as AI embedding exists, because AI workflows need a persistent side surface while notes stay open in the center.
- Right-sidebar functions shipped in V2 or still framed for future polish:
  - terminal, natively opened at the vault root;
  - high-value Tolaria-style AI sidepanel/chatbot interface, very similar to Tolaria's model, that sends chats to CLI agents underneath;
  - the AI/chat surface can partially replace bespoke UI features because Arthur can ask the agent to git commit, pull, refresh, add files, and perform other vault actions;
  - properties panel, similar to Tolaria but simpler;
  - table of contents / file heading navigation;
  - graph view.
- When iterating the right sidebar, lead with the AI sidepanel/chat/terminal workflow Arthur described; other sidebar surfaces can follow once the shell exists.
- Properties/YAML end state:
  - nice-looking UI for properties/YAML;
  - wikilinks should work in YAML/properties;
  - relative paths in YAML/properties are also acceptable; Arthur does not strongly prefer wikilinks over relative paths there.
- AI/agent sidepanel and terminal shipped in V2 as early local surfaces; background note-writing workflows remain later.
- Graph view is eventually interesting, but not now.
- Backlinks are not needed as a Wraith product feature. If backlink behavior becomes useful later for graph/navigation plumbing, borrow the approach from Tolaria rather than designing a new standalone backlinks surface.
- Templates are not needed.
- Command palette is good enough as-is for now.
- Font/settings decisions:
  - current font picker exists;
  - editor/file font and UI font may eventually be split;
  - UI font should probably stay fixed to the current one to avoid visual issues.
- Existing editor ergonomics to preserve:
  - word count already exists;
  - line wrap already exists;
  - spellcheck as-is from V1 is good enough.
- Explicit editor/product non-goals for now:
  - Vim mode is not needed;
  - import/export is not needed for now;
  - footnotes are not needed;
  - rendered rich cards are not needed; HTML block rendering plus image embeds are enough.
- Sync, Git, and publishing are definitely on the roadmap. Arthur will keep using other apps until Git functionality exists, so this is a major future Wraith capability, not a parking-lot idea. It does not need to ship immediately. Desired behavior is the same as Tolaria's Git/sync/publishing behavior, with Wraith UI/architecture adaptation rather than blind porting. This bucket requires a later source-code/reference pass against Tolaria to inventory exact behaviors before version splitting.
- Mobile/web apps are out of scope. Exposing Wraith on localhost is a real fun later idea/experiment: standalone desktop app when wanted, browser-hosted app when working alongside other browser-based work.

### Initial Buckets To Order Later

1. Preserve core editor/search/file-browser/design strengths.
2. Markdown media rendering and Tolaria-style image/file embed behavior.
3. Asset visibility/opening for images and PDFs.
4. Targeted vault/file-browser polish.
5. Hotkey and keyboard workflow refinement.
6. Core layout evolution: right sidebar, resizable panes, and split center tabs.
7. High-value Tolaria-style AI sidebar/terminal/chat workflow.
8. Properties/YAML UI and frontmatter relationship display.
9. Markdown compatibility extras: LaTeX/math.
10. Tolaria-inspired sync/Git/publishing.
11. Optional graph exploration; backlinks only if needed as Tolaria-derived support plumbing.
12. Optional localhost/browser experiment.

### Deferred Sequencing Questions For Source Inspection Session

- Decide whether asset browsing/opening ships before, with, or after inline Markdown media rendering after inspecting Wraith and Tolaria source complexity.
  - Current product leaning: inline images first; drag/drop image import into open notes and drag/drop file import into the folder tree are also high-value; showing supported assets in sidebar is also high-value; PDF viewing/opening is useful but less urgent.

## Product Contract

Wraith V2 must keep these rules:

- Files first, app second. Markdown files, local assets, and YAML frontmatter remain the source of truth.
- Open an existing vault in place. No migration step. No app-owned rewrite pass.
- One predictable editor surface. No global raw/preview toggle. No hidden editor/viewer swap.
- Inline enhancements are allowed only when they reduce friction and the raw Markdown remains directly recoverable where the user edits.
- Decorations/widgets must never be the authoritative data. The saved source text is authoritative.
- Unresolved or ambiguous targets must be visible and explainable. Never fail silently. Never guess between equal candidates.
- Tolaria is a behavior/reference source, not code to blindly port. Wraith keeps its React/CodeMirror/Tauri architecture.

## V2 MVP Definition

V2 is the smallest shipped version where normal daily notes no longer feel broken when they contain common Obsidian/Tolaria vault patterns.

V2 MVP includes:

1. Shared vault target resolver used by body wikilinks, Markdown links/images, Obsidian image embeds, media opening, and frontmatter wikilinks.
2. Body wikilinks remain clean and clickable, now using the shared resolver.
3. Obsidian image embeds render inline for local images: `![[image.png]]`, `![[folder/image.jpg]]`, and practical old-path variants.
4. Markdown image paths and Markdown links to local assets resolve through the same target policy.
5. Local image/PDF assets are visible or explicitly openable from Wraith instead of being invisible alien files.
6. Obsidian callouts render as readable styled blocks while preserving raw blockquote syntax.
7. Frontmatter wikilinks display as navigable links/chips when not being edited, and preserve raw YAML when unrelated edits happen.
8. A compatibility fixture suite covers the syntax matrix below without using private vault content.

V2 MVP does not include:

- graph view;
- backlink database/sidebar;
- semantic index as product surface;
- saved views, filters, database tables, or Notion/Tolaria-style collections;
- agent sidebar;
- plugin system;
- block editor rewrite;
- Git sync/conflict UX;
- note-embed transclusion for `![[Note]]`;
- block-reference navigation for `[[Note#^block-id]]` beyond preserving and resolving the target file;
- automatic creation of missing notes;
- automatic rewriting of old links to new canonical paths.

## Current Wraith Baseline

Active codebase: `wraith_app/`. Reference-only trees: `../writer_source_code/` and `../tolaria_source_code_ref_only/`.

Relevant current Wraith files:

- `apps/desktop/src/lib/wiki-links.ts`
  - Parses `[[...]]`, aliases, fragments.
  - Resolves slash targets as workspace-root paths.
  - Resolves bare targets by fuzzy-searching Markdown filenames/stems.
  - Returns only `internal` or `unresolved`; ambiguity is collapsed into unresolved.
- `apps/desktop/src/lib/paths.ts`
  - Normalizes paths.
  - Resolves Markdown links relative to the current file.
  - Probes extensionless Markdown paths.
  - Opens non-Markdown targets as external paths.
- `apps/desktop/src/components/editor-area/wiki-link-extension.ts`
  - CodeMirror extension for `[[...]]` decorations, autocomplete, and click navigation.
  - Hides raw syntax outside the cursor range; shows raw syntax while editing.
- `apps/desktop/src/components/editor-area/use-prosemark-editor.ts`
  - Assembles editor extensions.
  - Handles Markdown link clicks through `resolveLinkTarget`.
  - Handles pasted images by saving to `{note-stem}-assets/` and inserting ordinary Markdown image syntax.
- `apps/desktop/src/components/editor-area/image-src-resolver.ts`
  - Mutates rendered `<img src>` DOM to Tauri asset URLs for ordinary Markdown images.
  - Does not change saved Markdown.
- `apps/desktop/src/components/editor-area/frontmatter-panel.tsx`
  - Shows frontmatter as editable key/value rows.
  - Current rows are plain inputs only.
- `apps/desktop/src/lib/yaml-entries.ts`
  - Parses/serializes YAML key/value rows.
  - Complex values are reparsed and can be reformatted when a row is edited.
- `apps/desktop/src-tauri/src/commands/fs.rs`
  - `read_directory_impl` currently returns directories containing Markdown and `.md` files only.
  - `DirEntry` exposes `is_markdown`, not a general file kind.
- `apps/desktop/src-tauri/src/commands/search.rs`
  - Workspace index currently includes `.md` files only.
  - Fuzzy search is note-oriented, not asset-oriented.
- `apps/desktop/src-tauri/src/commands/images.rs`
  - Clipboard image paste saves images next to the note in `{note-stem}-assets/`.
- `apps/desktop/src/components/editor-area/page-kinds/`
  - Tab/page registry can support new non-Markdown page kinds later, e.g. a read-only `asset` page.

Existing specs to reconcile:

- `SPECs/obsidian-image-embed-spec.md`
- `SPECs/inline-media-preview-spec.md`
- `SPECs/heading-anchor-links-spec.md`

## Tolaria Reference Findings

Use these references for behavior, not as a mandatory architecture:

- `../tolaria_source_code_ref_only/src/utils/wikilink*.ts`
  - Practical matching order includes path suffix, filename stem, alias/title-like fields, and humanized title matching.
  - Matching is case-insensitive where needed.
  - Old path-style targets are tolerated when unique.
- `../tolaria_source_code_ref_only/src/utils/vaultImages.ts`
- `../tolaria_source_code_ref_only/src/utils/vaultAttachments.ts`
  - Treat vault-relative attachment paths as portable Markdown.
  - Convert only at render time to Tauri asset URLs.
  - Handle old asset URLs, Windows paths, external URLs, and traversal safety.
- `../tolaria_source_code_ref_only/src-tauri/src/vault/frontmatter.rs`
  - Extracts relationships from non-reserved frontmatter fields that contain wikilinks.
  - Handles scalar strings, arrays, and nested flow-array oddities.
  - Preserves/normalizes known frontmatter keys separately from custom relationship fields.
  - Has fallback parsing when YAML is malformed enough that the primary parser fails.
- `../tolaria_source_code_ref_only/src-tauri/src/frontmatter/yaml.rs`
  - Quotes YAML values containing `:`, `#`, collection-looking strings, booleans, nulls, and numbers.
  - Quotes keys that contain spaces/special characters.
  - Uses block scalars for multiline strings.
- `../tolaria_source_code_ref_only/src-tauri/src/vault/image.rs`
  - Accepts `jpg`, `jpeg`, `png`, `gif`, `webp`, `svg`, `bmp`, `tiff` for image import/copy.
  - Saves imported assets under `attachments/` with safe unique filenames.
- `../tolaria_source_code_ref_only/src-tauri/src/vault/parsing.rs`
  - Extracts display title from first body H1, then frontmatter title, then filename slug.
  - Strips wikilink syntax to display aliases/names in snippets.
  - Extracts outgoing wikilink targets for relationship/index use.

## V2 Syntax Matrix

### Body wikilinks

Supported in V2:

- `[[Note]]`
  - Target kind: note.
  - Display: `Note` unless title/alias display rules choose a better label in the UI.
- `[[Folder/Note]]`
  - Target kind: note.
  - Path target. Resolver tries vault-relative first, then safe fallback strategies below.
- `[[Folder/Note.md]]`
  - Target kind: note.
  - `.md`/`.markdown` suffix is accepted but not required.
- `[[Note#Heading]]`
  - Target kind: note plus fragment.
  - V2 resolver must preserve `fragment = Heading` even if heading-scroll is implemented later.
- `[[#Heading]]`
  - Target kind: current note plus fragment.
- `[[Note|Display text]]`
  - Target kind: note.
  - Display text is `Display text`; resolution uses `Note`.
- `[[Note#Heading|Display text]]`
  - Target kind: note plus fragment.
  - Display text is `Display text`.

Preservation:

- The exact source token is preserved unless the user edits it.
- Existing behavior of showing clean link text outside the cursor range and raw syntax while editing remains acceptable.

### Obsidian image embeds

Supported in V2:

- `![[image.png]]`
- `![[image.jpg]]`
- `![[image.jpeg]]`
- `![[image.gif]]`
- `![[image.webp]]`
- `![[image.svg]]`
- `![[image.bmp]]`
- `![[image.tiff]]`
- `![[folder/image.png]]`
- `![[attachments/Pasted image 20260101123000.png]]`
- `![[old/path/to/image.png]]` when a unique safe fallback match exists.

Parsed but not required to visually honor in V2 MVP:

- `![[image.png|alt text]]`
- `![[image.png|400]]`
- `![[image.png|400x300]]`

Policy for the optional pipe part in V2 MVP:

- Preserve it exactly.
- Do not treat it as part of the path.
- If it is non-numeric text, it may be used as alt/title text.
- If it is numeric sizing, rendering may ignore it in MVP, but tests must prove it is parsed/preserved and does not break resolution.

Explicitly out of V2 MVP:

- Note transclusion: `![[Some Note]]` renders an unsupported-note-embed placeholder, not the note body.
- Audio/video embeds.
- Mermaid/file transclusion via `![[diagram.mmd]]`.

### Markdown images

Supported in V2:

- `![Alt](image.png)`
- `![Alt](folder/image.png)`
- `![Alt](../assets/image.png)` when normalized path stays inside the vault.
- Existing pasted-image output such as `![name](note-assets/file.png)`.

Policy:

- Markdown image source remains Markdown image source.
- The editor may convert to a Tauri asset URL only in the rendered DOM/widget layer.
- Saved Markdown must not contain `asset:` URLs or absolute current-machine paths unless the user typed them.

### Markdown links

Supported in V2:

- `[Text](note.md)` opens note internally.
- `[Text](folder/note.md#heading)` opens note and preserves the fragment for heading navigation.
- `[Text](image.png)` opens/resolves a local asset.
- `[Text](file.pdf)` opens/resolves a local PDF.
- `[Text](https://example.com)` opens externally.
- `[Text](mailto:person@example.com)` opens externally.

Policy:

- Markdown links remain visibly links. V2 does not replace them with Obsidian-style links.
- Current-file relative resolution remains the first rule for Markdown links/images.

### Frontmatter wikilinks

Supported input forms:

```yaml
Belongs to: "[[Project]]"
Owner: "[[People/A B|Arthur]]"
Related:
  - "[[Project One]]"
  - "[[Project Two|Two]]"
Inline: "Discuss with [[Person]] before shipping"
```

V2 display policy:

- Scalar value that is exactly one wikilink displays as a single navigable link/chip when the row is not focused.
- Scalar value that contains text plus one or more wikilinks displays text plus navigable inline link spans when the row is not focused.
- Array values display one chip/span per wikilink where the array can be safely parsed.
- Focused rows always expose the raw editable YAML/string value.
- Unrelated body edits must not rewrite frontmatter.
- Editing a frontmatter row may reserialize that row/block according to the current frontmatter editor, but this must be explicit user action and covered by tests.

### Obsidian callouts

Supported in V2:

- `> [!note]`
- `> [!abstract]`, `> [!summary]`, `> [!tldr]`
- `> [!info]`, `> [!todo]`, `> [!tip]`, `> [!hint]`, `> [!important]`
- `> [!success]`, `> [!check]`, `> [!done]`
- `> [!question]`, `> [!help]`, `> [!faq]`
- `> [!warning]`, `> [!caution]`, `> [!attention]`
- `> [!failure]`, `> [!fail]`, `> [!missing]`
- `> [!danger]`, `> [!error]`
- `> [!bug]`
- `> [!example]`
- `> [!quote]`, `> [!cite]`
- Unknown types: `> [!custom]` render as generic callouts.

Supported title/collapse syntax:

- `> [!note] Custom title`
  - Title text is `Custom title`.
- `> [!note]+ Expanded by default`
  - `+` is parsed and preserved; V2 MVP may render as normal expanded callout.
- `> [!note]- Collapsed in Obsidian`
  - `-` is parsed and preserved; V2 MVP must not hide content by default unless Arthur explicitly accepts collapsible callouts later.

Policy:

- Normal blockquotes remain normal blockquotes.
- Callouts inside fenced code blocks are not detected.
- Nested blockquote content remains readable.
- Raw source remains directly editable. Styling must not create a separate preview mode.

### Assets

V2 supported asset types:

- Images: `.png`, `.jpg`, `.jpeg`, `.gif`, `.webp`, `.svg`, `.bmp`, `.tiff` case-insensitive.
- PDFs: `.pdf` case-insensitive.

V2 asset handling policy:

- Assets inside the vault are internal vault targets, not external files, when the normalized path is inside the workspace root.
- Asset paths outside the vault are external paths and must open through the OS/plugin-opener path, not internal app state.
- Tauri asset URLs are render-time details only.
- Wraith may show image/PDF assets in the sidebar once asset browsing is implemented.
- If an asset page kind is introduced, it is read-only and never participates in Markdown autosave.

## Shared Vault Target Resolver Spec

### Purpose

Create one resolver contract so all compatibility features answer the same question the same way: what does this vault-looking target mean?

The resolver replaces ad hoc feature logic across:

- `wiki-links.ts`
- `paths.ts`
- `wiki-link-extension.ts`
- `image-src-resolver.ts`
- future image-embed extension
- future media opening UI
- future frontmatter wikilink UI

### Expected Module Shape

Preferred frontend module:

- `apps/desktop/src/lib/vault-targets.ts`

The final implementation may split helpers, but the public contract should stay conceptually centralized.

Core input types:

```ts
type VaultTargetSource =
  | "body-wikilink"
  | "obsidian-embed"
  | "markdown-link"
  | "markdown-image"
  | "frontmatter-value";

type VaultTargetHint = "note" | "image" | "pdf" | "asset" | "unknown";

interface VaultTargetContext {
  workspaceRoot: string;
  currentFilePath: string | null;
  entries: VaultEntryIndex;
}
```

Core result types:

```ts
type VaultTargetResolution =
  | { kind: "resolved-note"; path: string; relativePath: string; fragment: string | null; displayText: string }
  | { kind: "resolved-asset"; path: string; relativePath: string; assetKind: "image" | "pdf"; displayText: string }
  | { kind: "external-url"; url: string }
  | { kind: "external-path"; path: string }
  | { kind: "same-file-fragment"; path: string; fragment: string; displayText: string }
  | { kind: "ambiguous"; candidates: VaultTargetCandidate[]; reason: string; displayText: string }
  | { kind: "unresolved"; reason: string; displayText: string }
  | { kind: "unsafe"; reason: string; displayText: string };
```

The exact TypeScript names can change, but the result states must not collapse ambiguity, unsafe paths, and missing targets into the same state.

### Vault Entry Index

V2 needs a vault entry index that can answer both note and asset questions.

Minimum fields per entry:

```ts
interface VaultEntry {
  path: string;          // absolute filesystem path
  relativePath: string;  // vault-root relative, forward slashes
  name: string;          // basename with extension
  stem: string;          // basename without extension
  extension: string;     // lowercase, no dot
  kind: "note" | "image" | "pdf" | "other-supported-asset";
  title?: string | null;     // frontmatter title or first H1 when available
  aliases?: string[];        // frontmatter aliases when available
}
```

Implementation options:

- Extend the Rust workspace index to include supported assets and lightweight note metadata, then expose it through Tauri; or
- Keep the Rust Markdown search index for notes and add a separate asset index/command; or
- Start with frontend composition of current Markdown search plus direct file probes, then consolidate before feature tracks rely on it.

V2 acceptance requires the resolver's public behavior, not a specific internal storage design.

### Normalization Rules

Apply these rules to internal vault targets:

1. Preserve the original raw text separately for round-trip and UI diagnostics.
2. Trim surrounding whitespace for resolution only.
3. Normalize backslashes to `/` for resolution only.
4. Decode URI escapes for Markdown link/image paths only. If decoding fails, keep the original string.
5. Split fragment at the first unescaped `#` for note targets.
6. Split alias/modifier at the first unescaped `|` for wikilink/embed syntax.
7. Strip `.md` and `.markdown` suffixes only for note lookup. Do not strip media extensions.
8. Treat extension matching case-insensitively.
9. Normalize `.` and `..` path segments before filesystem checks.
10. If normalization would escape the workspace root for an internal target, return `unsafe`.
11. Do not lowercase the saved/display path. Lowercase only for comparison fallbacks.
12. Never write normalized forms back to the Markdown source unless the user explicitly edits/replaces the link.

### Resolution Order

#### External URLs

For Markdown link/image syntax only:

1. If the target has an explicit URL scheme and is not a Windows drive path, return `external-url`.
2. `http`, `https`, `mailto`, `obsidian`, and other schemes are external in V2 MVP.
3. Remote image thumbnails/previews are out of scope for V2 MVP.

For wikilinks/embeds:

- `[[https://example.com]]` is not treated as a URL in V2 MVP. It resolves like an unresolved note-looking target unless Arthur explicitly wants URL wikilinks later.

#### Markdown links/images

For `[text](...)` and `![alt](...)`:

1. Current-file relative exact path.
2. Current-file relative extension probes for notes: `.md`, `.markdown`, `index.md`, `index.markdown`, `README.md`.
3. Vault-root relative exact path when target starts with `/` or current-relative failed.
4. Vault-root relative extension probes for notes.
5. Case-insensitive exact-path fallback if exactly one matching vault entry exists.
6. If the target has a supported media/PDF extension and exactly one filename/basename match exists in the asset index, resolve to that asset.
7. If multiple candidates tie at the same priority, return `ambiguous`.
8. If no candidate exists and the target is a local path, return `external-path` only if it is outside the vault or explicitly absolute. Otherwise return `unresolved`.

#### Body wikilinks

For `[[...]]`:

1. Same-file fragment: `[[#Heading]]` resolves to the current note with `fragment = Heading`.
2. Explicit vault-relative path: if target contains `/`, try `{workspaceRoot}/{target}` with `.md`/`.markdown` probes.
3. Explicit current-file relative fallback: if target contains `/` and vault-relative fails, try relative to the current file's directory.
4. Unique relative path suffix match against note entries, allowing old path-style targets when they uniquely identify one note.
5. Unique filename stem match, case-sensitive first, then case-insensitive.
6. Unique alias match from frontmatter aliases, case-sensitive first, then case-insensitive.
7. Unique title match from frontmatter title or first H1, case-sensitive first, then case-insensitive.
8. Unique humanized-stem match, e.g. `career-tracks` may match `Career Tracks` when unique.
9. If multiple candidates tie at the same priority, return `ambiguous`.
10. If none match, return `unresolved`.

#### Obsidian image embeds

For `![[...]]` where the target path has a supported image extension:

1. If target contains `/`, try vault-relative exact asset path.
2. If target contains `/`, try current-file relative exact asset path.
3. Try unique relative path suffix match against image asset entries.
4. If target is bare, try current-file sibling exact filename.
5. Try common attachment folders under vault root, in order:
   - `attachments/{target}`
   - `Attachments/{target}`
   - `assets/{target}`
   - `Assets/{target}`
   - current note's `{note-stem}-assets/{target}`
6. Try unique image filename match across the vault, case-sensitive first, then case-insensitive.
7. If multiple candidates tie at the same priority, return `ambiguous`.
8. If none match, return `unresolved`.

For `![[...]]` where the target is a note or unknown extension:

- Return `unresolved` with reason `unsupported-embed-kind` in V2 MVP, or a dedicated unsupported result if the implementation adds one.
- Render a visible placeholder preserving the raw target.

#### Frontmatter wikilinks

For wikilinks found in frontmatter values:

1. Parse wikilinks exactly like body wikilinks.
2. Resolve using the same body-wikilink resolution order.
3. Display `alias` when present; otherwise display resolved note title/stem; otherwise display the raw target.
4. Preserve unresolved and ambiguous states visually.
5. Do not rewrite YAML while resolving/displaying.

### Ambiguity Policy

Ambiguous means Wraith found more than one equally plausible internal target.

V2 behavior:

- Do not choose silently.
- Body wikilinks render as clickable-looking but with an ambiguous style; click shows a small non-destructive diagnostic or does nothing with console/log diagnostic during MVP.
- Image embeds render an ambiguous placeholder listing the target and candidate count.
- Frontmatter links render an ambiguous chip/span.
- Future ambiguity picker is explicitly post-MVP unless Arthur requests it.

### Missing Target Policy

Missing means Wraith found no safe internal target.

V2 behavior:

- Do not create files automatically.
- Do not rewrite links.
- Body wikilinks keep readable display text and an unresolved style.
- Image embeds show an inline placeholder with the original target.
- Frontmatter links show unresolved chip/span and preserve raw value.
- Missing-target creation is post-MVP.

### Heading/Fragment Policy

V2 resolver must parse and carry fragments for:

- Markdown links: `[Text](note.md#Heading)`
- Body wikilinks: `[[Note#Heading]]`
- Same-file wikilinks: `[[#Heading]]`

Heading-scroll behavior can be implemented with `SPECs/heading-anchor-links-spec.md`, but the resolver work must not block on it.

V2 MVP minimum:

- Opening a resolved note target must not drop the fragment from the resolver result.
- If fragment scrolling is not implemented yet, the file opens at the top/current saved scroll and the unresolved fragment is visible in diagnostics/tests.

Preferred V2 behavior:

- Use GitHub-style heading slugs from `heading-anchor-links-spec.md`.
- Same-document fragments scroll inside the active editor without adding a new tab history entry.
- Cross-document fragments open the target note and scroll after load.

## Feature Tracks

### Track 1: Shared Vault Target Resolver

Purpose:

- Establish the reusable compatibility foundation before UI features accumulate one-off path logic.

Scope:

- Add or refactor to a shared resolver module, preferably `apps/desktop/src/lib/vault-targets.ts`.
- Preserve `parseWikiLink` behavior or move it behind the new module without regressing existing tests.
- Introduce explicit `resolved-note`, `resolved-asset`, `external-url`, `external-path`, `ambiguous`, `unresolved`, and `unsafe` states.
- Provide note lookup, asset lookup, path normalization, and result display helpers.
- Add tests before UI wiring.

Likely Wraith files:

- `apps/desktop/src/lib/vault-targets.ts` (new)
- `apps/desktop/src/lib/wiki-links.ts`
- `apps/desktop/src/lib/paths.ts`
- `apps/desktop/src/lib/tauri.ts`
- `apps/desktop/src/types/fs.ts`
- `apps/desktop/src-tauri/src/commands/search.rs` or a new command module if backend indexing changes
- `apps/desktop/tests/wiki-links.test.ts`
- `apps/desktop/tests/paths.test.ts`
- new `apps/desktop/tests/vault-targets.test.ts`

Acceptance criteria:

- Existing `wiki-links.test.ts` and `paths.test.ts` still pass.
- New resolver tests cover:
  - bare note stem;
  - duplicate note stems -> `ambiguous`;
  - folder-qualified note path;
  - `.md` and `.markdown` suffixes;
  - aliases and fragments;
  - same-file fragments;
  - current-relative Markdown links;
  - vault-relative Obsidian links;
  - unique old path suffix;
  - image filename with current-file sibling;
  - image filename under `attachments/`;
  - duplicate image basenames -> `ambiguous`;
  - PDF asset target;
  - unsupported embed target;
  - traversal outside root -> `unsafe`;
  - missing note/media -> `unresolved`.
- Resolver results do not require DOM/editor state.
- Resolver does not write to disk or mutate source text.

### Track 2: Body Wikilink Resolver Migration

Purpose:

- Keep current body wikilink UX, but make navigation use the shared resolver.

Scope:

- Route `wiki-link-extension.ts` click handling through the shared resolver.
- Keep current autocomplete behavior initially unless it must change to support the resolver index.
- Preserve raw/editing behavior.
- Add visible unresolved/ambiguous styles if not already present.

Likely Wraith files:

- `apps/desktop/src/components/editor-area/wiki-link-extension.ts`
- `apps/desktop/src/lib/wiki-links.ts`
- `apps/desktop/src/lib/vault-targets.ts`
- `apps/desktop/tests/wiki-links.test.ts`

Acceptance criteria:

- `[[Note]]` still displays as `Note` and opens the resolved note.
- `[[Note|Alias]]` displays `Alias` and opens `Note`.
- `[[#Heading]]` resolves against the active file.
- Duplicate stems no longer look like silent failure; they produce a distinct ambiguous state.
- Missing targets remain preserved and visibly unresolved.
- Cursor inside the link still exposes raw `[[...]]` syntax.
- No file contents are rewritten by viewing/clicking links.

### Track 3: Obsidian Image Embeds

Purpose:

- Make image-heavy Obsidian notes readable inside Wraith.

Scope:

- Detect `![[...]]` outside frontmatter, fenced code blocks, and inline code.
- Parse target, alias/modifier, and raw source text.
- Resolve image targets through the shared resolver.
- Render inline image widgets/decorations using Tauri asset URLs.
- Show clear placeholders for unresolved, ambiguous, unsafe, and unsupported-note-embed states.
- Preserve source exactly on save.

Likely Wraith files:

- new `apps/desktop/src/components/editor-area/obsidian-embed-extension.ts`
- `apps/desktop/src/components/editor-area/use-prosemark-editor.ts`
- `apps/desktop/src/components/editor-area/image-src-resolver.ts`
- `apps/desktop/src/lib/vault-targets.ts`
- `apps/desktop/tests/vault-targets.test.ts`
- new editor-extension tests if Wraith has/gets a CodeMirror test harness

Acceptance criteria:

- `![[image.png]]` renders inline when `image.png` resolves uniquely.
- `![[folder/image.jpg]]` renders inline when the folder path resolves.
- `![[attachments/Pasted image.png]]` renders inline.
- Missing target renders a placeholder containing `image.png` and an unresolved label/style.
- Duplicate image basenames render an ambiguous placeholder and do not pick randomly.
- `![[Some Note]]` renders an unsupported note-embed placeholder in V2 MVP.
- Embeds inside fenced code/inline code are not rendered.
- Cursor/selection on the embed exposes or allows editing raw source text.
- Saving and reloading preserves the original `![[...]]` token byte-for-byte when not edited.

### Track 4: Markdown Image/Asset Link Resolver Migration

Purpose:

- Make ordinary Markdown image/link behavior consistent with Obsidian embeds and asset opening.

Scope:

- Route Markdown image `src` resolution through shared resolver or a thin wrapper over it.
- Route Markdown link click handling in `use-prosemark-editor.ts` through shared resolver.
- Keep external URL/path behavior.
- Keep render-time Tauri asset URL conversion out of saved Markdown.

Likely Wraith files:

- `apps/desktop/src/components/editor-area/use-prosemark-editor.ts`
- `apps/desktop/src/components/editor-area/image-src-resolver.ts`
- `apps/desktop/src/lib/paths.ts`
- `apps/desktop/src/lib/vault-targets.ts`
- `apps/desktop/tests/paths.test.ts`
- `apps/desktop/tests/vault-targets.test.ts`

Acceptance criteria:

- Existing Markdown link tests still pass.
- `![Alt](note-assets/pasted.png)` still renders from local file.
- `[Open PDF](file.pdf)` resolves as a local PDF asset when inside the vault.
- `[Open URL](https://example.com)` still opens externally.
- `asset:` URLs are never written into Markdown by resolver/rendering.
- Paths with `..` are allowed only when normalized target stays inside the vault.

### Track 5: Asset Browsing and Opening

Purpose:

- Wraith should acknowledge image/PDF files as first-class vault residents without changing Markdown editing behavior.

V2 MVP UX decision:

- Show supported image/PDF assets in the sidebar when they are in a directory that is already visible because it contains Markdown or supported assets.
- Use distinct icons/labels for Markdown, image, and PDF entries.
- Clicking a Markdown file opens the editor as today.
- Clicking an image/PDF opens a read-only asset tab if implemented in the milestone; otherwise opens through the system viewer via `@tauri-apps/plugin-opener` as an explicitly accepted MVP fallback.
- Context menu for assets starts minimal: Open, Open in New Tab if asset tabs exist, Copy Relative Path, Copy Absolute Path, Reveal in Finder, Delete.
- Renaming assets can be deferred unless sidebar implementation already makes it cheap and safe.

Preferred V2 architecture:

- Add an `asset` page kind under `apps/desktop/src/components/editor-area/page-kinds/`.
- `asset` tabs are read-only and have no autosave, frontmatter panel, document footer, Markdown stats, or editor cursor state.
- Image asset tab: centered image preview, natural size capped to viewport, copy/reveal/open-external actions.
- PDF asset tab: either embedded browser/PDF preview if straightforward, or a clear button to open with system viewer.

Likely Wraith files:

- `apps/desktop/src-tauri/src/commands/fs.rs`
- `apps/desktop/src-tauri/src/commands/search.rs` or new asset index command
- `apps/desktop/src/types/fs.ts`
- `apps/desktop/src/stores/workspace-store.ts`
- `apps/desktop/src/components/sidebar/file-tree.tsx`
- `apps/desktop/src/components/sidebar/file-tree-node.tsx`
- `apps/desktop/src/components/sidebar/file-context-menu.ts`
- `apps/desktop/src/components/editor-area/page-kinds/asset.tsx` (if asset tab chosen)
- `apps/desktop/src/components/editor-area/page-kinds/index.ts`
- `apps/desktop/src/stores/editor-store.ts` if session/navigation needs asset locations

Acceptance criteria:

- Directories with Markdown continue to display as before.
- Supported assets can be made visible without surfacing arbitrary junk files.
- Hidden files and ignored paths remain hidden/ignored.
- Clicking an image does not attempt to read it as UTF-8 Markdown.
- Clicking a PDF does not attempt to read it as UTF-8 Markdown.
- Asset tabs, if implemented, survive tab switching and session serialization safely.
- Deleting/revealing/copying paths for assets behaves consistently with Markdown files.
- Existing Markdown file tree behavior is not regressed.

### Track 6: Obsidian Callouts

Purpose:

- Make callout-heavy notes readable without introducing preview mode.

Scope:

- Detect contiguous blockquote blocks whose first meaningful line matches Obsidian callout syntax.
- Apply line/block decorations and CSS classes for callout type/tone.
- Preserve raw Markdown syntax.
- Do not collapse content by default in V2 MVP.
- Do not detect inside fenced code blocks.

Likely Wraith files:

- new `apps/desktop/src/components/editor-area/callout-decorations.ts`
- `apps/desktop/src/components/editor-area/use-prosemark-editor.ts`
- maybe `apps/desktop/src/components/editor-area/markdown-formatting.ts` if commands need awareness later
- tests for parser/helper if factored into pure module, e.g. `apps/desktop/tests/callouts.test.ts`

Callout type mapping:

- neutral/info: `note`, `abstract`, `summary`, `tldr`, `info`, `todo`
- helpful: `tip`, `hint`, `important`, `success`, `check`, `done`
- question: `question`, `help`, `faq`
- warning: `warning`, `caution`, `attention`
- danger/error: `failure`, `fail`, `missing`, `danger`, `error`, `bug`
- example/quote: `example`, `quote`, `cite`
- unknown: generic

Acceptance criteria:

- Common callout types render as styled callout blocks.
- Unknown types render as generic callouts.
- Title text after the marker is displayed/readable.
- `+` and `-` collapse markers are parsed and preserved but do not hide content by default.
- Ordinary blockquotes are unchanged.
- Code blocks containing `> [!note]` are unchanged.
- Editing/copying/saving preserves the original blockquote source.

### Track 7: Frontmatter Wikilink Display and Navigation

Purpose:

- Make relationship metadata useful without changing YAML into an app-owned model.

Scope:

- Parse wikilinks from frontmatter scalar and array values for display only.
- Resolve them through the shared resolver.
- Render navigable links/chips in the frontmatter panel when a row is not focused.
- Focus/edit always exposes the raw value.
- Preserve raw frontmatter when body-only edits occur.

Likely Wraith files:

- `apps/desktop/src/components/editor-area/frontmatter-panel.tsx`
- `apps/desktop/src/components/editor-area/use-frontmatter-entries.ts`
- `apps/desktop/src/lib/yaml-entries.ts`
- new `apps/desktop/src/lib/frontmatter-links.ts`
- `apps/desktop/src/lib/vault-targets.ts`
- `apps/desktop/tests/yaml-entries.test.ts`
- new `apps/desktop/tests/frontmatter-links.test.ts`

Acceptance criteria:

- `Belongs to: "[[Project]]"` displays a Project link/chip when row is unfocused.
- `Owner: "[[People/A B|Arthur]]"` displays Arthur and navigates to the target note.
- Arrays of wikilinks display one link/chip per item where parseable.
- Mixed text values show text plus link spans without losing text.
- Unresolved links are visually marked and preserve raw value.
- Ambiguous links are visually marked and do not pick randomly.
- Focusing a value row shows the raw original string/YAML representation.
- Saving body changes does not reserialize frontmatter.
- Editing one frontmatter row does not unexpectedly rewrite untouched complex rows beyond current explicit frontmatter editor behavior; if current behavior cannot guarantee that, document the limitation and add tests before changing behavior.

### Track 8: Compatibility Fixtures, QA, and Ship

Purpose:

- Prove V2 behavior against representative vault patterns without copying private note content into the repo.

Fixture policy:

- Build synthetic notes/assets that mirror structure and syntax, not private content.
- Keep fixture files small and deterministic.
- Use filenames with spaces, punctuation, duplicate stems, nested folders, and common attachment folder names.
- Include at least one path with spaces because the Wraith workspace path itself already exposed path-encoding issues during V1 setup.

Recommended fixture layout:

```text
apps/desktop/tests/fixtures/v2-vault/
  Inbox.md
  Projects/
    Project One.md
    Project Two.md
    Duplicate.md
  Archive/
    Duplicate.md
  People/
    A B.md
  Assets/
    diagram.png
    Diagram.png
    manual.pdf
  attachments/
    Pasted image 2026-01-01 123000.png
  Notes With Spaces/
    Uses Callouts.md
    Uses Frontmatter Links.md
```

Representative fixture content:

- Body wikilinks with aliases/fragments.
- Duplicate basename links.
- Missing links.
- Image embeds in root, nested folder, attachment folder, and missing target.
- Markdown images and Markdown links to notes/assets.
- Frontmatter scalar wikilinks, arrays of wikilinks, mixed text values.
- Common callouts and unknown callout.
- Literal callout/embed syntax inside code blocks.

Automated acceptance:

- Resolver unit tests pass against fixture index.
- Frontmatter link parser tests pass.
- Callout parser/helper tests pass if callout detection is factored.
- Existing tests for wiki links, paths, frontmatter, YAML entries, editor APIs, and image paste still pass.
- Rust tests pass for any backend index/sidebar changes.

Manual QA acceptance:

- Run Wraith Dev against a synthetic fixture vault.
- Run Wraith Dev against Arthur's real vault without committing private content.
- Confirm visually:
  - common notes open normally;
  - image embeds render or show useful placeholders;
  - PDFs/images can be found/opened;
  - callouts are readable;
  - frontmatter wikilinks navigate or show unresolved/ambiguous states;
  - no hidden raw/preview mode confusion;
  - unrelated saves do not rewrite frontmatter/links/assets.

## Preservation Rules

These are release-blocking rules:

- Opening a note must not rewrite the file.
- Rendering a note must not rewrite the file.
- Clicking a link/embed/frontmatter chip must not rewrite the file.
- Resolver normalization must not be written back automatically.
- Tauri asset URLs must not be serialized into Markdown.
- Absolute current-machine paths must not replace vault-relative paths unless the user explicitly types/pastes them.
- Frontmatter must remain byte-for-byte unchanged on body-only edits.
- Body Markdown must remain byte-for-byte unchanged on frontmatter-only display parsing.
- Existing `[[...]]`, `![[...]]`, Markdown image, Markdown link, and callout source should survive save/reload when untouched.
- If a frontmatter row is edited, only explicit editor behavior may reserialize YAML; tests must capture exactly what is allowed.

## UX Contract

### Single editing surface

- The editor is always the editor.
- Inline widgets/decorations are enhancements on top of source text, not a separate preview document.
- A user must always have an obvious way to place the cursor and edit the raw syntax.
- The app must not globally switch between raw/source and preview/reader modes.

### Widgets/decorations

Allowed:

- Replacing `[[target|alias]]` with `alias` outside the cursor range, as current Wraith already does.
- Rendering `![[image.png]]` as an image widget outside the cursor range.
- Styling callout blocks with borders/background/icons.
- Rendering frontmatter wikilinks as chips/spans when a row is not focused.

Required:

- Cursor/focus inside the relevant source region exposes editable raw syntax.
- Copy/paste/save operate on Markdown source, not widget text.
- Unresolved/ambiguous states are visible.

Disallowed:

- A hidden viewer mode that changes how editing works without a clear state.
- A global preview toggle for V2.
- Replacing the Markdown editor with a block editor.
- Treating decorations as source of truth.

## Milestones

### V2.0 Foundation

Goal:

- Land shared resolver and fixture tests with minimal user-visible behavior change.

Included:

- Shared resolver contract.
- Vault entry/index strategy for notes and supported assets.
- Body wikilink migration to resolver if small enough; otherwise keep as V2.0 follow-up but do not start embeds before resolver exists.
- Resolver fixture suite.

Exit criteria:

- Resolver tests cover the syntax/resolution matrix.
- Existing wiki/link/path behavior is not regressed.
- Ambiguous/unresolved/unsafe states are represented distinctly.

### V2.1 Readability

Goal:

- Make common note content readable.

Included:

- Obsidian image embeds.
- Obsidian callouts.
- Clear unresolved/ambiguous placeholders.

Exit criteria:

- Fixture notes with embeds/callouts are readable in Wraith Dev.
- Untouched notes round-trip without source rewrites.

### V2.2 Asset Handling

Goal:

- Make vault images/PDFs discoverable/openable.

Included:

- Sidebar/index support for supported assets.
- Open image/PDF via read-only asset tab or explicit system-viewer fallback.
- Markdown links/images use shared resolver for local assets.

Exit criteria:

- Clicking an asset never attempts Markdown UTF-8 editing.
- Asset links/embeds resolve consistently.
- Sidebar remains clean and respects hidden/ignored paths.

### V2.3 Metadata Compatibility

Goal:

- Make frontmatter relationships useful without YAML migration.

Included:

- Frontmatter wikilink parsing/display/navigation.
- Preservation tests for body-only and frontmatter-display-only workflows.

Exit criteria:

- Scalar, array, mixed, unresolved, and ambiguous frontmatter wikilinks work as specified.
- Body-only saves preserve frontmatter.

### V2.4 QA and Ship

Goal:

- Validate against real vault patterns and prepare public release.

Included:

- Synthetic fixture QA.
- Manual QA against Arthur's real vault.
- Known unsupported syntax doc.
- Changelog/release notes.
- Version bump/build/install/tag if Arthur chooses to ship.

Exit criteria:

- Automated tests pass.
- Manual QA blockers fixed or explicitly deferred.
- No private vault content committed.
- Release path follows Wraith dev/release split.

V2 ship decision, 2026-05-09:

- Arthur accepted V2 with two explicit V3 follow-ups rather than holding V2 for them.
- Image drag/drop into notes is deferred to V3. Current observed behavior: Finder image drops can insert an Obsidian embed placeholder, but the in-editor image preview path remains unstable and previously caused cursor/selection lockups when implemented as a replacement widget. Attempted fixes included native Tauri webview drag/drop wiring, importing dropped files to `attachments/`, inserting `![[attachments/name]]`, resolving through `resolve_vault_asset`, rendering image/PDF embed decorations, changing boundary selection handling, adding image-load failure states, and finally making embed previews non-invasive by rendering after the raw Markdown instead of replacing it. The result is not reliable enough to claim V2 support.
- Split tabs are deferred to V3 polish. Current observed behavior: split view works, but tab/split interactions are finicky enough that they should not be treated as fully polished V2 UX.
- For V2, users should rely on sidebar/tree asset importing plus normal asset browsing/opening, not note-body image drag/drop as a promised workflow.

## Validation Commands For Implementation Milestones

Run from `wraith_app/` unless noted.

Frontend targeted tests, when relevant:

```bash
pnpm exec vp test apps/desktop/tests/wiki-links.test.ts
pnpm exec vp test apps/desktop/tests/paths.test.ts
pnpm exec vp test apps/desktop/tests/frontmatter.test.ts
pnpm exec vp test apps/desktop/tests/yaml-entries.test.ts
```

Frontend build:

```bash
pnpm --filter desktop run build
```

Rust tests/checks when backend commands/indexing change:

```bash
cd apps/desktop/src-tauri
cargo test
cargo clippy
cargo fmt --check
```

Native manual QA:

```bash
pnpm app:dev
```

Do not use `pnpm dev` for native behavior; it is Vite/frontend only.

## Open Decisions For Arthur

These are the only decisions that should block implementation planning:

1. Asset opening fallback:
   - Spec default: read-only asset tab if not too expensive; system viewer is acceptable MVP fallback.
   - Arthur decision needed only if he strongly prefers one.
2. Frontmatter display richness:
   - Spec default: unfocused chips/spans, focused raw input.
   - Arthur decision needed only if chips feel too mode-like.
3. Heading fragments:
   - Spec default: resolver preserves fragments in V2.0; actual scroll can follow `heading-anchor-links-spec.md` when scheduled.
   - Arthur decision needed only if heading-scroll must be in the first V2 ship.

Everything else above is precise enough to convert into milestone implementation plans.

## Explicit Deferrals

Post-MVP unless Arthur expands scope:

- ambiguity picker;
- create-missing-note flow;
- note transclusion for `![[Note]]`;
- block reference scrolling for `#^block-id`;
- remote image preview;
- audio/video embeds;
- PDF inline thumbnails inside editor text;
- Obsidian canvas;
- Obsidian Dataview;
- graph/backlinks/sidebar intelligence;
- automatic link rewriting/canonicalization;
- broad Tolaria semantic/database model.

## Next Step After V2

Write focused V3 specs for the accepted deferrals before implementing them:

- note-body image/PDF drag/drop stabilization;
- split-tab UX polish;
- any additional post-V2 cleanup Arthur explicitly prioritizes.
