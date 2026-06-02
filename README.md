# agent-test

An agent skill for forward-testing agent-facing CLIs, tools, and skills through a fresh Codex subagent.

`agent-test` is for questions such as:

- Can a fresh agent correctly operate this CLI after a change?
- Does a long-running command expose enough progress for an agent to wait correctly?
- Does a skill lead another agent through the intended real workflow?
- Are stdout, stderr, exit state, and generated evidence sufficient to prove behavior?

## Skill

The skill source is:

```txt
skills/agent-test/SKILL.md
```

It requires evidence-driven probes:

- run real installed or linked targets where possible;
- keep live/costly invocations to one by default;
- use a fresh Codex subagent rather than inherited diagnosis;
- treat terminal output, logs, IDs, files, and exit status as proof;
- do not treat a subagent final answer as proof when direct evidence is missing.

## Terminal Evidence

For non-interactive CLI output-channel and ordering checks, use the bundled capture harness:

```bash
node skills/agent-test/scripts/capture-terminal.mjs --output /tmp/agent-test-proof.jsonl -- <command> [args...]
```

The harness records stdout/stderr chunks and process exit as JSONL. The parent validator should read the proof file directly and remove it after reporting. It is not appropriate for behavior that depends on a TTY.

The bundled fixture provides a harmless self-test:

```bash
node skills/agent-test/scripts/capture-terminal.mjs --output /tmp/agent-test-proof.jsonl -- skills/agent-test/scripts/terminal-contract-fixture.sh
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
