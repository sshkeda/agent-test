# agent-dogfeed

The dogfooding **methodology**: learn how agents actually experience a
feature, product, CLI, skill, or code change by running fresh isolated
agents against it and mining their transcripts.

agent-dogfeed is the orchestrator's playbook; it composes three tools:

- **[agent-env](../agent-env)** — the environment machinery: isolated,
  auth-seeded Claude/Codex sessions, per-session skills, Docker sandboxes.
- **agent-box** — isolated worktrees/boxed environments when the test needs
  its own copy of a codebase or dev server.
- **lac** — transcript mining: what the agent did, where it struggled,
  tool errors, token growth.

The loop: build the real thing → set up an isolated environment → spawn a
fresh subagent with a raw prompt → lac-mine the transcript → report
agent-experience findings → fix → smallest re-probe. The full playbook
lives in `skills/agent-dogfeed/SKILL.md`.

## CLI

The probe-rendering machinery lives in agent-env; the `agent-dogfeed`
binary is a thin delegate:

```bash
agent-dogfeed codex --repo <path> --prompt '<raw prompt>'   # -> agent-env probe codex ...
agent-dogfeed claude --repo <path> --prompt '<raw prompt>'  # -> agent-env probe claude ...
agent-dogfeed capture -- <command>                          # -> agent-env capture ...
```

Prefer calling `agent-env` directly.
