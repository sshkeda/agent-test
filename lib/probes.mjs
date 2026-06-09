const defaultCodexModel = "gpt-5.4-mini";
const defaultClaudeModel = "haiku";

const codexSkillTarget = {
  homeVar: "CODEX_HOME",
  userSkillsDir: "$HOME/.codex/skills",
};
const claudeSkillTarget = {
  homeVar: "CLAUDE_CONFIG_DIR",
  userSkillsDir: "$HOME/.claude/skills",
};

export function buildCodexExecArgs({
  repo,
  prompt,
  model = defaultCodexModel,
  isolated = true,
}) {
  const args = [
    "exec",
    "-m",
    model,
    "--color",
    "never",
  ];

  if (isolated) {
    args.push(
      "--ignore-user-config",
      "--ignore-rules",
      "--ephemeral",
      "--dangerously-bypass-approvals-and-sandbox",
    );
  }

  args.push(
    "-C",
    repo,
    prompt,
  );

  return args;
}

export function buildClaudePrintArgs({
  prompt,
  model = defaultClaudeModel,
  isolated = true,
}) {
  const args = [
    "-p",
    "--model",
    model,
    "--output-format",
    "stream-json",
    "--verbose",
  ];

  if (isolated) {
    args.push(
      "--no-session-persistence",
      "--strict-mcp-config",
      "--permission-mode",
      "bypassPermissions",
    );
  }

  args.push(prompt);
  return args;
}

export function renderShellCommand(command, args) {
  return [command, ...args].map(shellQuote).join(" ");
}

export function renderIsolatedCodexShellCommand(args, skills = []) {
  const setup = [
    'CODEX_HOME="$(mktemp -d "${TMPDIR:-/tmp}/agent-dogfeed-codex-home.XXXXXX")"',
    "export CODEX_HOME",
    'trap \'rm -rf "$CODEX_HOME"\' EXIT',
    'install -m 600 "$HOME/.codex/auth.json" "$CODEX_HOME/auth.json"',
  ];

  if (skills.length > 0) {
    setup.push('mkdir -p "$CODEX_HOME/skills"');
  }

  for (const skill of skills) {
    setup.push(renderSkillLinkCommand(skill, codexSkillTarget));
  }

  return [
    ...setup,
    renderShellCommand("codex", args),
  ].join("; ");
}

export function renderClaudeShellCommand(repo, args) {
  return `cd ${shellQuote(repo)} && ${renderShellCommand("claude", args)}`;
}

export function renderIsolatedClaudeShellCommand(repo, args, skills = []) {
  const setup = [
    'CLAUDE_CONFIG_DIR="$(mktemp -d "${TMPDIR:-/tmp}/agent-dogfeed-claude-home.XXXXXX")"',
    "export CLAUDE_CONFIG_DIR",
    'trap \'rm -rf "$CLAUDE_CONFIG_DIR"\' EXIT',
    'security find-generic-password -w -s "Claude Code-credentials" -a "$USER" > "$CLAUDE_CONFIG_DIR/.credentials.json"',
    'chmod 600 "$CLAUDE_CONFIG_DIR/.credentials.json"',
  ];

  if (skills.length > 0) {
    setup.push('mkdir -p "$CLAUDE_CONFIG_DIR/skills"');
  }

  for (const skill of skills) {
    setup.push(renderSkillLinkCommand(skill, claudeSkillTarget));
  }

  return [
    ...setup,
    renderClaudeShellCommand(repo, args),
  ].join("; ");
}

function shellQuote(value) {
  if (/^[A-Za-z0-9_./:=@%+-]+$/.test(value)) {
    return value;
  }

  return `'${value.replaceAll("'", "'\\''")}'`;
}

function renderSkillLinkCommand(skill, { homeVar, userSkillsDir }) {
  if (skill.includes("/") || skill.startsWith(".")) {
    return `ln -s ${shellQuote(skill)} "$${homeVar}/skills/$(basename ${shellQuote(skill)})"`;
  }

  return `ln -s "${userSkillsDir}/${skill}" "$${homeVar}/skills/${skill}"`;
}
