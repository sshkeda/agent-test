#!/usr/bin/env node

import { mkdtemp, readFile, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { spawn } from "node:child_process";

const tempDir = await mkdtemp(join(tmpdir(), "agent-dogfeed-"));
const proofPath = join(tempDir, "proof.jsonl");

try {
  const exitCode = await run("node", [
    "bin/agent-dogfeed.mjs",
    "capture",
    "--output",
    proofPath,
    "--",
    "skills/agent-dogfeed/scripts/terminal-contract-fixture.sh",
  ]);

  if (exitCode !== 0) {
    throw new Error(`smoke fixture exited with code ${exitCode}`);
  }

  const rows = (await readFile(proofPath, "utf8"))
    .trim()
    .split("\n")
    .map((line) => JSON.parse(line));

  const sawProgress = rows.some(
    (row) =>
      row.event === "terminal_probe_chunk" &&
      row.stream === "stderr" &&
      row.text.includes('"phase":"waiting"'),
  );
  const sawOutput = rows.some(
    (row) =>
      row.event === "terminal_probe_chunk" &&
      row.stream === "stdout" &&
      row.text.includes("FIXTURE_OK"),
  );
  const sawCleanExit = rows.some(
    (row) => row.event === "terminal_probe_exit" && row.code === 0,
  );

  if (!sawProgress || !sawOutput || !sawCleanExit) {
    throw new Error("smoke fixture did not produce expected evidence");
  }

  const probe = await runAndCapture("node", [
    "bin/agent-dogfeed.mjs",
    "codex",
    "--repo",
    process.cwd(),
    "--skill",
    "agent-dogfeed",
    "--prompt",
    "Run npm test and report the result.",
  ]);

  if (probe.code !== 0) {
    throw new Error("codex command generation failed");
  }

  if (
    !probe.stdout.includes("codex exec") ||
    !probe.stdout.includes("CODEX_HOME") ||
    !probe.stdout.includes("export CODEX_HOME") ||
    probe.stdout.includes("--ephemeral") ||
    !probe.stdout.includes("AGENT_DOGFEED_SESSION_DIR") ||
    !probe.stdout.includes("probe session saved in") ||
    !probe.stdout.includes('HOME="$CODEX_HOME/home" codex exec') ||
    !probe.stdout.includes("! -name .agents") ||
    !probe.stdout.includes("--ignore-user-config") ||
    !probe.stdout.includes("--ignore-rules") ||
    !probe.stdout.includes("--dangerously-bypass-approvals-and-sandbox") ||
    !probe.stdout.includes("$HOME/.codex/skills/agent-dogfeed") ||
    !probe.stdout.includes("Run npm test and report the result.")
  ) {
    throw new Error("codex command did not include isolated defaults");
  }

  const userProbe = await runAndCapture("node", [
    "bin/agent-dogfeed.mjs",
    "codex",
    "--user-codex",
    "--repo",
    process.cwd(),
    "--prompt",
    "Run npm test and report the result.",
  ]);

  if (userProbe.code !== 0) {
    throw new Error("user codex command generation failed");
  }

  if (
    !userProbe.stdout.includes("codex exec") ||
    userProbe.stdout.includes("CODEX_HOME") ||
    userProbe.stdout.includes("AGENT_DOGFEED_SESSION_DIR") ||
    !userProbe.stdout.includes("Run npm test and report the result.")
  ) {
    throw new Error("user codex command was not explicitly non-isolated");
  }

  const claudeProbe = await runAndCapture("node", [
    "bin/agent-dogfeed.mjs",
    "claude",
    "--repo",
    process.cwd(),
    "--skill",
    "agent-dogfeed",
    "--prompt",
    "Run npm test and report the result.",
  ]);

  if (claudeProbe.code !== 0) {
    throw new Error("claude command generation failed");
  }

  if (
    !claudeProbe.stdout.includes("claude -p") ||
    !claudeProbe.stdout.includes("CLAUDE_CONFIG_DIR") ||
    !claudeProbe.stdout.includes("export CLAUDE_CONFIG_DIR") ||
    claudeProbe.stdout.includes("--no-session-persistence") ||
    !claudeProbe.stdout.includes("AGENT_DOGFEED_SESSION_DIR") ||
    !claudeProbe.stdout.includes("probe session saved in") ||
    !claudeProbe.stdout.includes("--strict-mcp-config") ||
    !claudeProbe.stdout.includes("--permission-mode bypassPermissions") ||
    !claudeProbe.stdout.includes("--output-format stream-json") ||
    !claudeProbe.stdout.includes("$HOME/.claude/skills/agent-dogfeed") ||
    !claudeProbe.stdout.includes("Claude Code-credentials") ||
    !claudeProbe.stdout.includes(".credentials.json") ||
    !claudeProbe.stdout.includes("Run npm test and report the result.")
  ) {
    throw new Error("claude command did not include isolated defaults");
  }

  const userClaudeProbe = await runAndCapture("node", [
    "bin/agent-dogfeed.mjs",
    "claude",
    "--user-claude",
    "--repo",
    process.cwd(),
    "--prompt",
    "Run npm test and report the result.",
  ]);

  if (userClaudeProbe.code !== 0) {
    throw new Error("user claude command generation failed");
  }

  if (
    !userClaudeProbe.stdout.includes("claude -p") ||
    userClaudeProbe.stdout.includes("CLAUDE_CONFIG_DIR") ||
    userClaudeProbe.stdout.includes("AGENT_DOGFEED_SESSION_DIR") ||
    !userClaudeProbe.stdout.includes("Run npm test and report the result.")
  ) {
    throw new Error("user claude command was not explicitly non-isolated");
  }
} finally {
  await rm(tempDir, { recursive: true, force: true });
}

function run(command, args) {
  return new Promise((resolve, reject) => {
    const child = spawn(command, args, { stdio: "inherit" });
    child.once("error", reject);
    child.once("close", (code) => resolve(code ?? 1));
  });
}

function runAndCapture(command, args) {
  return new Promise((resolve, reject) => {
    const child = spawn(command, args, { stdio: ["ignore", "pipe", "pipe"] });
    let stdout = "";
    let stderr = "";

    child.stdout.on("data", (chunk) => {
      stdout += chunk.toString("utf8");
    });

    child.stderr.on("data", (chunk) => {
      stderr += chunk.toString("utf8");
    });

    child.once("error", reject);
    child.once("close", (code) => resolve({ code: code ?? 1, stdout, stderr }));
  });
}
