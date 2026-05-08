# Wraith

Wraith is a local-first desktop markdown editor for folders of plain-text notes,
docs, and personal wikis. It opens and operates on a Markdown vault on disk
without owning the storage layer.

Built with Tauri v2, React, Zustand, CodeMirror, and Rust.

## Origin

Wraith is forked from **Writer Computer** (GPL-3.0). See [ATTRIBUTION.md](./ATTRIBUTION.md)
for what was taken and what was changed. The unmodified Writer source is preserved
at `../writer_source_code/` in the parent repo for diff/reference.

## Repository

- `apps/desktop/` — Tauri desktop app.
- `apps/desktop/src/` — React frontend.
- `apps/desktop/src-tauri/src/` — Rust commands, workspace state, watcher, CLI integration.
- `apps/website/` — landing page (inherited from Writer; not actively used by Wraith yet).
- `docs/` — Writer's developer/agent workflow docs (kept as reference; will be migrated as Wraith diverges).
- `SPECs/` — Writer's feature specs and design notes.

## Development

This repo uses Vite+ through the `vp` CLI. Use `vp` instead of calling the package
manager or Vite tooling directly.

```bash
vp install
vp dev
```

## Validation

```bash
vp check
vp test
```

Rust validation runs from the Tauri crate:

```bash
cd apps/desktop/src-tauri
cargo test
cargo clippy
cargo fmt --check
```

## License

GPL-3.0, inherited from Writer Computer. See [LICENSE](./LICENSE).
