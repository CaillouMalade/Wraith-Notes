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
| V1 (`1.0.0`) | **Ready to build** (rebrand baseline) | Writer Computer source, rebranded as Wraith, updater removed, dev/release config split. Functionally equivalent to Writer at the moment Writer was forked. | `v1.0.0` (after first build) |
| V2 (`2.0.0`) | Planned — Obsidian/Tolaria compatibility layer | Obsidian callouts (`> [!important]`), `![[image.png]]` embeds, frontmatter wikilinks, old path-style link/embed resolution, image/PDF first-class browsing. See [[Wraith]] § "Observed gaps". | — |
| V3+ | TBD | Backlinks, saved views, semantic sidebar, agent sidebar, etc. (see [[Wraith]] § "Not V0"). | — |

When V2 ships, replace its row with the actual contents and add a V3 row.

## Per-version setup logs

Each shipped version gets a setup log under `Project layout/` that records
everything that changed in the source for that release. The current one:

- [[V0 Setup Log]] — rebrand work. This becomes V1's setup log when V1
  ships, since V1 is just the rebrand baseline. Future versions get their
  own: `V2 Release Log.md`, `V3 Release Log.md`, etc.

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
your daily V1 install.

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

## What to do *right now* (since V1 isn't tagged yet)

The rebrand work in this conversation is sitting uncommitted in
`wraith_app/`. To formally close out the V1 baseline:

1. From `Wraith Notes/` (the root, not `wraith_app/`):
   ```bash
   git add "Project layout/" wraith_app/
   git commit -m "Initial Wraith V1 baseline (rebrand from Writer)"
   ```
2. Verify the dev loop works at least once: `cd wraith_app && pnpm install && pnpm app:dev`. Quit when the window opens cleanly.
3. Build V1: `pnpm app:build` (the slow first compile).
4. Install the resulting `Wraith.app` into `/Applications/`.
5. Tag: `git tag v1.0.0`.

After that you have a real V1: source is committed, the tag exists, and
the binary is installed for daily use. Subsequent feature work on `main`
is V2 in progress.
