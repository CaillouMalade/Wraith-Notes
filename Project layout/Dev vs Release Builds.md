---
type: project
status: active
Belongs to: "[[Wraith]]"
---

# Dev vs Release Builds

Wraith uses a **two-config split** so the daily-use installed app and the
in-progress dev build are isolated at the OS level. This doc explains how
the split works, the commands that drive each mode, and what an agent
working on this codebase should and shouldn't change.

Companion to [[Wraith]], [[Development Setup]], [[V0 Setup Log]].

## TL;DR

| Mode | Command (from `wraith_app/`) | Identifier | Product name | Lives at |
|---|---|---|---|---|
| Daily-use installed app (V1, V2, V3, …) | `pnpm app:build` | `com.wraith` | "Wraith" | `/Applications/Wraith.app` |
| Dev iteration loop | `pnpm app:dev` | `com.wraith.dev` | "Wraith Dev" | runs from source, no install |

Both can coexist. They do not share preferences or state. Single-instance
restriction does not apply across them because they're different identifiers
to macOS.

## How the split is implemented

Two Tauri config files in `wraith_app/apps/desktop/src-tauri/`:

### `tauri.conf.json` — release baseline

The full config. This is what `tauri build` reads by default. Owns:

- `productName: "Wraith"` — what shows in the dock, Finder, and menu bar.
- `identifier: "com.wraith"` — the macOS bundle ID. Drives the Application
  Support folder (`~/Library/Application Support/com.wraith/`).
- `version` — bumped manually before each release (`1.0.0`, `2.0.0`,
  `3.0.1`, …).
- All windowing, security, bundle, plugin config.

### `tauri.conf.dev.json` — dev overrides

A small file that only overrides the fields that should differ in dev:

```json
{
  "$schema": "https://schema.tauri.app/config/2",
  "productName": "Wraith Dev",
  "identifier": "com.wraith.dev"
}
```

Tauri does a deep JSON merge when you pass `--config` — every other field
is inherited from `tauri.conf.json`. So changes to windowing, plugins,
bundle config, etc. only need to be made in `tauri.conf.json` and they
flow through to dev automatically.

The `tauri dev` command picks up the dev config because of the `--config`
flag wired into the npm script (see below). Plain `tauri build` ignores
the dev file entirely.

## Scripts

### From `wraith_app/` root

```bash
pnpm app:dev      # full dev app: vite + cargo build + Tauri window with com.wraith.dev
pnpm app:build    # release build: produces .app + .dmg with com.wraith
```

Both are thin wrappers around scripts in `apps/desktop/package.json`.

### From `wraith_app/apps/desktop/`

If working inside the desktop package directly:

```bash
pnpm tauri:dev    # equivalent to root's app:dev
pnpm tauri:build  # equivalent to root's app:build
```

### Other inherited Writer scripts (don't confuse with above)

- `pnpm dev` (from root) — runs `vp run desktop#dev` which is **just Vite, frontend only**. Doesn't launch the Tauri window. Useful only for fast UI-only iteration with no Rust.
- `pnpm tauri` (from `apps/desktop/`) — raw passthrough to the `tauri` CLI; lets you run any subcommand by hand (e.g. `pnpm tauri info`).

The two commands you'll use 99% of the time are `app:dev` and `app:build`.

## Workflow

### Releasing a new version

1. Decide the new version number (e.g. you're shipping V4 → `4.0.0`, or a
   hotfix → `3.0.2`).
2. Edit `wraith_app/apps/desktop/src-tauri/tauri.conf.json`:
   - Bump `version` to the target number.
3. Bump `version` in `wraith_app/apps/desktop/src-tauri/Cargo.toml` and
   `wraith_app/apps/desktop/package.json` to match.
4. Run `pnpm app:build` from `wraith_app/`. ~10–25 min on first run, ~2–5 min after.
5. The DMG appears at `apps/desktop/src-tauri/target/release/bundle/dmg/Wraith_<version>_aarch64.dmg`.
6. Open the DMG, drag `Wraith.app` over the existing one in `/Applications/` (replace).
7. Right-click → Open the first time after replacing (Gatekeeper resets when binaries change).

The installed app uses `~/Library/Application Support/com.wraith/`. That state survives replacement between releases unless a future migration changes the schema.

### Daily dev loop

1. From `wraith_app/`, run `pnpm app:dev`.
2. Wait for the "Wraith Dev" window to open. Your edits hot-reload (frontend) or recompile-on-save (Rust).
3. `Ctrl+C` in the terminal to stop.

The dev build uses `~/Library/Application Support/com.wraith.dev/`. Wreck this freely — it doesn't touch your daily release data.

### Running both at the same time

Yes, this works:
- Open the installed `/Applications/Wraith.app` for daily notes.
- In a terminal, run `pnpm app:dev` to bring up "Wraith Dev" alongside.
- They show as two distinct apps in the dock with different names.

## What an agent should change vs not change

### Edit normally

- `tauri.conf.json` — windowing, plugins, security, bundle config, version
  bumps before release. Both dev and release build inherit these changes.

### Almost never edit

- `tauri.conf.dev.json` — should stay as a tiny override file with only
  `productName` and `identifier`. If you add other fields here you fragment
  the config and have to remember to keep both in sync. Only add a field
  to the dev override if it genuinely needs to differ between dev and
  release.

### Never edit by hand for normal work

- The `--config src-tauri/tauri.conf.dev.json` flag in the
  `tauri:dev` script in `apps/desktop/package.json`. That flag is the
  whole mechanism — removing it collapses dev and release to the same
  identifier, which trashes the isolation.
- The `pnpm --filter desktop run tauri:*` plumbing in the root
  `package.json`. It's just an alias.

## Why this matters

Without the split:
- Dev and release share `com.wraith` → same Application Support folder.
- A schema-breaking dev experiment corrupts the prefs your daily app reads.
- The single-instance plugin (carried over from Writer) blocks running
  both at once — opening the dev build would just focus the installed
  daily release instead of starting a separate process.

With the split:
- Different identifiers → different state directories → independent.
- Different identifiers → single-instance plugin treats them as separate
  apps → they coexist.
- Easy to confirm at a glance which is which (dock label "Wraith" vs
  "Wraith Dev").

## Gotchas hit during V1 setup

These are real issues we already debugged. Documented so a future agent
session doesn't reintroduce them or re-debug from scratch.

### Vite path aliases break on paths containing a space

**Symptom:** `pnpm app:dev` starts, frontend errors flood in like
`Failed to resolve import "@/lib/paths"`. Window never opens.

**Cause:** Writer's original `vite.config.ts` resolved the `@` and
`@shared` aliases via `new URL("./src", import.meta.url).pathname`.
On paths containing a space (e.g. `Wraith Notes/`), `URL.pathname`
URL-encodes the space as `%20`, so the alias resolves to a directory
that doesn't exist on disk.

**Fix (already applied at `apps/desktop/vite.config.ts`):**

```ts
import { fileURLToPath } from "node:url";

resolve: {
  alias: {
    "@": fileURLToPath(new URL("./src", import.meta.url)),
    "@shared": fileURLToPath(new URL("./shared", import.meta.url)),
  },
},
```

Don't revert to `URL.pathname` even if a Writer upstream merge brings it
back. The fix is correct and would still work if the project ever moves
back to a space-free path.

### Vite+ pre-commit hook blocks every commit

**Symptom:** Any `git commit` (terminal or VS Code git UI) errors with
"VITE+ - The Unified Toolchain for the Web" and message
"Please add a staged config:".

**Cause:** Writer's root `package.json` had a `"prepare": "vp config"`
script. `pnpm install` runs `prepare`, which sets `core.hooksPath` to
`.vite-hooks/_` and installs a pre-commit hook running `vp staged`. That
in turn requires a `vp staged` config Wraith doesn't have.

**Fix (already applied):**

- The `prepare` script was removed from `wraith_app/package.json`.
- `core.hooksPath` was unset via `git config --unset core.hooksPath`.

**If you ever want it back:** `pnpm exec vp config` re-installs the hook,
but you must also configure `vp staged` first (Vite+ docs) so the hook
script doesn't error out and block commits.

**Note:** the `.vite-hooks/` directory is still in the repo (came from
Writer). It's harmless dead weight as long as `core.hooksPath` is unset.

## Future work

- A pre-release sanity check script that verifies `tauri.conf.json` has
  `com.wraith` (not `com.wraith.dev`) and a non-`*-dev` version before
  letting `app:build` run, to prevent accidental wrong-config releases.
- CI signing / notarization for shipping Wraith publicly. Writer's
  `scripts/distribute.sh` already does this; it's set up for the writer-computer
  Apple Developer account and would need to be re-pointed at a Wraith account
  if/when that exists.
- Per-environment secrets/env files if Wraith ever needs them (currently
  doesn't).
