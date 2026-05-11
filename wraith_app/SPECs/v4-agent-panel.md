# V4 Agent Panel

## Status

First pass implemented. Remaining work is tracked below.

## Goal

Make Wraith's right-sidebar Agent panel useful for daily local-agent work
without turning it into a raw terminal transcript.

Tolaria's direction is the reference: permission mode is explicit, structured
agent events become chat UI, and noisy tool output is available but collapsed.

## First Pass

- Add an Agent permission mode setting: `safe` or `power_user`.
- Surface that mode directly in the Agent panel.
- Treat Codex and Claude Code as first-class profile IDs while keeping custom
  profiles available.
- Give Codex a mode-aware command template:
  - Safe: read-only sandbox with approval-oriented behavior.
  - Power User: workspace-write sandbox with non-interactive approval policy.
- Give Claude Code a mode-aware command template with vault file tools in Safe
  and Bash preapproved only in Power User.
- Parse Codex JSON stream events into readable assistant text and compact tool
  action rows instead of displaying every raw line.
- Keep raw output accessible as collapsed details for debugging.

## Implemented

- Added `agents.permission-mode` with Safe and Power User controls in the Agent
  panel.
- Updated built-in Codex and Claude Code command templates to expand according
  to the selected permission mode.
- Upgraded exact legacy Codex and Claude Code profile commands at runtime so
  existing settings do not trap Arthur in the old raw/sandboxed behavior.
- Show the expanded command before sending.
- Parse Codex JSON stream lines into assistant content and compact action rows.
- Collapse raw stream/debug output and stderr details by default.

## Later

- Add Claude Code stream-json parsing equivalent to the Codex event renderer.
- Add explicit agent availability checks and clearer missing-CLI states.
- Consider a Wraith MCP server only if the files-first vault model needs more
  than direct workspace access.
- Revisit true interactive approval only if Safe/Power User mode still leaves
  Codex or Claude Code blocked in real use.
