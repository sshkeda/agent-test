# agent-dogfeed (superseded by agent-env)

This repo is **superseded by [agent-env](../agent-env)** (`~/gh/agent-env`),
which owns isolated agent-CLI environments end to end: one-shot probes,
interactive sessions, terminal-contract capture, env specs, profiles,
binary patches, and the Docker sandbox.

What remains here:

- `bin/agent-dogfeed.mjs` — a compatibility shim. The old surface still
  works and delegates to `agent-env`:

  | old | new |
  | --- | --- |
  | `agent-dogfeed codex --repo X --prompt P` | `agent-env probe codex --repo X --prompt P` |
  | `agent-dogfeed claude --repo X --prompt P` | `agent-env probe claude --repo X --prompt P` |
  | `agent-dogfeed capture -- cmd` | `agent-env capture -- cmd` |
  | `--user-codex` / `--user-claude` | `--user` |

- `skills/agent-dogfeed/SKILL.md` — a pointer skill referring agents to the
  agent-env skill.

The probe machinery (isolated `CODEX_HOME` / `CLAUDE_CONFIG_DIR` auth
seeding, session-save traps, skill linking) lives in
`agent-env/lib/isolate.mjs` now.
