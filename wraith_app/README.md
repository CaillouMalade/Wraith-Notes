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
- `docs/` — inherited Writer developer docs plus reference material.
- `SPECs/` — Wraith specs and inherited Writer feature notes.

## Development

Install dependencies from the repo root:

```bash
pnpm install
```

Use the native Tauri dev loop for real app behavior:

```bash
pnpm app:dev
```

`pnpm dev` is frontend/Vite only and does not launch the native Wraith window.

## Validation

```bash
pnpm --filter desktop run build
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
