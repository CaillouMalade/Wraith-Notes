> Status, 2026-05-09: historical Hermes V2 one-shot brief.
>
> This prompt produced the `experiment/hermes-v2-one-shot` worktree and the
> `v2.0.0` release tag. It is no longer current operating guidance for normal
> Wraith work. Active Wraith source is `wraith_app/`, now aligned with
> `v2.0.0`; current guidance lives in `AGENTS.md`, `wraith_app/AGENTS.md`,
> [[Feature Workflow & Versions]], and [[V2 Release Log]].
>
> Original brief preserved below for context.

You are working in an isolated experimental worktree/repo for Wraith. This is a throwaway branch/copy, so be ambitious and autonomous. Build as much of the Wraith roadmap as you can in one long pass.
    
    Do not ask for clarification unless completely blocked. Inspect, decide, implement, test, and summarize.
    
    Start by reading:
    - AGENTS.md
    - SPECs/v2-obsidian-tolaria-compatibility-roadmap.md
    - package.json
    - apps/desktop/package.json
    - relevant frontend source under apps/desktop/src
    - relevant Tauri/Rust source under apps/desktop/src-tauri/src
    
    Workspace context:
    - This repo/worktree is the active Wraith app source.
    - Wraith is a local-first Tauri v2 / React / TypeScript / Rust Markdown vault app forked from Writer Computer.
    - Core principle: files first, app second.
    - Markdown files, local assets, and YAML frontmatter are the source of truth.
    - The editor should remain one predictable editing surface.
    - Avoid hidden editor/viewer swaps, confusing global raw/preview modes, or behavior where the user cannot tell whether they are editing source.
    - Inline enhancements are good when they reduce friction and preserve direct Markdown editability.
    - Preserve the current Wraith visual/design language as much as possible.
    - V1 look/feel is the design anchor.
    
    Reference context:
    - If available from this repo/worktree’s parent directory, these are reference-only:
      - ../writer_source_code
      - ../tolaria_source_code_ref_only
    - Tolaria is the most important feature reference for Wraith’s future direction.
    - Inspect Tolaria freely for behavior, structure, and implementation ideas.
    - Do not edit reference trees.
    - Adapt ideas to Wraith’s architecture rather than blindly porting.
    
    Repo structure:
    - Frontend app: apps/desktop/src
      - React / TypeScript
      - components in apps/desktop/src/components
      - shared utilities/hooks/stores under apps/desktop/src/lib, apps/desktop/src/hooks, etc.
    - Tauri backend: apps/desktop/src-tauri/src
      - Rust commands, workspace state, filesystem/path handling, shell/CLI integration
    - Specs: SPECs
    - Existing docs may still mention Writer; treat AGENTS.md and SPECs as more authoritative for Wraith.
    
    Big product direction:
    Make Wraith Arthur’s daily local vault app:
    - fast folder-first Markdown workspace
    - reliable local files as source of truth
    - strong Markdown/media/file handling
    - useful Tolaria-style compatibility where it helps real vault usage
    - eventually right-sidebar AI/terminal/chat workflows
    - eventually sync/Git/publishing behavior inspired by Tolaria
    
    Roadmap themes to pursue:
    - shared vault path/link/asset resolver
    - Markdown image rendering
    - Tolaria/Obsidian-style image/file embeds
    - local asset visibility/opening in the file browser
    - PDF/image opening or viewing
    - drag/drop file import into notes and folders
    - frontmatter/YAML link/property display
    - LaTeX/math rendering
    - hotkey improvements
    - right sidebar / split pane shell
    - AI sidepanel/terminal/chat architecture inspired by Tolaria
    - Git/sync/publishing if practical
    
    Non-goal vibes:
    - Do not turn Wraith into a database app.
    - Do not make Markdown/frontmatter non-authoritative.
    - Do not redesign the whole product away from the current Wraith feel.
    - Do not make mobile/web/localhost experiments the center of this pass unless they fall out naturally.
    
    Work style:
    - Inspect before editing.
    - Prefer coherent architecture over hacks, but this is an experimental branch, so make progress.
    - It is okay to make broad changes if they serve the roadmap.
    - It is okay to leave partial work clearly marked.
    - Add tests/fixtures where useful.
    - Commit if you reach coherent checkpoints.
    - Keep going until you have made substantial end-to-end progress or hit a real blocker.
    
    Useful commands:
    - pnpm --filter desktop run build
    - pnpm app:dev
    - pnpm app:build
    - cd apps/desktop/src-tauri && cargo test
    - cd apps/desktop/src-tauri && cargo clippy
    - cd apps/desktop/src-tauri && cargo fmt --check
    
    At the end:
    - summarize what you built
    - list important changed files
    - list checks run and results
    - list incomplete/known-broken areas
    - suggest the next human review steps
    
    Strict interdiction to do anything outside of this repo wraith_app_hermes_v2_one_shot or to use git actions


    don't stop until the source code is fully ready. do not compile or what. when source code is ready give me the instructions to run the dev server to check everything
