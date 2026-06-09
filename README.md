# agent-dogfeed

An agent skill and CLI for dogfooding agent-facing CLIs, tools, and skills through a fresh Codex or Claude Code subagent.

`agent-dogfeed` is for questions such as:

- Can a fresh agent correctly operate this CLI after a change?
- Does a long-running command expose enough progress for an agent to wait correctly?
- Does a skill lead another agent through the intended real workflow?
- What mistakes show up in the transcript after an agent uses the program?

## Skill

The skill source is:

```txt
skills/agent-dogfeed/SKILL.md
```

It keeps the dogfeed loop small: write a raw prompt, run an isolated fresh
agent, read the transcript, and fix what the run exposes.

## CLI

The package exposes an `agent-dogfeed` CLI:

```bash
agent-dogfeed --help
```

Generate a fresh probe command from a raw prompt:

```bash
agent-dogfeed codex --repo /absolute/path/to/repo --prompt '<raw prompt>'
agent-dogfeed claude --repo /absolute/path/to/repo --prompt '<raw prompt>'
```

Both subcommands print the probe command for review. They do not rewrite or
template the prompt.

Codex probes are isolated by default. The generated command creates a temporary
auth-only `CODEX_HOME`, exports it for the child process, and runs with
`--ignore-user-config`, `--ignore-rules`, and
`--dangerously-bypass-approvals-and-sandbox`. Your user skills, plugins, rules,
config, and session state are not inherited. The OS sandbox is bypassed because
it blocks keychain lookups (for example `security find-generic-password`),
which breaks dogfeeding any tool whose auth self-repair reads the keychain.

Codex also discovers skills from `$HOME/.agents/skills`, which neither
`CODEX_HOME` nor `--ignore-user-config` covers. To keep the probe fresh, the
generated command runs codex under an overlay home — a temp directory that
symlinks every top-level `$HOME` entry except `.agents`, `.claude`, `.codex`,
and `.pi` — so keychain (`~/Library`), `gh`, ssh, and git state stay available
while cross-agent skills do not leak in. Codex's own bundled `.system` skills
(imagegen, skill-creator, ...) still load; a genuinely fresh codex install has
those too.

Claude probes are isolated by default. The generated command creates a
temporary `CLAUDE_CONFIG_DIR` seeded with one file: your OAuth credential
copied from the macOS keychain into `.credentials.json` (Claude Code only
serves the keychain credential to the default config dir) and runs `claude -p`
with `--strict-mcp-config` and `--permission-mode bypassPermissions`. The probe
emits its full transcript as stream-json so the parent agent can read every
tool call, not just the final claim.

Both isolated probes save the probe's session JSONL out of the temporary home
before it is removed, into a stable temp dir printed on stderr:

```txt
agent-dogfeed: probe session saved in <dir>
```

Feed that file to a transcript reader such as
[`lac`](https://github.com/sshkeda/lossless-agent-context) to mine the run —
tool calls, errors, token growth — instead of re-reading raw stream-json.

Neither probe runs in an OS sandbox: probes can run any command and write
anywhere, so point them at disposable repos or worktrees when the prompt can
mutate state.

When the probe needs a skill, link only that skill into the isolated state:

```bash
agent-dogfeed codex --repo /absolute/path/to/repo --skill agent-cli --prompt '<raw prompt>'
agent-dogfeed claude --repo /absolute/path/to/repo --skill agent-cli --prompt '<raw prompt>'
```

Use `--user-codex`/`--user-claude` only when intentionally testing inherited
user config or tools.

## Terminal Evidence

For non-interactive CLI output-channel and ordering checks, use the bundled capture harness:

```bash
agent-dogfeed capture --output /tmp/agent-dogfeed-proof.jsonl -- <command> [args...]
```

The harness records stdout/stderr chunks and process exit as JSONL. The parent
validator should read the proof file directly and remove it after reporting. It
is not appropriate for behavior that depends on a TTY.

The bundled fixture provides a harmless self-test:

```bash
agent-dogfeed capture --output /tmp/agent-dogfeed-proof.jsonl -- skills/agent-dogfeed/scripts/terminal-contract-fixture.sh
```

## Development

Run the smoke test:

```bash
npm test
```

The test runs the bundled fixture through the capture harness and verifies the recorded process exit.

CI runs the same smoke test on every push and pull request.

## License

MIT
