---
name: agent-dogfeed
description: Dogfood a feature, product, CLI, skill, or code change by running a fresh isolated agent against it and mining the transcript — agent-env/agent-box build the environment, lac reads what the agent actually experienced. Use when you want to know how an agent behaves with something, whether a fresh agent can operate a tool after a change, or what friction a skill/CLI/doc creates.
---

# Agent Dogfeed

Dogfeeding is watching a fresh agent use the real thing. The transcript is
the product feedback; the agent's self-report is not — verify outcomes from
output, exit codes, files, or external state.

## The loop

1. Build or link the real thing the agent should use — not a mock.
2. Pick the environment:
   - `agent-env` for an isolated agent (fresh auth-seeded Claude/Codex
     session, hand-picked skills, optional Docker sandbox).
   - `agent-box` when the test also needs its own copy of a codebase, dev
     server, or test run.
3. Write the raw prompt yourself — short enough that the agent has room to
   interpret; what it misunderstands is data.
4. Run the agent:

   ```bash
   agent-env probe claude --repo <path> --skill <name> --prompt '<raw prompt>'   # one-shot run
   agent-env probe codex --repo <path> --prompt '<raw prompt>'
   agent-env up claude --repo <path>    # interactive session you drive
   ```

   Probe with whichever CLI the target actually serves; if it serves both,
   probe both — claude and codex fail differently. Spawning a subagent from
   your own session also works for parallel runs, but it inherits your
   context; use agent-env when the test needs a cold start.
5. Mine the transcript. Each probe saves its session JSONL to a temp dir
   and prints the path on stderr:

   ```bash
   lac <dir>/*.jsonl                      # digest: timeline, tool ledger, errors, token growth
   lac view <file> --event <id>           # expand an omitted span
   ```
6. Hunt experience failures: wrong commands/cwd, confusion loops, missing
   or misleading progress, unclear IDs, bad errors/exit codes, unproven
   claims, hidden state coupling, side effects, harness-only success.
7. Fix the program, docs, or skill — then re-run the smallest probe that
   proves the fix.

Report findings as agent-experience observations ("the agent retried three
times because the error never named the flag"), not just a bug list — the
point is understanding behavior.
