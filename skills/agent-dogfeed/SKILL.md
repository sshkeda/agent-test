---
name: agent-dogfeed
description: SUPERSEDED by the agent-env skill — use agent-env for isolated fresh-agent probes, interactive isolated sessions, and terminal capture. The agent-dogfeed binary still works and delegates to agent-env.
---

# Agent Dogfeed (superseded)

This skill is superseded by **agent-env**. Use the agent-env skill instead.

The old commands still work and delegate:

| old | new |
| --- | --- |
| `agent-dogfeed codex --repo X --prompt P` | `agent-env probe codex --repo X --prompt P` |
| `agent-dogfeed claude --repo X --prompt P` | `agent-env probe claude --repo X --prompt P` |
| `agent-dogfeed capture -- cmd` | `agent-env capture -- cmd` |
| `--user-codex` / `--user-claude` | `--user` |
| (no equivalent) | `agent-env up <cli> --repo X` — interactive isolated session |
| (no equivalent) | `agent-env list`, `--env <name>` specs |

The dogfooding loop (build → probe with the real program → read transcript
with lac → fix → smallest re-probe) lives in the agent-env skill now.
