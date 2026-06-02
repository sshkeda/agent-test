#!/usr/bin/env node

import { mkdtemp, readFile, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { spawn } from "node:child_process";

const tempDir = await mkdtemp(join(tmpdir(), "agent-test-"));
const proofPath = join(tempDir, "proof.jsonl");

try {
  const exitCode = await run("node", [
    "skills/agent-test/scripts/capture-terminal.mjs",
    "--output",
    proofPath,
    "--",
    "skills/agent-test/scripts/terminal-contract-fixture.sh",
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
