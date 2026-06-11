#!/usr/bin/env node

// agent-dogfeed is superseded by agent-env (github.com/sshkeda/agent-env's
// local repo at ~/gh/agent-env). This binary is a compatibility shim: it
// translates the old surface onto `agent-env` and delegates. The probe
// machinery (isolated CODEX_HOME / CLAUDE_CONFIG_DIR auth seeding) lives in
// agent-env/lib/isolate.mjs now.

import { spawn } from "node:child_process";

const argv = process.argv.slice(2);
const command = argv[0];

const translated = translate(command, argv.slice(1));
if (translated.error) {
  process.stderr.write(`${translated.error}\n${usage()}`);
  process.exitCode = 2;
} else {
  process.stderr.write(
    "agent-dogfeed: superseded by agent-env — delegating (use `agent-env` directly)\n"
  );
  const child = spawn("agent-env", translated.args, { stdio: "inherit" });
  child.on("error", (err) => {
    process.stderr.write(`agent-dogfeed: cannot run agent-env: ${err.message}\n`);
    process.exitCode = 1;
  });
  child.on("close", (code) => {
    process.exitCode = code ?? 1;
  });
}

function translate(cmd, rest) {
  switch (cmd) {
    case "capture":
      return { args: ["capture", ...rest] };

    case "codex":
    case "claude": {
      const args = ["probe", cmd];
      for (const arg of rest) {
        if (arg === "--user-codex" || arg === "--user-claude") {
          args.push("--user");
        } else if (arg === "--blank-codex" || arg === "--blank-claude") {
          // isolation is agent-env's default — drop the flag
        } else {
          args.push(arg);
        }
      }
      return { args };
    }

    case "help":
    case "--help":
    case "-h":
    case undefined:
      return { error: "" };

    default:
      return { error: `unknown command: ${cmd}\n` };
  }
}

function usage() {
  return `agent-dogfeed is superseded by agent-env.

old surface (still works, delegates):
  agent-dogfeed capture [--output <path>] -- <command> [args...]
  agent-dogfeed codex --repo <path> --prompt <p> [--model <m>] [--skill <s>] [--user-codex]
  agent-dogfeed claude --repo <path> --prompt <p> [--model <m>] [--skill <s>] [--user-claude]

new surface:
  agent-env probe <codex|claude> --repo <path> --prompt <p> [--model <m>] [--skill <s>] [--user]
  agent-env up <codex|claude> --repo <path>        (interactive isolated session)
  agent-env capture [--output <path>] -- <command> [args...]
  agent-env list
`;
}
