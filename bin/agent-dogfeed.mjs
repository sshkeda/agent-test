#!/usr/bin/env node

import { runCaptureTerminalCli } from "../lib/capture-terminal.mjs";
import {
  buildClaudePrintArgs,
  buildCodexExecArgs,
  renderClaudeShellCommand,
  renderIsolatedClaudeShellCommand,
  renderIsolatedCodexShellCommand,
  renderShellCommand,
} from "../lib/probes.mjs";

const argv = process.argv.slice(2);
const command = argv[0];
const programName = "agent-dogfeed";

const probeSpecs = {
  codex: {
    defaultModel: "gpt-5.4-mini",
    userFlagKey: "user_codex",
    blankFlagKey: "blank_codex",
    render(options) {
      const args = buildCodexExecArgs({
        repo: options.repo,
        model: options.model,
        prompt: options.prompt,
        isolated: options.isolated,
      });

      return options.isolated
        ? renderIsolatedCodexShellCommand(args, options.skills)
        : renderShellCommand("codex", args);
    },
  },
  claude: {
    defaultModel: "haiku",
    userFlagKey: "user_claude",
    blankFlagKey: "blank_claude",
    render(options) {
      const args = buildClaudePrintArgs({
        model: options.model,
        prompt: options.prompt,
        isolated: options.isolated,
      });

      return options.isolated
        ? renderIsolatedClaudeShellCommand(options.repo, args, options.skills)
        : renderClaudeShellCommand(options.repo, args);
    },
  },
};

switch (command) {
  case "capture": {
    process.exitCode = await runCaptureTerminalCli(argv.slice(1), {
      programName: "agent-dogfeed capture",
    });
    break;
  }

  case "codex":
  case "claude": {
    process.exitCode = await runProbe(argv.slice(1), probeSpecs[command]);
    break;
  }

  case "help":
  case "--help":
  case "-h":
  case undefined: {
    process.stdout.write(usage());
    process.exitCode = command ? 0 : 2;
    break;
  }

  default: {
    process.stderr.write(usage());
    process.exitCode = 2;
  }
}

async function runProbe(args, spec) {
  const parsed = parseOptions(args, spec);

  if (parsed.error) {
    process.stderr.write(`${parsed.error}\n\n${usage()}`);
    return 2;
  }

  const { options } = parsed;
  if (!options.repo) {
    process.stderr.write(`missing required --repo\n\n${usage()}`);
    return 2;
  }

  if (!options.prompt) {
    process.stderr.write(`missing required --prompt\n\n${usage()}`);
    return 2;
  }

  process.stdout.write(`${spec.render(options)}\n`);
  return 0;
}

function parseOptions(args, { defaultModel, userFlagKey, blankFlagKey }) {
  const allowedOptions = new Set([
    "model",
    "prompt",
    "repo",
    "skill",
  ]);
  const options = {
    isolated: true,
    model: defaultModel,
    skills: [],
  };

  for (let index = 0; index < args.length; index += 1) {
    const arg = args[index];

    if (!arg.startsWith("--")) {
      return { error: `unexpected argument: ${arg}` };
    }

    const key = arg.slice(2).replaceAll("-", "_");
    if (key === userFlagKey) {
      options.isolated = false;
      continue;
    }
    if (key === blankFlagKey) {
      options.isolated = true;
      continue;
    }

    if (!allowedOptions.has(key)) {
      return { error: `unknown option: ${arg}` };
    }

    const next = args[index + 1];
    if (!next || next.startsWith("--")) {
      return { error: `missing value for ${arg}` };
    }
    if (key === "skill") {
      if (!isValidSkillValue(next)) {
        return { error: `invalid --skill value: ${next}` };
      }
      options.skills.push(next);
    } else {
      options[key] = next;
    }
    index += 1;
  }

  return { options };
}

function isValidSkillValue(value) {
  return value.includes("/") || value.startsWith(".") || /^[A-Za-z0-9._-]+$/.test(value);
}

function usage() {
  return `usage:
  ${programName} capture [--output <path>] -- <command> [args...]
  ${programName} codex --repo <path> --prompt <raw-prompt> [--model <model>] [--skill <name-or-path>] [--user-codex]
  ${programName} claude --repo <path> --prompt <raw-prompt> [--model <model>] [--skill <name-or-path>] [--user-claude]

codex and claude print the probe command for review without rewriting the prompt.
codex probes are isolated by default: a temporary auth-only CODEX_HOME,
--ignore-user-config, --ignore-rules, --ephemeral, and
--dangerously-bypass-approvals-and-sandbox (no OS sandbox, so keychain access
works for tools that need it).
claude probes are isolated by default: a temporary CLAUDE_CONFIG_DIR seeded
only with your keychain OAuth credential (.credentials.json),
--no-session-persistence, --strict-mcp-config, and --permission-mode
bypassPermissions. claude probes emit the full transcript as stream-json on
stdout.
Neither probe is OS-sandboxed: point probes at disposable repos or worktrees
when the prompt can mutate state.
Use --skill for each required skill to link into the isolated home.
Use --user-codex/--user-claude only when intentionally testing inherited user
config/tools.
`;
}
