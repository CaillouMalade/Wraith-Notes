---
type: project
status: active
Belongs to: "[[Wraith]]"
---

# V0 Setup Log

Records what was done in the initial Writer → Wraith rebrand pass and what was
deliberately deferred. Companion to [[Wraith]], [[Development Setup]],
[[Dev vs Release Builds]], and [[Feature Workflow & Versions]].

Once V1 is built and tagged, this doc retroactively becomes V1's release log.
Subsequent versions (V2, V3, …) get their own `V<N> Release Log.md` files
under this folder.

## Repo shape

```text
Wraith Notes/                       ← this repo (despite the "Vaults" path)
├── Project layout/                 ← planning notes
├── writer_source_code/             ← upstream Writer Computer, untouched (reference)
├── tolaria_source_code_ref_only/   ← reference only, ignored for now
└── wraith_app/                     ← the Wraith working copy
```

`writer_source_code/` and `tolaria_source_code_ref_only/` are not modified.
All work happens in `wraith_app/`. To diff Wraith against upstream Writer at
any time:

```bash
diff -r writer_source_code wraith_app
```

## What was rebranded in V0

User-visible identifiers only. The goal was a barebones launching app, not a
deep rename.

| Surface | From | To |
|---|---|---|
| Root `package.json` name | `writer-computer` | `wraith` |
| `apps/desktop/index.html` `<title>` | Writer | Wraith |
| `WindowTitle` component (browser/macOS title bar) | "Writer", "X - Writer" | "Wraith", "X - Wraith" |
| `tauri.conf.json` `productName` | Writer | Wraith |
| `tauri.conf.json` `identifier` (macOS bundle ID) | `com.writer-computer` | `com.wraith` |
| `tauri.conf.json` `version` (V1 baseline) | `0.0.30` | `1.0.0` |
| macOS app menu submenu name (`lib.rs`) | "Writer" | "Wraith" |
| macOS About menu item (`lib.rs`) | "About Writer" | "About Wraith" |

A second config file `apps/desktop/src-tauri/tauri.conf.dev.json` was added
to isolate dev runs (identifier `com.wraith.dev`, productName "Wraith Dev").
See [[Dev vs Release Builds]] for the full model.

`Info.plist` was checked: it has no `CFBundleName`/`CFBundleDisplayName` keys
of its own — Tauri injects those from `productName`. No edit needed.

## What was removed in V0

The auto-updater plugin was removed entirely. Wraith has no release pipeline
yet, and leaving Writer's updater wired meant it would try to auto-update
*into Writer* from Writer's GitHub releases on first launch.

Files/lines removed:

- `apps/desktop/src-tauri/Cargo.toml` — `tauri-plugin-updater` dep.
- `apps/desktop/src-tauri/tauri.conf.json` — `bundle.createUpdaterArtifacts`
  and `plugins.updater` blocks.
- `apps/desktop/src-tauri/src/updater.rs` — entire file deleted.
- `apps/desktop/src-tauri/src/lib.rs`:
  - `mod updater;` declaration.
  - "Check for Updates…" menu item construction.
  - `UpdaterMenuItems` / `UpdaterManager` registration.
  - Updater plugin registration (`tauri_plugin_updater::Builder::new().build()`).
  - Startup `start_check` + `spawn_daily_check` task.
  - `app_data_dir` resolution that only the updater needed.

The macOS app menu still exists and still shows Preferences, the CLI install
item, and the standard hide/quit predefined items.

## What was attribution-preserved

- `LICENSE` (GPL-3.0) is unchanged.
- `ATTRIBUTION.md` was added at `wraith_app/ATTRIBUTION.md`.
- `README.md` rewritten to introduce Wraith with a pointer to ATTRIBUTION
  and to the upstream `writer_source_code/`.

## What was intentionally deferred

These are visible-but-not-blocking strings, or internals that don't affect
the V0 success criteria. They should be revisited as Wraith diverges.

### Writer CLI subsystem (visible if user installs the CLI)

- `apps/desktop/src-tauri/src/main.rs` — multi-call dispatch checks for
  argv[0] basename `"writer"`. Renaming the CLI to `wraith` requires touching
  this and the symlink target in `commands/shell_install.rs`.
- `apps/desktop/src-tauri/src/lib.rs`:
  - `CLI_MENU_INSTALL_LABEL` / `CLI_MENU_UNINSTALL_LABEL` strings reference
    `'writer'`.
  - Dialog titles ("Writer CLI Installed", "Writer CLI", "Writer CLI Removed")
    and message bodies referencing the `writer` command.
- `apps/desktop/src-tauri/src/commands/shell_install.rs`:
  - File-level doc comment.
  - Symlink target name and install path logic.
  - One stale comment about "When `Writer.app` is replaced in place by the
    updater" — the updater is gone but the symlink-through-bundle technique
    is still correct.
- `apps/desktop/src-tauri/src/writer_cli.rs` — file name and internal
  references.
- `SPECs/writer-cli-spec.md` — spec doc.

### Internal names (never user-visible)

- Rust crate name `desktop` and lib name `desktop_lib` in
  `apps/desktop/src-tauri/Cargo.toml`.
- Frontend package name `desktop` in `apps/desktop/package.json`.
- Obj-C selector `writerOpenRecentWorkspace:` in `dock_menu.rs`.
- Doc comments mentioning "Writer" in `lib.rs` and `dock_menu.rs`.

### Branding/cosmetic

- App icons under `apps/desktop/src-tauri/icons/` are still Writer's icons.
  Until replaced, the dock and Finder will show the Writer icon for Wraith.
- Marketing site under `apps/website/` is Writer's landing page; not used
  by Wraith and can be removed or replaced later.

### Writer's project docs

- `wraith_app/AGENTS.md` and `wraith_app/CLAUDE.md` (symlink → AGENTS.md)
  describe Writer's agent workflow. Still useful guidance for working in
  this codebase, but talk about "Writer" throughout. Migrate or rewrite as
  Wraith's own conventions emerge.
- `wraith_app/docs/` and `wraith_app/SPECs/` are Writer's own dev docs and
  feature specs. Keep as historical reference; Wraith specs go in a new
  location once we start writing them.
- `wraith_app/CHANGELOG.md`, `TODOS.md`, `Triage.md` — Writer's project
  history. Not Wraith's. Decide later whether to archive or replace.

## V0 success check (from MacBook Development Checklist)

V0 is done when:

- [ ] Repo cloned/usable on the MacBook
- [ ] `pnpm install` succeeds in `wraith_app/`
- [ ] `pnpm app:dev` launches the dev app
- [ ] Window title shows "Wraith Dev" (because the dev override is active)
- [ ] macOS dock shows the app as "Wraith Dev"
- [ ] macOS menu bar shows "Wraith" with "About Wraith" (in-code menu strings, intentionally not branched between dev and release)
- [ ] App opens a workspace folder
- [ ] `pnpm app:build` produces a DMG that installs as plain "Wraith" in `/Applications/`

The actual MacBook setup steps live in [[MacBook Development Checklist]].
The build/run model is documented in [[Dev vs Release Builds]].

## Open decisions for after V0

- **Repo split**: `Development Setup.md` recommends a separate GitHub repo
  for Wraith outside any vault. Currently everything lives in one repo
  (`Wraith Notes/`). Decide when to split.
- **Icon**: design or commission a Wraith icon to replace Writer's.
- **Writer CLI rename**: do the full `writer` → `wraith` rename pass, or drop
  the CLI feature for V1.
- **Inherited docs**: keep, prune, or rewrite Writer's `docs/`, `SPECs/`,
  `AGENTS.md`.
