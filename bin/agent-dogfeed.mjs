#!/usr/bin/env node

// agent-dogfeed is the dogfooding METHODOLOGY (see skills/agent-dogfeed);
// the probe-rendering machinery lives in agent-env. This binary is a thin
// delegate that keeps the old command surface working on top of
// `agent-env probe`/`agent-env capture`.

import { spawn } from "node:child_process";

const argv = process.argv.slice(2);
const command = argv[0];

const translated = translate(command, argv.slice(1));
if (translated.error) {
  process.stderr.write(`${translated.error}\n${usage()}`);
  process.exitCode = 2;
} else {
  process.stderr.write(
    "agent-dogfeed: delegating to agent-env (prefer calling agent-env directly)\n"
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
  return `agent-dogfeed delegates its CLI surface to agent-env (the
methodology lives in the agent-dogfeed skill).

delegated commands:
  agent-dogfeed capture [--output <path>] -- <command> [args...]
  agent-dogfeed codex --repo <path> --prompt <p> [--model <m>] [--skill <s>] [--user-codex]
  agent-dogfeed claude --repo <path> --prompt <p> [--model <m>] [--skill <s>] [--user-claude]

agent-env surface:
  agent-env probe <codex|claude> --repo <path> --prompt <p> [--model <m>] [--skill <s>] [--user]
  agent-env up <codex|claude> --repo <path>        (interactive isolated session)
  agent-env capture [--output <path>] -- <command> [args...]
  agent-env list
`;
}
