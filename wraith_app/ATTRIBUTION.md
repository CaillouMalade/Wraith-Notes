# Attribution

Wraith is derived from **Writer Computer** by Joel Boquez (`joelbqz/writer-computer`),
licensed under the GNU General Public License v3.0.

The full license text is preserved in [LICENSE](./LICENSE). Wraith is distributed
under the same GPL-3.0 license.

## What was taken

The Writer Computer codebase as of the snapshot in `../writer_source_code/` was
copied in full and used as the starting baseline for Wraith. This includes the
Tauri v2 desktop shell, the React/TypeScript frontend, the Rust backend
(commands, watcher, workspace state), and the build/release scripts.

## What was changed

For the V0 rebrand, only product identifiers were modified:

- App and product name: Writer → Wraith
- Bundle identifier: `com.writer-computer` → `com.wraith`
- Window title and macOS menu bar label
- Auto-updater plugin removed (Wraith has no release pipeline yet)

Internal module/crate names, the `writer` CLI dispatch, and Writer's own
project docs were intentionally **not** renamed in V0. They remain as
historical/internal references and can be cleaned up incrementally as Wraith
diverges.

## Upstream

For the unmodified original, see `../writer_source_code/` in this repo, or
the upstream project at https://github.com/joelbqz/writer-computer.
