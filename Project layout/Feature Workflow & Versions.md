---
type: project
status: active
Belongs to: "[[Wraith]]"
---

# Feature Workflow & Versions

Single source of truth for: how to add a feature, when to ship a version,
what each version contains. Companion to [[Wraith]] (vision),
[[Dev vs Release Builds]] (build mechanics), [[V0 Setup Log]] (rebrand history).

## Version tracker

| Version | State | Contents | Tag |
|---|---|---|---|
| V1 (`1.0.0`) | **Shipped** — installed at `/Applications/Wraith.app` | Writer Computer source, rebranded as Wraith, updater removed, dev/release config split. Plus two bug fixes: vite alias resolution for paths with spaces, and disabling Vite+'s pre-commit hook that blocks all commits without a `vp staged` config. Functionally equivalent to Writer at the moment Writer was forked. | `v1.0.0` |
| V2 (`2.0.0`) | **Shipped** — current daily release | Daily-app compatibility/shell pass: shared vault resolver, image/PDF asset visibility and preview tabs, Obsidian image/PDF embeds, callouts, frontmatter wikilink chips, KaTeX math, configurable shortcuts, right sidebar Agent/Terminal/Git/Properties/Outline surfaces, split center view, Git automation, and V2 ship fixes. See [[V2 Release Log]]. | `v2.0.0` |
| V3+ | Planned cleanup/stabilization | V2 deferrals and polish: reliable note-body image/PDF drag/drop, split-tab UX polish, source/docs cleanup, and whichever next roadmap slice Arthur chooses. | — |

V2 was built in a one-shot release worktree and tagged there first. On
2026-05-09, active `wraith_app/main` was fast-forwarded to `v2.0.0` and the
release worktree was removed, so `wraith_app/` is the single working tree
and `v2.0.0` is the V2 baseline.

## What's currently in the repo vs installed

The two are independent on purpose:

- **Installed app at `/Applications/Wraith.app`** = the current daily release
  binary. As of V2, the source tag is `v2.0.0`; replacing the app requires a
  fresh `pnpm app:build` and install from the generated bundle.
- **Source tree at `wraith_app/`** = the active Wraith codebase. It should
  match the current shipped tag plus any intentional post-release fixes. Run
  via `pnpm app:dev` for the dev build, which has isolated state at
  `~/Library/Application Support/com.wraith.dev/`.

## Per-version setup logs

Each shipped version gets a setup log under `Project layout/` that records
everything that changed in the source for that release. The current one:

- [[V0 Setup Log]] — rebrand work; retroactively V1's setup/release log.
- [[V2 Release Log]] — the shipped V2 daily-app pass and explicit V3
  deferrals.

## Per-feature workflow

For each feature you want to add (between releases), repeat this loop:

### 1. Decide and write it down

For non-trivial features, write a short spec at `wraith_app/SPECs/<feature>.md`
before coding. (Writer's repo already uses this pattern, see existing files
there for examples.) Doesn't need to be long — the goal is to think through
the behavior, edge cases, and what "done" looks like before you touch code.

For a one-line bug fix or a tweak, skip the spec and go straight to step 2.

### 2. Implement

Edit code in `wraith_app/`. The frontend lives in `apps/desktop/src/`,
the Rust backend in `apps/desktop/src-tauri/src/`. See
`wraith_app/CLAUDE.md` (inherited from Writer) for the architectural map
that still applies post-rebrand.

### 3. Test as you go

In a terminal at `wraith_app/`:

```bash
pnpm app:dev
```

The "Wraith Dev" window opens. Frontend changes hot-reload; Rust changes
trigger a recompile-on-save (a few seconds). Click around and verify
behavior. This is the dev build — its state lives at
`~/Library/Application Support/com.wraith.dev/`, totally isolated from
your daily release install.

For automated checks (run before committing):

```bash
pnpm --filter desktop run build              # TypeScript type check
cd apps/desktop/src-tauri && cargo test      # Rust tests
cd apps/desktop/src-tauri && cargo clippy    # Rust lints
```

### 4. Commit

One commit per feature is the right granularity. Short, imperative subject;
body explains the why if non-obvious:

```bash
git add <changed files>
git commit -m "Render Obsidian callouts as styled blocks"
```

Don't squash unrelated changes into one commit — future-you will want to
read history one feature at a time, not as soup.

### 5. Repeat until you have enough for a release

Several features → time to ship a new version. Move to the release workflow.

## Release workflow

### When to bump a version

- **Bump major** (`1.0.0` → `2.0.0`) when shipping a meaningful new
  capability or batch of changes that you want to mark as a new "release"
  for daily use. For Wraith as a personal tool, this is the only kind of
  bump that really matters.
- **Bump minor** (`2.0.0` → `2.1.0`) only if you want a smaller mid-cycle
  release between major versions. Optional.
- **Bump patch** (`2.1.0` → `2.1.1`) only for an emergency bug-fix
  release. Optional.

For a solo project where you're just maintaining your own daily app, plain
major bumps (V1 → V2 → V3) are fine. Don't fuss over semver until you have
external users.

### Steps to ship

1. **Decide the new version number** (e.g. you've finished the V2 compat
   features → ship `2.0.0`).
2. **Bump version in `wraith_app/apps/desktop/src-tauri/tauri.conf.json`.**
3. **Update [[Feature Workflow & Versions]]** (this file): mark the row
   for the about-to-ship version with what's in it.
4. **Create the per-version release log**: copy the structure of
   [[V0 Setup Log]] into a new `Project layout/V<N> Release Log.md`
   listing the features and changes that landed in this version.
5. **Commit those doc updates.**
6. **Build:**
   ```bash
   cd "/Users/arthurbrourhant/Vaults/Wraith Notes/wraith_app"
   pnpm app:build
   ```
7. **Install:** open the DMG at
   `apps/desktop/src-tauri/target/release/bundle/dmg/Wraith_<version>_aarch64.dmg`,
   drag `Wraith.app` over the existing one in `/Applications/`.
   Right-click → Open the first time after replacing.
8. **Tag the release in git:**
   ```bash
   git tag v<version>
   ```
   For V1: `git tag v1.0.0`. The tag points at the exact commit that
   produced the binary. Lets you later run `git checkout v1.0.0` to see
   the V1 source, or `git diff v1.0.0..v2.0.0` to see what changed.

   No need to push tags anywhere unless/until Wraith has a remote. Local
   tags work fine for solo use.

## Git practices for this project

Solo project, single machine, optimize for clarity over ceremony.

- **One commit per feature** on `main`. No branches needed for a solo
  project. If a feature is risky, commit smaller WIP commits on `main`
  and clean them up later if you care.
- **Tag at every release** (`v1.0.0`, `v2.0.0`, …). This is the one
  practice that genuinely pays back — you can always answer "what was in
  V1?" by running `git show v1.0.0` or `git diff v1.0.0..HEAD`.
- **Never amend or force-push** commits that are tagged. The tag becomes
  a lie if the commit it points to changes.
- Don't bother with conventional-commit prefixes (`feat:`, `fix:`, etc.)
  unless you find yourself wanting them. They're optimized for tooling
  you don't have.

## V1 close-out (done 2026-05-08)

Recorded for posterity:

1. Rebrand work committed: `de235a8 Add Wraith V1 baseline`.
2. Two follow-up fixes committed: `eaae7eb Fix vite alias resolution on paths with spaces; disable Vite+ git hooks`.
3. Built V1 with `pnpm app:build` from `wraith_app/`.
4. Installed `Wraith.app` from the resulting DMG to `/Applications/`.
5. Tagged the V1 source: `git tag v1.0.0` on commit `eaae7eb`.

The next time you need to ship a release, follow the [Steps to ship](#steps-to-ship)
above instead of this section. This subsection just records the V1 close-out.

## V2 close-out (done 2026-05-09)

Recorded for posterity:

1. V2 implementation committed and tagged: `c557794 Release Wraith v2.0.0`.
2. The release tag is `v2.0.0`.
3. Active `wraith_app/main` was fast-forwarded to the V2 tag after the
   one-shot release worktree shipped it; that worktree has since been
   removed so `wraith_app/` is the single working tree.
4. `apps/desktop/package.json` and `apps/desktop/src-tauri/tauri.conf.json`
   both record `2.0.0`.
5. See [[V2 Release Log]] for shipped contents and known V3 deferrals.
