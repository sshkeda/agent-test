#!/usr/bin/env node

import { spawn } from "node:child_process";
import { appendFileSync, writeFileSync } from "node:fs";
import { performance } from "node:perf_hooks";

const separator = process.argv.indexOf("--");
const command = separator >= 0 ? process.argv.slice(separator + 1) : [];
const options = separator >= 0 ? process.argv.slice(2, separator) : process.argv.slice(2);
let outputPath;

for (let index = 0; index < options.length; index += 1) {
  if (options[index] === "--output" && options[index + 1]) {
    outputPath = options[index + 1];
    index += 1;
    continue;
  }
  process.stderr.write("usage: capture-terminal.mjs [--output <path>] -- <command> [args...]\n");
  process.exit(2);
}

if (command.length === 0) {
  process.stderr.write("usage: capture-terminal.mjs [--output <path>] -- <command> [args...]\n");
  process.exit(2);
}

const startedAt = performance.now();
let sequence = 0;

if (outputPath) {
  writeFileSync(outputPath, "", { mode: 0o600 });
}

function emit(event) {
  const line = `${JSON.stringify(event)}\n`;
  process.stdout.write(line);
  if (outputPath) {
    appendFileSync(outputPath, line);
  }
}

function elapsedMs() {
  return Math.round(performance.now() - startedAt);
}

emit({
  event: "terminal_probe_start",
  command: command[0],
  arg_count: command.length - 1,
});

const exitCode = await new Promise((resolve) => {
  const child = spawn(command[0], command.slice(1), {
    stdio: ["ignore", "pipe", "pipe"],
  });
  let spawnFailed = false;

  for (const stream of ["stdout", "stderr"]) {
    child[stream].on("data", (chunk) => {
      emit({
        event: "terminal_probe_chunk",
        sequence: ++sequence,
        stream,
        elapsed_ms: elapsedMs(),
        text: chunk.toString("utf8"),
      });
    });
  }

  child.once("error", (error) => {
    spawnFailed = true;
    emit({
      event: "terminal_probe_error",
      elapsed_ms: elapsedMs(),
      message: error.message,
    });
  });

  child.once("close", (code, signal) => {
    const resolvedCode = spawnFailed ? 127 : (code ?? 1);
    emit({
      event: "terminal_probe_exit",
      elapsed_ms: elapsedMs(),
      code: resolvedCode,
      signal,
    });
    resolve(resolvedCode);
  });
});

process.exitCode = exitCode;
