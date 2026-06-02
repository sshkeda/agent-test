---
name: agent-test
description: Use when validating an agent-facing CLI, tool, or skill by launching a fresh Codex subagent to exercise the real behavior and report observable evidence such as progress events, logs, stdout/stderr separation, identifiers, side effects, and exit behavior. Trigger on forward-testing a skill, testing whether another agent can use a CLI, or checking whether agent-visible diagnostics are sufficient.
---

# Agent Test

Forward-test a capability through a fresh Codex session. The subagent should behave like an actual consumer of the CLI or skill, while the parent agent judges concrete observations rather than prose confidence.

## Core Rules

- Test the real installed or linked capability after building it, unless the user explicitly wants a mock.
- Start a fresh Codex subagent/session for the probe; do not let the testing agent inherit this session's diagnosis.
- Give the subagent a narrow task, success evidence, and stop rules. Do not preload the intended conclusion.
- Require one invocation for a live or costly command unless retries are the behavior under test.
- Keep the tested command in the foreground. An underlying remote job may be asynchronous, but the testing agent must observe the terminal process through exit.
- Treat output, exit status, IDs, logs, generated files, and external state as evidence. Treat the subagent's summary as a report to verify.
- Avoid secrets in prompts and relayed output. Redact authentication state, tokens, and cookies.

## Workflow

### 1. Define The Probe

Before spawning Codex, state:

- the capability under test, including the skill name or executable;
- the observable claim, such as "progress makes a long-running request distinguishable from a hang";
- the minimum real action needed to test it;
- what evidence must be returned: commands, phases/statuses, IDs if relevant, stdout/stderr behavior, exit code, and intervention or side effects.

Build, link, or install the target first when the subagent must consume generated or globally linked output. Do not ask the subagent to unknowingly test stale artifacts.

Invoke a real target executable directly whenever possible. Do not build synthetic lifecycle fixtures out of nested inline shell quoting; quoting failures invalidate the evidence. To smoke-test this skill's own foreground/ordering workflow from this skill directory, use:

```bash
scripts/terminal-contract-fixture.sh
```

For a non-interactive CLI contract involving stdout/stderr ordering, run the real target once through the capture harness from this skill directory so the validating transcript includes explicit stream-tagged evidence:

```bash
node scripts/capture-terminal.mjs --output /tmp/agent-test-proof.jsonl -- <target-command> [args...]
```

After the subagent completes, the parent validator must read the evidence file directly and judge those records. Reading the artifact is not a second target invocation. Delete the temporary evidence after reporting, and do not use this artifact path for secret-bearing output unless its handling is appropriate.

The harness does not provide a TTY. Do not use it as proof for commands whose behavior depends on an interactive terminal.

### 2. Launch A Fresh Agent

Use the environment's native fresh-subagent tool when the test is primarily whether a skill leads an agent to the correct action. Require the subagent to return the exact command and observed evidence.

Prefer `codex exec` when testing terminal ordering, streaming/progress, output channels, or process exit behavior, because its child transcript is visible directly to the validating agent. Use an explicit model, fresh ephemeral session, and the target repository as its working directory:

```bash
codex exec -m gpt-5.4-mini --ephemeral --color never -C /absolute/path/to/repo '<probe prompt>'
```

Choose the narrowest sandbox/permission mode that allows the probe. Use unrestricted execution only when the capability genuinely needs it and the command has been scoped to an acceptable side effect.

When a Codex tester itself needs to launch nested `codex exec`, its sandbox must permit Codex runtime/app-server initialization. If the nested launcher fails before the target command begins, report a launcher-precondition failure rather than judging the target contract. Re-run from the controlling agent directly or with the minimum outer permission mode that permits the nested launch.

Prompt requirements for a CLI test:

```txt
Test the installed <cli> terminal contract without editing files.
Run exactly one live command: <command>.
Observe its terminal output until the command exits.
Do not launch duplicates, send EOF, or interrupt it unless the stated failure condition occurs.
Report the exact observable progress/status evidence, stdout answer text, IDs if displayed before completion, exit result, and whether intervention was required.
```

Prompt requirements for a skill test:

```txt
Use $<skill> to perform <small realistic task>.
Follow the skill as an ordinary user-facing agent would.
Do not inspect the skill source unless the task itself requires debugging the instructions.
Report the actions taken, observable result, failures/confusion, and evidence supporting the result.
```

Keep the prompt neutral. It may name the contract being checked, but it should not tell the subagent which bug to find or which verdict to return.

### 3. Run And Observe

Run or await the fresh Codex subagent in the foreground and wait for completion. Preserve its raw terminal transcript when the claim depends on ordering or lifecycle events. If a native subagent reports evidence without exposing the underlying transcript, label that evidence as subagent-reported and re-run through `codex exec` before claiming a terminal contract is proven.

For terminal claims, require the evidence to appear in a direct tool-result block or persisted raw output read by the validating parent. A subagent final answer is prose, even when it copies JSON records, and is not proof by itself. Prefer `capture-terminal.mjs --output <private-temp-path>` for pipe-based CLIs so the parent can read stdout/stderr chunks and exit status directly. If a subagent summary names a lifecycle line that is absent from, or contradicts, direct evidence, mark the result inconclusive and report the discrepancy instead of passing it.

For a terminal contract, check:

- whether progress appears while work is pending;
- whether progress represents code-owned state rather than partial model prose;
- whether identifiers appear at the point needed for diagnosis;
- whether final result text stays on its documented output channel;
- whether `done` is followed by normal exit;
- whether the agent avoided unnecessary retries, interrupts, or EOF.

For a skill contract, check:

- whether the skill triggered for the intended request;
- whether the agent chose the expected real tool/path;
- whether the skill prevented known unsafe or misleading behavior;
- whether the returned evidence proves the task occurred.

### 4. Report The Result

Report:

1. The launcher, tested model, skill/CLI, date, and exact command or task scope.
2. The relevant observable transcript facts.
3. Pass/fail against the predeclared claim.
4. Any remaining uncertainty or next improvement, separated from observed proof.

Do not call a capability validated merely because the subagent said it worked. The validating evidence must be present in the transcript, files, logs, exit status, or observable state.

Do not call a target capability broken merely because the fresh-agent launcher could not initialize. Separate launcher failure from target execution failure.

## Bundled Fixture

- `scripts/terminal-contract-fixture.sh` is only for validating this skill or its launcher path. It emits deterministic progress on stderr, final output on stdout, and exits normally. Do not substitute it for a real CLI probe when the target capability is available.
- `scripts/capture-terminal.mjs` runs one non-interactive target command and renders each stdout/stderr chunk plus final exit as JSONL evidence; with `--output`, it also persists that evidence for the parent validator to read directly. Use it for pipe-based CLI channel/order claims, not TTY-specific behavior.

## When Not To Use It

Do not spawn a subagent for ordinary unit tests, static review, or a trivial local command when fresh-agent behavior is not part of the question. Use normal test tooling for implementation correctness; use this skill when agent usability or instruction-following is the behavior under test.
